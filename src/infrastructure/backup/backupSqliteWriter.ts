import { CURRENT_BRANCH_ID } from "../db/database";
import { isTauriDesktop, sqliteRaw } from "../db/connection";
import { BackupSnapshotData } from "./backupValidator";

/**
 * كتابة كامل الجداول داخل pharmacare.db على سطح المكتب ضمن Transaction ذرية واحدة
 * (تُستخدم في كلٍ من الاستعادة من ملف وإعادة ضبط المصنع)
 */
export async function writeSnapshotToDesktopSQLite(
  payload: BackupSnapshotData,
  overwriteUsersTable: boolean,
  overwriteSuppliersTable: boolean,
  overwritePurchaseOrdersTable: boolean,
): Promise<void> {
  if (!isTauriDesktop() || !sqliteRaw) return;

  await sqliteRaw.execute("BEGIN TRANSACTION;");
  try {
    await sqliteRaw.execute("DELETE FROM batches;");
    await sqliteRaw.execute("DELETE FROM products;");
    await sqliteRaw.execute("DELETE FROM invoices;");
    await sqliteRaw.execute("DELETE FROM purchase_invoices;");
    await sqliteRaw.execute("DELETE FROM controlled_drug_logs;");
    await sqliteRaw.execute("DELETE FROM cash_expenses;");
    await sqliteRaw.execute("DELETE FROM shifts;");
    await sqliteRaw.execute("DELETE FROM sync_queue;");
    await sqliteRaw.execute("DELETE FROM ledger_payments;");

    if (overwriteUsersTable) {
      await sqliteRaw.execute("DELETE FROM users;");
    }
    if (overwriteSuppliersTable) {
      await sqliteRaw.execute("DELETE FROM suppliers;");
    }
    if (overwritePurchaseOrdersTable) {
      await sqliteRaw.execute("DELETE FROM purchase_orders;");
    }

    // 1. المنتجات والدفعات (Batches)
    for (const p of payload.products) {
      await sqliteRaw.execute(
        `INSERT OR REPLACE INTO products (
          id, barcode, name, scientific_name, category, pack_price,
          weighted_cost_price, strips_per_pack, stock_packs, stock_loose_strips,
          min_limit, is_controlled, branch_id, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);`,
        [
          p.id,
          p.barcode,
          p.name,
          p.scientificName,
          p.category || "عام",
          p.packPrice,
          p.weightedCostPrice,
          p.stripsPerPack,
          p.stockPacks,
          p.stockLooseStrips,
          p.minLimit,
          p.isControlled ? 1 : 0,
          p.branchId || CURRENT_BRANCH_ID,
          p.updatedAt || new Date().toISOString(),
        ],
      );

      for (const b of p.batches || []) {
        await sqliteRaw.execute(
          `INSERT OR REPLACE INTO batches (
            id, product_id, batch_number, expiry_date, qty_packs, branch_id
          ) VALUES ($1, $2, $3, $4, $5, $6);`,
          [
            b.id,
            p.id,
            b.batchNumber,
            b.expiryDate,
            b.qtyPacks,
            b.branchId || CURRENT_BRANCH_ID,
          ],
        );
      }
    }

    // 2. فواتير المبيعات والمرتجعات
    for (const inv of payload.invoices) {
      await sqliteRaw.execute(
        `INSERT OR REPLACE INTO invoices (
          id, type, payment_mode, customer_name, subtotal, discount_percent,
          total_amount, total_cost_amount, net_profit, items_json, created_at, branch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
        [
          inv.id,
          inv.type,
          inv.paymentMode,
          inv.customerName,
          inv.subtotal,
          inv.discountPercent,
          inv.totalAmount,
          inv.totalCostAmount ?? 0,
          inv.netProfit ?? 0,
          JSON.stringify(inv.items),
          inv.createdAt,
          inv.branchId || CURRENT_BRANCH_ID,
        ],
      );
    }

    // 3. فواتير المشتريات
    for (const pur of payload.purchaseInvoices) {
      await sqliteRaw.execute(
        `INSERT OR REPLACE INTO purchase_invoices (
          id, supplier_name, supplier_invoice_number, payment_mode,
          total_amount, total_bonus_value, items_json, purchase_order_id, created_at, branch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
        [
          pur.id,
          pur.supplierName,
          pur.supplierInvoiceNumber,
          pur.paymentMode,
          pur.totalAmount,
          pur.totalBonusValue,
          JSON.stringify(pur.items),
          pur.purchaseOrderId || null,
          pur.createdAt,
          pur.branchId || CURRENT_BRANCH_ID,
        ],
      );
    }

    // 4. سجل الأدوية المراقبة
    for (const log of payload.controlledLogs) {
      await sqliteRaw.execute(
        `INSERT OR REPLACE INTO controlled_drug_logs (
          id, invoice_id, product_id, product_name, scientific_name,
          barcode, unit, qty, batch_number, patient_name, national_id,
          doctor_name, prescription_id, dispensed_at, branch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);`,
        [
          log.id,
          log.invoiceId,
          log.productId,
          log.productName,
          log.scientificName,
          log.barcode,
          log.unit,
          log.qty,
          log.batchNumber,
          log.patientName,
          log.nationalId,
          log.doctorName,
          log.prescriptionId,
          log.dispensedAt,
          log.branchId || CURRENT_BRANCH_ID,
        ],
      );
    }

    // 5. المصاريف النثرية وخسائر الجرد
    for (const exp of payload.expenses) {
      await sqliteRaw.execute(
        `INSERT OR REPLACE INTO cash_expenses (
          id, title, category, amount, notes, shift_id, created_at, branch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [
          exp.id,
          exp.title,
          exp.category,
          exp.amount,
          exp.notes || null,
          exp.shiftId,
          exp.createdAt,
          exp.branchId || CURRENT_BRANCH_ID,
        ],
      );
    }

    // 6. الورديات والصندوق
    for (const s of payload.shifts) {
      await sqliteRaw.execute(
        `INSERT OR REPLACE INTO shifts (
          id, pharmacist_name, opened_at, closed_at, status,
          opening_balance, cash_sales_total, credit_sales_total,
          returns_total, credit_returns_total, debt_collections_total,
          supplier_payments_total, cash_purchases_total, petty_cash_total,
          expected_drawer_cash, actual_drawer_cash, variance,
          safe_drop_amount, next_shift_float, branch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20);`,
        [
          s.id,
          s.pharmacistName,
          s.openedAt,
          s.closedAt || null,
          s.status,
          s.openingBalance,
          s.cashSalesTotal,
          s.creditSalesTotal,
          s.returnsTotal,
          s.creditReturnsTotal ?? 0,
          s.debtCollectionsTotal ?? 0,
          s.supplierPaymentsTotal ?? 0,
          s.cashPurchasesTotal ?? 0,
          s.pettyCashTotal,
          s.expectedDrawerCash,
          s.actualDrawerCash ?? null,
          s.variance ?? null,
          s.safeDropAmount ?? 0,
          s.nextShiftFloat ?? 0,
          s.branchId || CURRENT_BRANCH_ID,
        ],
      );
    }

    // 7. سندات القبض والصرف (دفتر الديون)
    for (const pay of payload.ledgerPayments) {
      await sqliteRaw.execute(
        `INSERT OR REPLACE INTO ledger_payments (
          id, party_type, party_name, amount, notes, created_at, branch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [
          pay.id,
          pay.partyType,
          pay.partyName,
          pay.amount,
          pay.notes || null,
          pay.createdAt,
          pay.branchId || CURRENT_BRANCH_ID,
        ],
      );
    }

    // 8. طابور المزامنة السحابية
    for (const item of payload.syncQueue) {
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
          item.branchId || CURRENT_BRANCH_ID,
          item.status,
          item.createdAt,
          item.syncedAt || null,
        ],
      );
    }

    // 9. جدول الموظفين والصلاحيات (users)
    if (overwriteUsersTable && payload.users) {
      for (const u of payload.users) {
        await sqliteRaw.execute(
          `INSERT OR REPLACE INTO users (
            id, name, role, pin_code, is_active, permissions_json, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7);`,
          [
            u.id,
            u.name,
            u.role,
            u.pinCode,
            u.isActive ? 1 : 0,
            JSON.stringify(u.permissions),
            u.createdAt,
          ],
        );
      }
    }

    // 10. جدول دليل المستودعات والموردين (suppliers)
    if (overwriteSuppliersTable && payload.suppliers) {
      for (const sup of payload.suppliers) {
        await sqliteRaw.execute(
          `INSERT OR REPLACE INTO suppliers (
            id, name, phone, sales_rep_name, notes, is_active, created_at, branch_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [
            sup.id,
            sup.name,
            sup.phone || null,
            sup.salesRepName || null,
            sup.notes || null,
            sup.isActive ? 1 : 0,
            sup.createdAt,
            sup.branchId || CURRENT_BRANCH_ID,
          ],
        );
      }
    }

    // 11. جدول أوامر الشراء (purchase_orders)
    if (overwritePurchaseOrdersTable && payload.purchaseOrders) {
      for (const order of payload.purchaseOrders) {
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
            order.id,
            order.supplierId || null,
            order.supplierName,
            order.supplierPhone || null,
            order.salesRepName || null,
            order.status,
            JSON.stringify(order.items || []),
            order.totalOrderedPacks || 0,
            order.totalReceivedPacks || 0,
            order.estimatedTotalAmount || 0,
            order.notes || null,
            order.dispatchChannel || null,
            order.sentAt || null,
            order.completedAt || null,
            order.cancelledAt || null,
            JSON.stringify(order.linkedPurchaseInvoiceIds || []),
            order.createdByUserId || null,
            order.createdByName || null,
            order.createdAt,
            order.updatedAt || order.createdAt,
            order.branchId || CURRENT_BRANCH_ID,
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
