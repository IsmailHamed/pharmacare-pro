import { PharmacySettingsEntity } from "../../domain/entities";
import { CURRENT_BRANCH_ID, sqliteEngine } from "../db/database";
import { DEFAULT_ADMIN_USER } from "../db/seedData";
import { SettingsService } from "../config/SettingsService";
import {
  FullBackupPayload,
  parseAndValidateBackupJson,
} from "./backupValidator";
import { writeSnapshotToDesktopSQLite } from "./backupSqliteWriter";

export type { FullBackupPayload };

export class BackupService {
  /**
   * تصدير نسخة احتياطية كاملة لجميع جداول قاعدة البيانات والموظفين والمستودعات وأوامر الشراء وإعدادات الصيدلية كملف JSON
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

    const resolvedPurchaseOrders = Array.isArray(stateData.purchaseOrders)
      ? stateData.purchaseOrders
      : sqliteEngine.getSnapshot().purchaseOrders || [];

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
        purchaseOrders: resolvedPurchaseOrders,
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
   * قراءة ملف النسخة الاحتياطية والتحقق من سلامته واستعادة كافة الجداول
   * في SQLite (pharmacare.db) وفي الذاكرة المحلية بأمان كامل
   */
  static async restoreFromBackupFile(file: File): Promise<{
    productsCount: number;
    invoicesCount: number;
    usersCount: number;
    suppliersCount: number;
    purchaseOrdersCount: number;
    exportedAt: string;
  }> {
    const rawText = await file.text();
    const {
      snapshot,
      settings,
      exportedAt,
      overwriteUsersTable,
      overwriteSuppliersTable,
      overwritePurchaseOrdersTable,
    } = parseAndValidateBackupJson(rawText);

    // 1. تنفيذ الاستعادة أولاً داخل SQLite (pharmacare.db) في معاملة ذرية واحدة
    await writeSnapshotToDesktopSQLite(
      snapshot,
      overwriteUsersTable,
      overwriteSuppliersTable,
      overwritePurchaseOrdersTable,
    );

    // 2. استعادة إعدادات الصيدلية إن وجدت داخل النسخة الاحتياطية
    if (settings) {
      SettingsService.saveSettings(settings);
    }

    // 3. تحديث المحرك المحلي (sqliteEngine) بعد نجاح الكتابة على سطح المكتب
    sqliteEngine.commit((draft) => {
      draft.products = snapshot.products;
      draft.invoices = snapshot.invoices;
      draft.purchaseInvoices = snapshot.purchaseInvoices;
      draft.controlledLogs = snapshot.controlledLogs;
      draft.expenses = snapshot.expenses;
      draft.shifts = snapshot.shifts;
      draft.syncQueue = snapshot.syncQueue;
      draft.ledgerPayments = snapshot.ledgerPayments;
      if (snapshot.users) {
        draft.users = snapshot.users;
      }
      if (snapshot.suppliers) {
        draft.suppliers = snapshot.suppliers;
      }
      if (snapshot.purchaseOrders) {
        draft.purchaseOrders = snapshot.purchaseOrders;
      }
    });

    return {
      productsCount: snapshot.products.length,
      invoicesCount: snapshot.invoices.length,
      usersCount:
        snapshot.users?.length ?? sqliteEngine.getSnapshot().users?.length ?? 1,
      suppliersCount:
        snapshot.suppliers?.length ??
        sqliteEngine.getSnapshot().suppliers?.length ??
        0,
      purchaseOrdersCount:
        snapshot.purchaseOrders?.length ??
        sqliteEngine.getSnapshot().purchaseOrders?.length ??
        0,
      exportedAt,
    };
  }

  /**
   * إعادة ضبط المصنع الكاملة (تصفير الذاكرة و localStorage وكافة الجداول التشغيلية في pharmacare.db
   * وإعادة زرع البيانات الأولية والوردية الافتراضية والمدير الافتراضي مع الحفاظ على إعدادات الصيدلية والطابعة)
   */
  static async resetDatabaseToFactory(): Promise<void> {
    const freshSnapshot = sqliteEngine.resetToFactory();

    await writeSnapshotToDesktopSQLite(
      {
        products: freshSnapshot.products,
        invoices: freshSnapshot.invoices,
        purchaseInvoices: freshSnapshot.purchaseInvoices,
        purchaseOrders: freshSnapshot.purchaseOrders,
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
      true,
    );
  }
}
