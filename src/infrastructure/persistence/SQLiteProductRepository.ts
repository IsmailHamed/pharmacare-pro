import { eq } from "drizzle-orm";
import { IProductRepository } from "../../domain/repositories/IProductRepository";
import { ProductEntity, BatchEntity } from "../../domain/entities";
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

    sqliteEngine.commit((draft) => {
      const idx = draft.products.findIndex(
        (p) => p.id === normalized.id || p.barcode === normalized.barcode,
      );
      if (idx >= 0) {
        normalized.id = draft.products[idx].id;
        draft.products[idx] = normalized;
      } else {
        draft.products.unshift(normalized);
      }
    });

    if (isTauriDesktop() && sqliteRaw) {
      await this.persistProductToDesktopSQLite(normalized);
    }

    sqliteEngine.enqueueSync("PRODUCT", "UPDATE", normalized.id, normalized);
  }
  /**
   * إدخال أو تحديث آلاف الأدوية دفعة واحدة (Bulk Upsert Transaction)
   * يمنع تجمّد المتصفح أو قاعدة البيانات عند استيراد 10,000+ دواء من ملف Excel
   */
  async upsertProductsBulk(importedProducts: ProductEntity[]): Promise<void> {
    if (importedProducts.length === 0) return;

    // 1. تحديث المحرك المحلي بعملية حفظ (commit) واحدة فقط لجميع الأدوية!
    sqliteEngine.commit((draft) => {
      const existingMap = new Map(draft.products.map((p, idx) => [p.id, idx]));

      for (const product of importedProducts) {
        const idx = existingMap.get(product.id);
        if (idx !== undefined) {
          draft.products[idx] = product;
        } else {
          draft.products.push(product);
          existingMap.set(product.id, draft.products.length - 1);
        }
      }
    });

    // 2. إذا كنا على تطبيق سطح المكتب (Tauri SQLite)، ننفذ الإدخال داخل Transaction واحدة سريعة
    if (isTauriDesktop() && sqliteRaw) {
      await sqliteRaw.execute("BEGIN TRANSACTION;");
      try {
        for (const product of importedProducts) {
          await sqliteRaw.execute(
            `INSERT OR REPLACE INTO products (
              id, barcode, name, scientific_name, category,
              pack_price, weighted_cost_price, strips_per_pack,
              stock_packs, stock_loose_strips, min_limit,
              is_controlled, branch_id, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);`,
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
              product.updatedAt || new Date().toISOString(),
            ],
          );

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
        await sqliteRaw.execute("COMMIT;");
      } catch (err) {
        await sqliteRaw.execute("ROLLBACK;");
        throw err;
      }
    }

    // 3. تسجيل عنصر مزامنة مجمع واحد بدلاً من 10,000 عنصر منفصل
    sqliteEngine.enqueueSync("PRODUCT", "UPDATE", `BULK-IMPORT-${Date.now()}`, {
      count: importedProducts.length,
    });
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

    sqliteEngine.enqueueSync("PRODUCT", "UPDATE", productId, {
      productId,
      newPacks: safePacks,
      newLooseStrips: safeStrips,
      updatedAt: now,
    });
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

    sqliteEngine.enqueueSync("PRODUCT", "UPDATE", productId, {
      productId,
      newPacks: safePacks,
      newWeightedCostPrice: safeCost,
      newPackPrice: safePrice,
      updatedAt: now,
    });
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

    sqliteEngine.enqueueSync("BULK_PRICING", "UPDATE", `BULK-${Date.now()}`, {
      percentChange,
      categoryFilter: categoryFilter || "ALL",
      affectedCount: affectedProducts.length,
      updatedAt: now,
    });

    return this.getAllProducts();
  }
}
