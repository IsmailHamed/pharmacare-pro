import {
  ProductEntity,
  PurchaseInvoiceEntity,
  ControlledDrugLogEntity,
  CashExpenseEntity,
  ShiftSummaryEntity,
  SyncQueueItemEntity,
  LedgerPaymentEntity,
  PharmacySettingsEntity,
} from "../../domain/entities";
import { InvoiceEntity } from "../../domain/entities/Invoice";
import { CURRENT_BRANCH_ID, sqliteEngine } from "../db/database";
import { isTauriDesktop, sqliteRaw } from "../db/connection";
import { SettingsService } from "../config/SettingsService";

export interface FullBackupPayload {
  meta: {
    app: "PharmaCare Pro";
    version: "1.0.0";
    branchId: string;
    exportedAt: string;
  };
  settings: PharmacySettingsEntity;
  data: {
    products: ProductEntity[];
    invoices: InvoiceEntity[];
    purchaseInvoices: PurchaseInvoiceEntity[];
    controlledLogs: ControlledDrugLogEntity[];
    expenses: CashExpenseEntity[];
    shifts: ShiftSummaryEntity[];
    syncQueue: SyncQueueItemEntity[];
    ledgerPayments: LedgerPaymentEntity[];
  };
}

export class BackupService {
  /**
   * تصدير نسخة احتياطية كاملة لجميع جداول قاعدة البيانات وإعدادات الصيدلية كملف JSON
   */
  static exportBackupFile(
    stateData: FullBackupPayload["data"],
    settings: PharmacySettingsEntity,
  ): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10);
    const timePart = now.toTimeString().slice(0, 5).replace(":", "-");
    const fileName = `PharmaCare_Backup_${datePart}_${timePart}.json`;

    const backupObject: FullBackupPayload = {
      meta: {
        app: "PharmaCare Pro",
        version: "1.0.0",
        branchId: CURRENT_BRANCH_ID,
        exportedAt: now.toISOString(),
      },
      settings,
      data: stateData,
    };

    const jsonString = JSON.stringify(backupObject, null, 2);
    const blob = new Blob([jsonString], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return fileName;
  }

  /**
   * قراءة ملف النسخة الاحتياطية والتحقق من سلامته واستعادة كافة الجداول في الذاكرة وفي SQLite (pharmacare.db)
   */
  static async restoreFromBackupFile(file: File): Promise<{
    productsCount: number;
    invoicesCount: number;
    exportedAt: string;
  }> {
    const rawText = await file.text();
    let parsed: FullBackupPayload;

    try {
      parsed = JSON.parse(rawText) as FullBackupPayload;
    } catch {
      throw new Error("ملف النسخة الاحتياطية تالف أو ليس بصيغة JSON صالحة.");
    }

    if (
      !parsed ||
      !parsed.data ||
      !Array.isArray(parsed.data.products) ||
      !Array.isArray(parsed.data.invoices)
    ) {
      throw new Error(
        "تركيب ملف النسخة الاحتياطية غير متوافق مع نظام PharmaCare Pro.",
      );
    }

    const {
      products = [],
      invoices = [],
      purchaseInvoices = [],
      controlledLogs = [],
      expenses = [],
      shifts = [],
      syncQueue = [],
      ledgerPayments = [],
    } = parsed.data;

    // 1. استعادة إعدادات الصيدلية إن وجدت داخل النسخة الاحتياطية
    if (parsed.settings) {
      SettingsService.saveSettings(parsed.settings);
    }

    // 2. تحديث المحرك المحلي (sqliteEngine)
    sqliteEngine.commit((draft) => {
      draft.products = products;
      draft.invoices = invoices;
      draft.purchaseInvoices = purchaseInvoices;
      draft.controlledLogs = controlledLogs;
      draft.expenses = expenses;
      draft.shifts = shifts;
      draft.syncQueue = syncQueue;
      draft.ledgerPayments = ledgerPayments;
    });

    // 3. إذا كنا على تطبيق سطح المكتب (Tauri SQLite pharmacare.db)، نعيد كتابة الجداول الفعلية
    if (isTauriDesktop() && sqliteRaw) {
      await sqliteRaw.execute("DELETE FROM batches;");
      await sqliteRaw.execute("DELETE FROM products;");
      await sqliteRaw.execute("DELETE FROM invoices;");
      await sqliteRaw.execute("DELETE FROM purchase_invoices;");
      await sqliteRaw.execute("DELETE FROM controlled_drug_logs;");
      await sqliteRaw.execute("DELETE FROM cash_expenses;");
      await sqliteRaw.execute("DELETE FROM shifts;");
      await sqliteRaw.execute("DELETE FROM sync_queue;");
      await sqliteRaw.execute("DELETE FROM ledger_payments;");

      // استعادة المنتجات والدفعات (Batches)
      for (const p of products) {
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

      // استعادة فواتير المبيعات والمرتجعات
      for (const inv of invoices) {
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

      // استعادة فواتير المشتريات
      for (const pur of purchaseInvoices) {
        await sqliteRaw.execute(
          `INSERT OR REPLACE INTO purchase_invoices (
            id, supplier_name, supplier_invoice_number, payment_mode,
            total_amount, total_bonus_value, items_json, created_at, branch_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
          [
            pur.id,
            pur.supplierName,
            pur.supplierInvoiceNumber,
            pur.paymentMode,
            pur.totalAmount,
            pur.totalBonusValue,
            JSON.stringify(pur.items),
            pur.createdAt,
            pur.branchId || CURRENT_BRANCH_ID,
          ],
        );
      }

      // استعادة سجل الأدوية المراقبة
      for (const log of controlledLogs) {
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

      // استعادة المصاريف النثرية
      for (const exp of expenses) {
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

      // استعادة الورديات
      for (const s of shifts) {
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

      // استعادة سندات القبض والصرف (دفتر الديون)
      for (const pay of ledgerPayments) {
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

      // استعادة طابور المزامنة
      for (const item of syncQueue) {
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
    }

    return {
      productsCount: products.length,
      invoicesCount: invoices.length,
      exportedAt: parsed.meta?.exportedAt || new Date().toISOString(),
    };
  }
}
