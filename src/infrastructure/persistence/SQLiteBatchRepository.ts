import { eq } from "drizzle-orm";
import { IBatchRepository } from "../../domain/repositories/IBatchRepository";
import { BatchEntity } from "../../domain/entities";
import { sqliteEngine, CURRENT_BRANCH_ID } from "../db/database";
import { db, isTauriDesktop, sqliteRaw } from "../db/connection";
import { batchesTable } from "../db/schema";

export class SQLiteBatchRepository implements IBatchRepository {
  async getBatchesByProductId(productId: string): Promise<BatchEntity[]> {
    if (isTauriDesktop() && sqliteRaw) {
      const rows = await sqliteRaw.select<Record<string, unknown>[]>(
        "SELECT * FROM batches WHERE product_id = $1 ORDER BY expiry_date ASC;",
        [productId],
      );
      return rows.map((b) => ({
        id: String(b.id),
        productId: String(b.product_id),
        batchNumber: String(b.batch_number),
        expiryDate: String(b.expiry_date),
        qtyPacks: Number(b.qty_packs),
        branchId: String(b.branch_id || CURRENT_BRANCH_ID),
      }));
    }

    const snapshot = sqliteEngine.getSnapshot();
    const product = snapshot.products.find((p) => p.id === productId);
    if (!product) return [];

    return [...product.batches].sort((a, b) =>
      a.expiryDate.localeCompare(b.expiryDate),
    );
  }

  async saveBatch(productId: string, batch: BatchEntity): Promise<void> {
    const normalizedBatch: BatchEntity = {
      ...batch,
      productId,
      branchId: batch.branchId || CURRENT_BRANCH_ID,
    };

    let finalBatchToSave = normalizedBatch;

    sqliteEngine.commit((draft) => {
      const product = draft.products.find((p) => p.id === productId);
      if (!product) return;

      const existingIdx = product.batches.findIndex(
        (b) =>
          b.id === normalizedBatch.id ||
          (b.batchNumber === normalizedBatch.batchNumber &&
            b.expiryDate === normalizedBatch.expiryDate),
      );

      if (existingIdx >= 0) {
        product.batches[existingIdx].qtyPacks += normalizedBatch.qtyPacks;
        finalBatchToSave = { ...product.batches[existingIdx] };
      } else {
        product.batches.push(normalizedBatch);
      }

      product.batches.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    });

    if (isTauriDesktop() && sqliteRaw) {
      await sqliteRaw.execute(
        `INSERT OR REPLACE INTO batches (
          id, product_id, batch_number, expiry_date, qty_packs, branch_id
        ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          finalBatchToSave.id,
          productId,
          finalBatchToSave.batchNumber,
          finalBatchToSave.expiryDate,
          finalBatchToSave.qtyPacks,
          finalBatchToSave.branchId || CURRENT_BRANCH_ID,
        ],
      );
    }

    sqliteEngine.enqueueSync("BATCH", "INSERT", finalBatchToSave.id, {
      productId,
      batch: finalBatchToSave,
    });
  }

  async updateBatchesAfterFIFO(
    productId: string,
    updatedBatches: BatchEntity[],
  ): Promise<void> {
    const activeBatches = updatedBatches
      .filter((b) => b.qtyPacks > 0)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

    sqliteEngine.commit((draft) => {
      const product = draft.products.find((p) => p.id === productId);
      if (!product) return;
      product.batches = activeBatches;
    });

    if (isTauriDesktop() && sqliteRaw) {
      await db
        .delete(batchesTable)
        .where(eq(batchesTable.productId, productId))
        .run();

      for (const b of activeBatches) {
        await sqliteRaw.execute(
          `INSERT INTO batches (
            id, product_id, batch_number, expiry_date, qty_packs, branch_id
          ) VALUES ($1, $2, $3, $4, $5, $6);`,
          [
            b.id,
            productId,
            b.batchNumber,
            b.expiryDate,
            b.qtyPacks,
            b.branchId || CURRENT_BRANCH_ID,
          ],
        );
      }
    }

    sqliteEngine.enqueueSync("BATCH", "UPDATE", productId, {
      productId,
      batches: activeBatches,
    });
  }
}
