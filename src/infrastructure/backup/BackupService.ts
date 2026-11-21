import {
  ProductEntity,
  PurchaseInvoiceEntity,
  ControlledDrugLogEntity,
  CashExpenseEntity,
  ShiftSummaryEntity,
  SyncQueueItemEntity,
  LedgerPaymentEntity,
  PharmacySettingsEntity,
  SupplierEntity,
} from "../../domain/entities";
import { InvoiceEntity } from "../../domain/entities/Invoice";
import {
  UserEntity,
  UserRole,
  UserPermissions,
  ROLE_DEFAULT_PERMISSIONS,
} from "../../domain/entities/User";
import { CURRENT_BRANCH_ID, sqliteEngine } from "../db/database";
import { DEFAULT_ADMIN_USER } from "../db/seedData";
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
    // حقول اختيارية للحفاظ على التوافق العكسي مع ملفات النسخ الاحتياطي القديمة
    users?: UserEntity[];
    suppliers?: SupplierEntity[];
  };
}

/**
 * تطبيع سجل موظف مستعاد من ملف النسخة الاحتياطية لضمان توافق الدور ومفاتيح الصلاحيات
 */
const normalizeBackupUser = (raw: UserEntity): UserEntity => {
  const role: UserRole =
    raw.role === "ADMIN" || raw.role === "PHARMACIST" || raw.role === "CASHIER"
      ? raw.role
      : "CASHIER";

  const incomingPermissions = (raw.permissions ||
    {}) as Partial<UserPermissions>;

  return {
    id: String(raw.id),
    name: String(raw.name || "موظف"),
    role,
    pinCode: String(raw.pinCode || ""),
    isActive: raw.isActive !== false,
    permissions: {
      ...ROLE_DEFAULT_PERMISSIONS[role],
      ...incomingPermissions,
    },
    createdAt: raw.createdAt || new Date().toISOString(),
  };
};

/**
 * تطبيع سجل مستودع مستعاد من ملف النسخة الاحتياطية لضمان توافق الحقول مع جدول suppliers
 */
const normalizeBackupSupplier = (raw: SupplierEntity): SupplierEntity => ({
  id: String(raw.id),
  name: String(raw.name || "").trim(),
  phone: raw.phone ? String(raw.phone).trim() || undefined : undefined,
  salesRepName: raw.salesRepName
    ? String(raw.salesRepName).trim() || undefined
    : undefined,
  notes: raw.notes ? String(raw.notes).trim() || undefined : undefined,
  isActive: raw.isActive !== false,
  createdAt: raw.createdAt || new Date().toISOString(),
  branchId: raw.branchId || CURRENT_BRANCH_ID,
});

export class BackupService {
  /**
   * دالة مساعدة موحدة لكتابة كامل الجداول داخل pharmacare.db على سطح المكتب ضمن Transaction ذرية واحدة
   * (تُستخدم في كلٍ من الاستعادة من ملف وإعادة ضبط المصنع)
   */
  private static async writeSnapshotToDesktopSQLite(
    payload: {
      products: ProductEntity[];
      invoices: InvoiceEntity[];
      purchaseInvoices: PurchaseInvoiceEntity[];
      controlledLogs: ControlledDrugLogEntity[];
      expenses: CashExpenseEntity[];
      shifts: ShiftSummaryEntity[];
      syncQueue: SyncQueueItemEntity[];
      ledgerPayments: LedgerPaymentEntity[];
      users?: UserEntity[];
      suppliers?: SupplierEntity[];
    },
    overwriteUsersTable: boolean,
    overwriteSuppliersTable: boolean,
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

      // استبدال جدول الموظفين فقط عند وجود بيانات موظفين في النسخة أو أثناء إعادة ضبط المصنع
      if (overwriteUsersTable) {
        await sqliteRaw.execute("DELETE FROM users;");
      }

      // استبدال جدول المستودعات فقط عند وجود حقل suppliers في النسخة أو أثناء إعادة ضبط المصنع
      if (overwriteSuppliersTable) {
        await sqliteRaw.execute("DELETE FROM suppliers;");
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

      await sqliteRaw.execute("COMMIT;");
    } catch (err) {
      await sqliteRaw.execute("ROLLBACK;");
      throw err;
    }
  }

