import { eq } from "drizzle-orm";
import { IProductRepository } from "../../domain/repositories/IProductRepository";
import {
  ProductEntity,
  BatchEntity,
  SyncQueueItemEntity,
} from "../../domain/entities";
import { sqliteEngine, CURRENT_BRANCH_ID } from "../db/database";
import { db, isTauriDesktop, sqliteRaw } from "../db/connection";
import { productsTable, batchesTable } from "../db/schema";

export class SQLiteProductRepository implements IProductRepository {
  /**
   * مزامنة البيانات الأولية (Seed) داخل ملف pharmacare.db عند تشغيل Tauri لأول مرة
   */
  private async ensureDesktopSeed(): Promise<void> {
    if (!isTauriDesktop() || !sqliteRaw) return;
    const rows = await sqliteRaw.select<{ cnt: number }[]>(
      "SELECT COUNT(*) as cnt FROM products;",
    );
    const count = Number(rows[0]?.cnt ?? 0);
    if (count === 0) {
      const initialProducts = sqliteEngine.getSnapshot().products;
      for (const p of initialProducts) {
        await this.persistProductToDesktopSQLite(p);
      }
    }
  }

  /**
   * حفظ أو تحديث سجل دواء واحد مع دفعاته داخل جداول SQLite على سطح المكتب
   */
  private async persistProductToDesktopSQLite(
    product: ProductEntity,
  ): Promise<void> {
    if (!isTauriDesktop() || !sqliteRaw) return;
    const now = product.updatedAt || new Date().toISOString();

    await sqliteRaw.execute(
      `INSERT INTO products (
        id, barcode, name, scientific_name, category, pack_price,
        weighted_cost_price, strips_per_pack, stock_packs, stock_loose_strips,
        min_limit, is_controlled, branch_id, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT(barcode) DO UPDATE SET
        name = excluded.name,
        scientific_name = excluded.scientific_name,
        category = excluded.category,
        pack_price = excluded.pack_price,
        weighted_cost_price = excluded.weighted_cost_price,
        strips_per_pack = excluded.strips_per_pack,
        stock_packs = excluded.stock_packs,
        stock_loose_strips = excluded.stock_loose_strips,
        min_limit = excluded.min_limit,
        is_controlled = excluded.is_controlled,
        updated_at = excluded.updated_at;`,
      [
        product.id,
        product.barcode,
        product.name,
        product.scientificName,
        product.category || "عام",
        product.packPrice,
        product.weightedCostPrice,
        product.stripsPerPack,
        product.stockPacks,
        product.stockLooseStrips,
        product.minLimit,
        product.isControlled ? 1 : 0,
        product.branchId || CURRENT_BRANCH_ID,
        now,
      ],
    );

    for (const b of product.batches || []) {
      await sqliteRaw.execute(
        `INSERT OR REPLACE INTO batches (
          id, product_id, batch_number, expiry_date, qty_packs, branch_id
        ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          b.id,
          product.id,
          b.batchNumber,
          b.expiryDate,
          b.qtyPacks,
          b.branchId || CURRENT_BRANCH_ID,
        ],
      );
    }
  }

  /**
   * حفظ عنصر طابور المزامنة داخل جدول sync_queue في ملف pharmacare.db على سطح المكتب
   * لضمان عدم فقدان حركات الأدوية المعلقة بعد إغلاق التطبيق وإعادة فتحه
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

  async getAllProducts(): Promise<ProductEntity[]> {
    if (isTauriDesktop() && sqliteRaw) {
      try {
        await this.ensureDesktopSeed();
        const prodRows = await sqliteRaw.select<Record<string, unknown>[]>(
          "SELECT * FROM products ORDER BY name ASC;",
        );
        const batchRows = await sqliteRaw.select<Record<string, unknown>[]>(
          "SELECT * FROM batches ORDER BY expiry_date ASC;",
        );

        const batchesByProduct = new Map<string, BatchEntity[]>();
        for (const b of batchRows) {
          const pid = String(b.product_id);
          const list = batchesByProduct.get(pid) || [];
          list.push({
            id: String(b.id),
            productId: pid,
            batchNumber: String(b.batch_number),
            expiryDate: String(b.expiry_date),
            qtyPacks: Number(b.qty_packs),
            branchId: String(b.branch_id || CURRENT_BRANCH_ID),
          });
          batchesByProduct.set(pid, list);
        }

        const mapped: ProductEntity[] = prodRows.map((r) => {
          const id = String(r.id);
          return {
            id,
            barcode: String(r.barcode),
            name: String(r.name),
            scientificName: String(r.scientific_name),
            category: String(r.category || "عام"),
            packPrice: Number(r.pack_price),
            weightedCostPrice: Number(r.weighted_cost_price),
            stripsPerPack: Number(r.strips_per_pack),
            stockPacks: Number(r.stock_packs),
            stockLooseStrips: Number(r.stock_loose_strips),
            minLimit: Number(r.min_limit),
            isControlled: Boolean(r.is_controlled),
            branchId: String(r.branch_id || CURRENT_BRANCH_ID),
            updatedAt: String(r.updated_at),
            batches: (batchesByProduct.get(id) || []).sort((a, b) =>
              a.expiryDate.localeCompare(b.expiryDate),
            ),
          };
        });

        sqliteEngine.commit((draft) => {
          draft.products = mapped;
        });
        return mapped;
      } catch (err) {
        console.warn("SQLite read fallback to local engine:", err);
      }
    }

    const snapshot = sqliteEngine.getSnapshot();
    return snapshot.products.map((product) => ({
      ...product,
      batches: [...product.batches].sort((a, b) =>
        a.expiryDate.localeCompare(b.expiryDate),
      ),
    }));
  }

  async getProductByBarcode(barcode: string): Promise<ProductEntity | null> {
    const clean = barcode.trim();
    const products = await this.getAllProducts();
    const product = products.find((p) => p.barcode === clean);
    return product || null;
  }

  async upsertProduct(product: ProductEntity): Promise<void> {
    const now = new Date().toISOString();
    const normalized: ProductEntity = {
      ...product,
      branchId: product.branchId || CURRENT_BRANCH_ID,
      updatedAt: now,
    };

    // التحقق مما إذا كان الصنف موجوداً مسبقاً لتسجيل نوع العملية بدقة (INSERT أم UPDATE)
    let syncOperation: SyncQueueItemEntity["operation"] = "INSERT";

    sqliteEngine.commit((draft) => {
      const idx = draft.products.findIndex(
        (p) => p.id === normalized.id || p.barcode === normalized.barcode,
      );
      if (idx >= 0) {
        normalized.id = draft.products[idx].id;
        draft.products[idx] = normalized;
        syncOperation = "UPDATE";
      } else {
        draft.products.unshift(normalized);
        syncOperation = "INSERT";
      }
    });

    if (isTauriDesktop() && sqliteRaw) {
      await this.persistProductToDesktopSQLite(normalized);
    }

    // إدراج الحركة في طابور المزامنة وحفظها في جدول sync_queue على سطح المكتب
    const syncItem = sqliteEngine.enqueueSync(
      "PRODUCT",
      syncOperation,
      normalized.id,
      normalized,
    );
    await this.persistSyncItemToDesktopSQLite(syncItem);
  }

  /**
   * إدخال أو تحديث آلاف الأدوية دفعة واحدة (Bulk Upsert Transaction)
   * يطابق الأصناف بالـ id والـ barcode معاً لمنع التكرار أو فقدان الدفعات القائمة
   */
  async upsertProductsBulk(importedProducts: ProductEntity[]): Promise<void> {
    if (importedProducts.length === 0) return;

    const now = new Date().toISOString();
    const resolvedForSQLite: {
      product: ProductEntity;
      replaceBatches: boolean;
    }[] = [];

    // إزالة التكرار داخل ملف الاستيراد نفسه حسب الباركود (الاحتفاظ بآخر سطر لكل باركود)
    const dedupedByBarcode = new Map<string, ProductEntity>();
    for (const raw of importedProducts) {
      const cleanBarcode = raw.barcode.trim();
      if (!cleanBarcode) continue;
      dedupedByBarcode.set(cleanBarcode, {
        ...raw,
        barcode: cleanBarcode,
        branchId: raw.branchId || CURRENT_BRANCH_ID,
        updatedAt: raw.updatedAt || now,
      });
    }

    const normalizedList = Array.from(dedupedByBarcode.values());
    if (normalizedList.length === 0) return;

    // 1. تحديث المحرك المحلي بعملية حفظ (commit) واحدة مع المطابقة بالمعرّف والباركود
    sqliteEngine.commit((draft) => {
      const existingById = new Map<string, number>();
      const existingByBarcode = new Map<string, number>();

      draft.products.forEach((p, idx) => {
        existingById.set(p.id, idx);
        existingByBarcode.set(p.barcode.trim(), idx);
      });

      for (const incoming of normalizedList) {
        const matchedIdx =
          existingByBarcode.get(incoming.barcode) ??
          existingById.get(incoming.id);

        const hasIncomingBatches =
          Array.isArray(incoming.batches) && incoming.batches.length > 0;

        if (matchedIdx !== undefined) {
          const existing = draft.products[matchedIdx];
          const resolvedId = existing.id;

          // الاحتفاظ بالدفعات القديمة إذا لم يتضمن سطر الاستيراد دفعات جديدة
          const resolvedBatches = hasIncomingBatches
            ? incoming.batches.map((b) => ({
                ...b,
                productId: resolvedId,
                branchId: b.branchId || CURRENT_BRANCH_ID,
              }))
            : existing.batches;

          const merged: ProductEntity = {
            ...incoming,
            id: resolvedId,
            batches: resolvedBatches,
          };

          draft.products[matchedIdx] = merged;
          resolvedForSQLite.push({
            product: merged,
            replaceBatches: hasIncomingBatches,
          });
        } else {
          const prepared: ProductEntity = {
            ...incoming,
            batches: (incoming.batches || []).map((b) => ({
              ...b,
              productId: incoming.id,
              branchId: b.branchId || CURRENT_BRANCH_ID,
            })),
          };

          draft.products.push(prepared);
          const newIdx = draft.products.length - 1;
          existingById.set(prepared.id, newIdx);
          existingByBarcode.set(prepared.barcode, newIdx);

          resolvedForSQLite.push({
            product: prepared,
            replaceBatches: prepared.batches.length > 0,
          });
        }
      }
    });

    // 2. التنفيذ داخل Transaction واحدة في SQLite باستخدام ON CONFLICT(barcode) لتفادي حذف الدفعات عبر CASCADE
    if (isTauriDesktop() && sqliteRaw) {
      await sqliteRaw.execute("BEGIN TRANSACTION;");
      try {
        for (const { product, replaceBatches } of resolvedForSQLite) {
          await sqliteRaw.execute(
            `INSERT INTO products (
              id, barcode, name, scientific_name, category,
              pack_price, weighted_cost_price, strips_per_pack,
              stock_packs, stock_loose_strips, min_limit,
              is_controlled, branch_id, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT(barcode) DO UPDATE SET
              name = excluded.name,
              scientific_name = excluded.scientific_name,
              category = excluded.category,
              pack_price = excluded.pack_price,
              weighted_cost_price = excluded.weighted_cost_price,
              strips_per_pack = excluded.strips_per_pack,
              stock_packs = excluded.stock_packs,
              stock_loose_strips = excluded.stock_loose_strips,
              min_limit = excluded.min_limit,
              is_controlled = excluded.is_controlled,
              updated_at = excluded.updated_at;`,
            [
              product.id,
              product.barcode,
              product.name,
              product.scientificName,
              product.category || "عام",
              product.packPrice,
              product.weightedCostPrice,
              product.stripsPerPack,
              product.stockPacks,
              product.stockLooseStrips,
              product.minLimit,
              product.isControlled ? 1 : 0,
              product.branchId || CURRENT_BRANCH_ID,
              product.updatedAt || now,
            ],
          );

          if (replaceBatches) {
            await sqliteRaw.execute(
              "DELETE FROM batches WHERE product_id = $1;",
              [product.id],
            );

            for (const b of product.batches || []) {
              await sqliteRaw.execute(
                `INSERT OR REPLACE INTO batches (
                  id, product_id, batch_number, expiry_date, qty_packs, branch_id
                ) VALUES ($1, $2, $3, $4, $5, $6);`,
                [
                  b.id,
                  product.id,
                  b.batchNumber,
                  b.expiryDate,
                  b.qtyPacks,
                  b.branchId || CURRENT_BRANCH_ID,
                ],
              );
            }
          }
        }
        await sqliteRaw.execute("COMMIT;");
      } catch (err) {
        await sqliteRaw.execute("ROLLBACK;");
        throw err;
      }
    }

    // 3. تسجيل عنصر مزامنة مجمع واحد وحفظه في جدول sync_queue بقاعدة SQLite
    const syncItem = sqliteEngine.enqueueSync(
      "PRODUCT",
      "UPDATE",
      `BULK-IMPORT-${Date.now()}`,
      {
        count: resolvedForSQLite.length,
      },
    );
    await this.persistSyncItemToDesktopSQLite(syncItem);
  }

  async updateStock(
    productId: string,
    newPacks: number,
    newLooseStrips: number,
  ): Promise<void> {
    const now = new Date().toISOString();
    const safePacks = Math.max(0, newPacks);
    const safeStrips = Math.max(0, newLooseStrips);

    sqliteEngine.commit((draft) => {
      const product = draft.products.find((p) => p.id === productId);
      if (product) {
        product.stockPacks = safePacks;
        product.stockLooseStrips = safeStrips;
        product.updatedAt = now;
      }
    });

    if (isTauriDesktop() && sqliteRaw) {
      await db
        .update(productsTable)
        .set({
          stockPacks: safePacks,
          stockLooseStrips: safeStrips,
          updatedAt: now,
        })
        .where(eq(productsTable.id, productId))
        .run();
    }

    // إدراج تحديث الرصيد في طابور المزامنة وحفظه في SQLite
    const syncItem = sqliteEngine.enqueueSync("PRODUCT", "UPDATE", productId, {
      productId,
      newPacks: safePacks,
      newLooseStrips: safeStrips,
      updatedAt: now,
    });
    await this.persistSyncItemToDesktopSQLite(syncItem);
  }

  async updatePurchaseStockAndPricing(
    productId: string,
    newPacks: number,
    newWeightedCostPrice: number,
    newPackPrice: number,
  ): Promise<void> {
    const now = new Date().toISOString();
    const safePacks = Math.max(0, newPacks);
    const safeCost = Number(newWeightedCostPrice.toFixed(2));
    const safePrice = Number(newPackPrice.toFixed(2));

    sqliteEngine.commit((draft) => {
      const product = draft.products.find((p) => p.id === productId);
      if (product) {
        product.stockPacks = safePacks;
        product.weightedCostPrice = safeCost;
        product.packPrice = safePrice;
        product.updatedAt = now;
      }
    });

    if (isTauriDesktop() && sqliteRaw) {
      await db
        .update(productsTable)
        .set({
          stockPacks: safePacks,
          weightedCostPrice: safeCost,
          packPrice: safePrice,
          updatedAt: now,
        })
        .where(eq(productsTable.id, productId))
        .run();
    }

    // إدراج تحديث المشتريات والتكلفة المرجحة في طابور المزامنة وحفظه في SQLite
    const syncItem = sqliteEngine.enqueueSync("PRODUCT", "UPDATE", productId, {
      productId,
      newPacks: safePacks,
      newWeightedCostPrice: safeCost,
      newPackPrice: safePrice,
      updatedAt: now,
    });
    await this.persistSyncItemToDesktopSQLite(syncItem);
  }

  async applyBulkPriceAdjustment(
    percentChange: number,
    categoryFilter?: string,
  ): Promise<ProductEntity[]> {
    const now = new Date().toISOString();
    const factor = 1 + percentChange / 100;
    const affectedProducts: ProductEntity[] = [];

    sqliteEngine.commit((draft) => {
      draft.products.forEach((product) => {
        const matchesCategory =
          !categoryFilter ||
          categoryFilter === "ALL" ||
          product.category === categoryFilter;

        if (matchesCategory) {
          product.packPrice = Number(
            Math.max(0.5, product.packPrice * factor).toFixed(2),
          );
          product.updatedAt = now;
          affectedProducts.push({ ...product });
        }
      });
    });

    if (isTauriDesktop() && sqliteRaw) {
      for (const prod of affectedProducts) {
        await db
          .update(productsTable)
          .set({ packPrice: prod.packPrice, updatedAt: now })
          .where(eq(productsTable.id, prod.id))
          .run();
      }
    }

    // إدراج عملية التسعير الجماعي في طابور المزامنة وحفظها في SQLite
    const syncItem = sqliteEngine.enqueueSync(
      "BULK_PRICING",
      "UPDATE",
      `BULK-${Date.now()}`,
      {
        percentChange,
        categoryFilter: categoryFilter || "ALL",
        affectedCount: affectedProducts.length,
        updatedAt: now,
      },
    );
    await this.persistSyncItemToDesktopSQLite(syncItem);

    return this.getAllProducts();
  }
}
