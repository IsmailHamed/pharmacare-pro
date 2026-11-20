import { eq } from "drizzle-orm";
import { IBatchRepository } from "../../domain/repositories/IBatchRepository";
import { BatchEntity, SyncQueueItemEntity } from "../../domain/entities";
import { sqliteEngine, CURRENT_BRANCH_ID } from "../db/database";
import { db, isTauriDesktop, sqliteRaw } from "../db/connection";
import { batchesTable } from "../db/schema";

export class SQLiteBatchRepository implements IBatchRepository {
  /**
   * حفظ عنصر طابور المزامنة داخل جدول sync_queue في ملف pharmacare.db على سطح المكتب
   * لضمان بقاء حركات الدفعات المعلقة بعد إغلاق التطبيق وإعادة فتحه
   */
  private async persistSyncItemToDesktopSQLite(
    item: SyncQueueItemEntity,
  ): Promise<void> {
    if (!isTauriDesktop() || !sqliteRaw) return;
    await sqliteRaw.execute(
      `INSERT OR REPLACE INTO sync_queue (
        id, entity_type, operation, record_id, payload, branch_id, status, created_at, synced_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
      [
        item.id,
        item.entityType,
        item.operation,
        item.recordId,
        item.payload,
        item.branchId,
        item.status,
        item.createdAt,
        item.syncedAt || null,
      ],
    );
  }

  /**
   * جلب جميع دفعات دواء معين مرتبة تصاعدياً حسب تاريخ الصلاحية (الأقرب انتهاءً أولاً - FIFO)
   */
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

  /**
   * إضافة دفعة جديدة أو دمج الكمية في دفعة مطابقة (نفس الرقم وتاريخ الصلاحية)
   * مع الحفظ المزدوج (ذاكرة المتصفح + SQLite سطح المكتب + طابور المزامنة)
   */
  async saveBatch(productId: string, batch: BatchEntity): Promise<void> {
    const normalizedBatch: BatchEntity = {
      ...batch,
      productId,
      branchId: batch.branchId || CURRENT_BRANCH_ID,
    };

    let finalBatchToSave = normalizedBatch;
    let syncOperation: SyncQueueItemEntity["operation"] = "INSERT";

    // 1. تحديث حالة الذاكرة السريعة ولقطة المتصفح
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
        // دمج الكمية الواردة مع الدفعة الموجودة مسبقاً
        product.batches[existingIdx].qtyPacks += normalizedBatch.qtyPacks;
        finalBatchToSave = { ...product.batches[existingIdx] };
        syncOperation = "UPDATE";
      } else {
        product.batches.push(normalizedBatch);
        syncOperation = "INSERT";
      }

      // إعادة الترتيب تصاعدياً حسب أقرب تاريخ صلاحية
      product.batches.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    });

    // 2. الحفظ الفعلي في جدول batches داخل pharmacare.db على سطح المكتب
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

    // 3. إدراج الحركة في طابور المزامنة وحفظها في جدول sync_queue بقاعدة SQLite
    const syncItem = sqliteEngine.enqueueSync(
      "BATCH",
      syncOperation,
      finalBatchToSave.id,
      {
        productId,
        batch: finalBatchToSave,
      },
    );
    await this.persistSyncItemToDesktopSQLite(syncItem);
  }

  /**
   * تحديث أرصدة دفعات الصنف بعد عملية خصم البيع وفق مبدأ FIFO
   * (استبعاد الدفعات التي أصبحت كميتها صفراً وحفظ البقية في SQLite وطابور المزامنة)
   */
  async updateBatchesAfterFIFO(
    productId: string,
    updatedBatches: BatchEntity[],
  ): Promise<void> {
    const activeBatches = updatedBatches
      .filter((b) => b.qtyPacks > 0)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

    // 1. تحديث الدفعات النشطة في الذاكرة المحلية
    sqliteEngine.commit((draft) => {
      const product = draft.products.find((p) => p.id === productId);
      if (!product) return;
      product.batches = activeBatches;
    });

    // 2. تحديث جدول batches في قاعدة SQLite الفعلية على سطح المكتب
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

    // 3. إدراج تحديث الدفعات في طابور المزامنة وحفظه في جدول sync_queue بقاعدة SQLite
    const syncItem = sqliteEngine.enqueueSync("BATCH", "UPDATE", productId, {
      productId,
      batches: activeBatches,
    });
    await this.persistSyncItemToDesktopSQLite(syncItem);
  }
}
