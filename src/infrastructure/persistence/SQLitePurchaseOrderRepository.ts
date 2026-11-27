import { IPurchaseOrderRepository } from "../../domain/repositories/IPurchaseOrderRepository";
import {
  PurchaseOrderDispatchChannel,
  PurchaseOrderEntity,
  PurchaseOrderItemEntity,
  PurchaseOrderStatus,
} from "../../domain/entities/PurchaseOrder";
import { SyncQueueItemEntity } from "../../domain/entities";
import { sqliteEngine, CURRENT_BRANCH_ID } from "../db/database";
import { isTauriDesktop, sqliteRaw } from "../db/connection";

export class SQLitePurchaseOrderRepository implements IPurchaseOrderRepository {
  /**
   * جلب جميع أوامر الشراء بترتيب زمني تنازلي (الأحدث أولاً):
   * - على سطح المكتب (Tauri): القراءة المباشرة من جدول purchase_orders في pharmacare.db
   * - على المتصفح (Web): القراءة من لقطة الذاكرة المحلية sqliteEngine
   */
  async getAllPurchaseOrders(): Promise<PurchaseOrderEntity[]> {
    if (isTauriDesktop() && sqliteRaw) {
      try {
        const rows = await sqliteRaw.select<Record<string, unknown>[]>(
          "SELECT * FROM purchase_orders ORDER BY created_at DESC;",
        );

        const mapped: PurchaseOrderEntity[] = rows.map((r) => ({
          id: String(r.id),
          supplierId: r.supplier_id ? String(r.supplier_id) : undefined,
          supplierName: String(r.supplier_name),
          supplierPhone: r.supplier_phone
            ? String(r.supplier_phone)
            : undefined,
          salesRepName: r.sales_rep_name ? String(r.sales_rep_name) : undefined,
          status: String(r.status) as PurchaseOrderStatus,
          items: JSON.parse(
            String(r.items_json || "[]"),
          ) as PurchaseOrderItemEntity[],
          totalOrderedPacks: Number(r.total_ordered_packs || 0),
          totalReceivedPacks: Number(r.total_received_packs || 0),
          estimatedTotalAmount: Number(r.estimated_total_amount || 0),
          notes: r.notes ? String(r.notes) : undefined,
          dispatchChannel: r.dispatch_channel
            ? (String(r.dispatch_channel) as PurchaseOrderDispatchChannel)
            : undefined,
          sentAt: r.sent_at ? String(r.sent_at) : undefined,
          completedAt: r.completed_at ? String(r.completed_at) : undefined,
          cancelledAt: r.cancelled_at ? String(r.cancelled_at) : undefined,
          linkedPurchaseInvoiceIds: JSON.parse(
            String(r.linked_purchase_invoice_ids_json || "[]"),
          ) as string[],
          createdByUserId: r.created_by_user_id
            ? String(r.created_by_user_id)
            : undefined,
          createdByName: r.created_by_name
            ? String(r.created_by_name)
            : undefined,
          createdAt: String(r.created_at),
          updatedAt: String(r.updated_at || r.created_at),
          branchId: String(r.branch_id || CURRENT_BRANCH_ID),
        }));

        // مزامنة نسخة الذاكرة السريعة مع قاعدة بيانات سطح المكتب
        sqliteEngine.commit((draft) => {
          draft.purchaseOrders = mapped;
        });

        return mapped;
      } catch (err) {
        console.warn("PurchaseOrders SQLite read fallback:", err);
      }
    }

    return [...(sqliteEngine.getSnapshot().purchaseOrders || [])].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async getPurchaseOrderById(id: string): Promise<PurchaseOrderEntity | null> {
    const orders = await this.getAllPurchaseOrders();
    return orders.find((o) => o.id === id) || null;
  }

  async upsertPurchaseOrder(order: PurchaseOrderEntity): Promise<void> {
    const cleanSupplierName = order.supplierName.trim();
    if (!cleanSupplierName) {
      throw new Error("اسم المستودع مطلوب لحفظ أمر الشراء.");
    }

    const existingOrders = await this.getAllPurchaseOrders();
    const isExisting = existingOrders.some((o) => o.id === order.id);
    const syncOperation: SyncQueueItemEntity["operation"] = isExisting
      ? "UPDATE"
      : "INSERT";

    const normalizedOrder: PurchaseOrderEntity = {
      ...order,
      supplierName: cleanSupplierName,
      supplierPhone: order.supplierPhone?.trim() || undefined,
      salesRepName: order.salesRepName?.trim() || undefined,
      notes: order.notes?.trim() || undefined,
      linkedPurchaseInvoiceIds: Array.isArray(order.linkedPurchaseInvoiceIds)
        ? order.linkedPurchaseInvoiceIds
        : [],
      branchId: order.branchId || CURRENT_BRANCH_ID,
      updatedAt: order.updatedAt || new Date().toISOString(),
    };

    // 1. تحديث حالة الذاكرة السريعة ولقطة المتصفح
    sqliteEngine.commit((draft) => {
      if (!draft.purchaseOrders) draft.purchaseOrders = [];
      const idx = draft.purchaseOrders.findIndex(
        (o) => o.id === normalizedOrder.id,
      );
      if (idx !== -1) {
        draft.purchaseOrders[idx] = normalizedOrder;
      } else {
        draft.purchaseOrders.unshift(normalizedOrder);
      }
    });

    // 2. الحفظ الفعلي في SQLite على سطح المكتب (Tauri)
    if (isTauriDesktop() && sqliteRaw) {
      await sqliteRaw.execute(
        `INSERT OR REPLACE INTO purchase_orders (
          id, supplier_id, supplier_name, supplier_phone, sales_rep_name,
          status, items_json, total_ordered_packs, total_received_packs,
          estimated_total_amount, notes, dispatch_channel, sent_at,
          completed_at, cancelled_at, linked_purchase_invoice_ids_json,
          created_by_user_id, created_by_name, created_at, updated_at, branch_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        );`,
        [
          normalizedOrder.id,
          normalizedOrder.supplierId || null,
          normalizedOrder.supplierName,
          normalizedOrder.supplierPhone || null,
          normalizedOrder.salesRepName || null,
          normalizedOrder.status,
          JSON.stringify(normalizedOrder.items),
          normalizedOrder.totalOrderedPacks,
          normalizedOrder.totalReceivedPacks,
          normalizedOrder.estimatedTotalAmount,
          normalizedOrder.notes || null,
          normalizedOrder.dispatchChannel || null,
          normalizedOrder.sentAt || null,
          normalizedOrder.completedAt || null,
          normalizedOrder.cancelledAt || null,
          JSON.stringify(normalizedOrder.linkedPurchaseInvoiceIds),
          normalizedOrder.createdByUserId || null,
          normalizedOrder.createdByName || null,
          normalizedOrder.createdAt,
          normalizedOrder.updatedAt,
          normalizedOrder.branchId,
        ],
      );
    }

    // 3. إدراج العملية في طابور المزامنة السحابية وحفظها في sync_queue بـ SQLite
    const syncItem = sqliteEngine.enqueueSync(
      "PURCHASE_ORDER",
      syncOperation,
      normalizedOrder.id,
      normalizedOrder,
    );
    await this.persistSyncItemToDesktopSQLite(syncItem);
  }

  async deletePurchaseOrder(id: string): Promise<void> {
    sqliteEngine.commit((draft) => {
      draft.purchaseOrders = (draft.purchaseOrders || []).filter(
        (o) => o.id !== id,
      );
    });

    if (isTauriDesktop() && sqliteRaw) {
      await sqliteRaw.execute("DELETE FROM purchase_orders WHERE id = $1;", [
        id,
      ]);
    }

    const syncItem = sqliteEngine.enqueueSync("PURCHASE_ORDER", "DELETE", id, {
      id,
    });
    await this.persistSyncItemToDesktopSQLite(syncItem);
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
