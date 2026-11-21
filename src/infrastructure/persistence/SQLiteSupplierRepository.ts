import { ISupplierRepository } from "../../domain/repositories/ISupplierRepository";
import { SupplierEntity } from "../../domain/entities/Supplier";
import { SyncQueueItemEntity } from "../../domain/entities";
import { sqliteEngine, CURRENT_BRANCH_ID } from "../db/database";
import { isTauriDesktop, sqliteRaw } from "../db/connection";

export class SQLiteSupplierRepository implements ISupplierRepository {
  /**
   * جلب جميع المستودعات (النشطة والمجمّدة):
   * - على سطح المكتب (Tauri): القراءة المباشرة من جدول suppliers في pharmacare.db
   * - على المتصفح (Web): القراءة من لقطة الذاكرة المحلية sqliteEngine
   */
  async getAllSuppliers(): Promise<SupplierEntity[]> {
    if (isTauriDesktop() && sqliteRaw) {
      try {
        const rows = await sqliteRaw.select<Record<string, unknown>[]>(
          "SELECT * FROM suppliers ORDER BY name ASC;",
        );

        const mapped: SupplierEntity[] = rows.map((r) => ({
          id: String(r.id),
          name: String(r.name),
          phone: r.phone ? String(r.phone) : undefined,
          salesRepName: r.sales_rep_name ? String(r.sales_rep_name) : undefined,
          notes: r.notes ? String(r.notes) : undefined,
          isActive: r.is_active === true || Number(r.is_active) === 1,
          createdAt: String(r.created_at),
          branchId: String(r.branch_id || CURRENT_BRANCH_ID),
        }));

        // مزامنة نسخة الذاكرة السريعة مع قاعدة بيانات سطح المكتب
        sqliteEngine.commit((draft) => {
          draft.suppliers = mapped;
        });

        return mapped;
      } catch (err) {
        console.warn("Suppliers SQLite read fallback:", err);
      }
    }

    return [...(sqliteEngine.getSnapshot().suppliers || [])].sort((a, b) =>
      a.name.localeCompare(b.name, "ar"),
    );
  }

  async getSupplierById(id: string): Promise<SupplierEntity | null> {
    const suppliers = await this.getAllSuppliers();
    return suppliers.find((s) => s.id === id) || null;
  }

  async upsertSupplier(supplier: SupplierEntity): Promise<void> {
    const cleanName = supplier.name.trim();
    if (!cleanName) {
      throw new Error("اسم المستودع مطلوب ولا يمكن أن يكون فارغاً.");
    }

    // 1. التحقق من عدم تكرار اسم المستودع لسجل آخر قبل الحفظ
    const existingSuppliers = await this.getAllSuppliers();
    const duplicateSupplier = existingSuppliers.find(
      (s) =>
        s.name.trim().toLowerCase() === cleanName.toLowerCase() &&
        s.id !== supplier.id,
    );
    if (duplicateSupplier) {
      throw new Error(
        `المستودع (${duplicateSupplier.name}) مسجل بالفعل. يرجى اختيار اسم آخر أو تعديل السجل القائم.`,
      );
    }

    const normalizedSupplier: SupplierEntity = {
      ...supplier,
      name: cleanName,
      phone: supplier.phone?.trim() || undefined,
      salesRepName: supplier.salesRepName?.trim() || undefined,
      notes: supplier.notes?.trim() || undefined,
      branchId: supplier.branchId || CURRENT_BRANCH_ID,
    };

    const isExisting = existingSuppliers.some(
      (s) => s.id === normalizedSupplier.id,
    );
    const syncOperation: SyncQueueItemEntity["operation"] = isExisting
      ? "UPDATE"
      : "INSERT";

    // 2. تحديث حالة الذاكرة السريعة ولقطة المتصفح
    sqliteEngine.commit((draft) => {
      if (!draft.suppliers) draft.suppliers = [];
      const idx = draft.suppliers.findIndex(
        (s) => s.id === normalizedSupplier.id,
      );
      if (idx !== -1) {
        draft.suppliers[idx] = normalizedSupplier;
      } else {
        draft.suppliers.push(normalizedSupplier);
      }
    });

    // 3. الحفظ الفعلي في SQLite على سطح المكتب (Tauri)
    if (isTauriDesktop() && sqliteRaw) {
      await sqliteRaw.execute(
        `INSERT OR REPLACE INTO suppliers (
          id, name, phone, sales_rep_name, notes, is_active, created_at, branch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [
          normalizedSupplier.id,
          normalizedSupplier.name,
          normalizedSupplier.phone || null,
          normalizedSupplier.salesRepName || null,
          normalizedSupplier.notes || null,
          normalizedSupplier.isActive ? 1 : 0,
          normalizedSupplier.createdAt,
          normalizedSupplier.branchId,
        ],
      );
    }

    // 4. إدراج العملية في طابور المزامنة السحابية وحفظها في sync_queue بـ SQLite
    const syncItem = sqliteEngine.enqueueSync(
      "SUPPLIER",
      syncOperation,
      normalizedSupplier.id,
      normalizedSupplier,
    );
    await this.persistSyncItemToDesktopSQLite(syncItem);
  }

  async toggleSupplierStatus(id: string, isActive: boolean): Promise<void> {
    const supplier = await this.getSupplierById(id);
    if (supplier) {
      const updatedSupplier: SupplierEntity = { ...supplier, isActive };
      await this.upsertSupplier(updatedSupplier);
    }
  }

  /**
   * حفظ عنصر طابور المزامنة داخل جدول sync_queue في ملف pharmacare.db على سطح المكتب
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
}