  /**
   * تصدير نسخة احتياطية كاملة لجميع جداول قاعدة البيانات والموظفين والمستودعات وإعدادات الصيدلية كملف JSON
   */
  static exportBackupFile(
    stateData: FullBackupPayload["data"],
    settings: PharmacySettingsEntity,
  ): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10);
    const timePart = now.toTimeString().slice(0, 5).replace(":", "-");
    const fileName = `PharmaCare_Backup_${datePart}_${timePart}.json`;

    const resolvedUsers =
      stateData.users && stateData.users.length > 0
        ? stateData.users
        : sqliteEngine.getSnapshot().users || [DEFAULT_ADMIN_USER];

    const resolvedSuppliers = Array.isArray(stateData.suppliers)
      ? stateData.suppliers
      : sqliteEngine.getSnapshot().suppliers || [];

    const backupObject: FullBackupPayload = {
      meta: {
        app: "PharmaCare Pro",
        version: "1.0.0",
        branchId: CURRENT_BRANCH_ID,
        exportedAt: now.toISOString(),
      },
      settings,
      data: {
        ...stateData,
        users: resolvedUsers,
        suppliers: resolvedSuppliers,
      },
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
   * قراءة ملف النسخة الاحتياطية والتحقق من سلامته واستعادة كافة الجداول (بما فيها الموظفين والمستودعات)
   * في SQLite (pharmacare.db) وفي الذاكرة المحلية بأمان كامل
   */
  static async restoreFromBackupFile(file: File): Promise<{
    productsCount: number;
    invoicesCount: number;
    usersCount: number;
    suppliersCount: number;
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
      users: rawUsers,
      suppliers: rawSuppliers,
    } = parsed.data;

    // معالجة الموظفين: إذا كان الملف يحتوي على قائمة موظفين نُطبّع صلاحياتهم ونستعيدهم،
    // وإذا كان ملفاً قديماً بدون users نُبقي على الموظفين الحاليين لتجنب قفل النظام
    const hasUsersInBackup = Array.isArray(rawUsers) && rawUsers.length > 0;
    let normalizedUsers: UserEntity[] | undefined;

    if (hasUsersInBackup) {
      normalizedUsers = rawUsers.map(normalizeBackupUser);
      // ضمان وجود مدير نشط واحد على الأقل لتفادي إغلاق النظام بالكامل
      const hasActiveAdmin = normalizedUsers.some(
        (u) => u.role === "ADMIN" && u.isActive,
      );
      if (!hasActiveAdmin) {
        normalizedUsers.unshift(DEFAULT_ADMIN_USER);
      }
    }

    // معالجة المستودعات: استعادتها مع منع تكرار الأسماء إن وُجدت في النسخة، أو الإبقاء على الحالية للنسخ القديمة
    const hasSuppliersInBackup = Array.isArray(rawSuppliers);
    let normalizedSuppliers: SupplierEntity[] | undefined;

    if (hasSuppliersInBackup) {
      const seenNames = new Set<string>();
      normalizedSuppliers = [];
      for (const rawSup of rawSuppliers) {
        const sup = normalizeBackupSupplier(rawSup);
        if (!sup.name) continue;
        const key = sup.name.toLowerCase();
        if (seenNames.has(key)) continue;
        seenNames.add(key);
        normalizedSuppliers.push(sup);
      }
    }

    // 1. تنفيذ الاستعادة أولاً داخل SQLite (pharmacare.db) في معاملة ذرية واحدة
    await BackupService.writeSnapshotToDesktopSQLite(
      {
        products,
        invoices,
        purchaseInvoices,
        controlledLogs,
        expenses,
        shifts,
        syncQueue,
        ledgerPayments,
        users: normalizedUsers,
        suppliers: normalizedSuppliers,
      },
      hasUsersInBackup,
      hasSuppliersInBackup,
    );

    // 2. استعادة إعدادات الصيدلية إن وجدت داخل النسخة الاحتياطية
    if (parsed.settings) {
      SettingsService.saveSettings(parsed.settings);
    }

    // 3. تحديث المحرك المحلي (sqliteEngine) بعد نجاح الكتابة على سطح المكتب
    sqliteEngine.commit((draft) => {
      draft.products = products;
      draft.invoices = invoices;
      draft.purchaseInvoices = purchaseInvoices;
      draft.controlledLogs = controlledLogs;
      draft.expenses = expenses;
      draft.shifts = shifts;
      draft.syncQueue = syncQueue;
      draft.ledgerPayments = ledgerPayments;
      if (normalizedUsers) {
        draft.users = normalizedUsers;
      }
      if (normalizedSuppliers) {
        draft.suppliers = normalizedSuppliers;
      }
    });

    return {
      productsCount: products.length,
      invoicesCount: invoices.length,
      usersCount:
        normalizedUsers?.length ??
        sqliteEngine.getSnapshot().users?.length ??
        1,
      suppliersCount:
        normalizedSuppliers?.length ??
        sqliteEngine.getSnapshot().suppliers?.length ??
        0,
      exportedAt: parsed.meta?.exportedAt || new Date().toISOString(),
    };
  }

  /**
   * إعادة ضبط المصنع الكاملة (تصفير الذاكرة و localStorage وكافة الجداول التشغيلية في pharmacare.db
   * وإعادة زرع البيانات الأولية والوردية الافتراضية والمدير الافتراضي مع الحفاظ على إعدادات الصيدلية والطابعة)
   */
  static async resetDatabaseToFactory(): Promise<void> {
    const freshSnapshot = sqliteEngine.resetToFactory();

    await BackupService.writeSnapshotToDesktopSQLite(
      {
        products: freshSnapshot.products,
        invoices: freshSnapshot.invoices,
        purchaseInvoices: freshSnapshot.purchaseInvoices,
        controlledLogs: freshSnapshot.controlledLogs,
        expenses: freshSnapshot.expenses,
        shifts: freshSnapshot.shifts,
        syncQueue: freshSnapshot.syncQueue,
        ledgerPayments: freshSnapshot.ledgerPayments,
        users: freshSnapshot.users,
        suppliers: freshSnapshot.suppliers,
      },
      true,
      true,
    );
  }
}
