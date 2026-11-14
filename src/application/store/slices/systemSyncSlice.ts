import { pushBatchToCloudServer } from "../../../infrastructure/tauri/system";
import { SettingsService } from "../../../infrastructure/config/SettingsService";
import { BackupService } from "../../../infrastructure/backup/BackupService";
import { sqliteEngine } from "../../../infrastructure/db/database";
import { PosState, PosSlice, productRepo, invoiceRepo } from "../storeTypes";

export type SystemSyncSlice = Pick<
  PosState,
  | "products"
  | "invoices"
  | "purchaseInvoices"
  | "controlledLogs"
  | "expenses"
  | "shifts"
  | "syncQueue"
  | "ledgerPayments"
  | "settings"
  | "notification"
  | "loadInitialData"
  | "updatePharmacySettings"
  | "setNotification"
  | "syncPendingBatchToCloud"
  | "exportDatabaseBackup"
  | "restoreDatabaseBackup"
  | "resetDemoDatabase"
>;

export const createSystemSyncSlice: PosSlice<SystemSyncSlice> = (set, get) => ({
  products: sqliteEngine.getSnapshot().products,
  invoices: sqliteEngine.getSnapshot().invoices,
  purchaseInvoices: sqliteEngine.getSnapshot().purchaseInvoices,
  controlledLogs: sqliteEngine.getSnapshot().controlledLogs,
  expenses: sqliteEngine.getSnapshot().expenses,
  shifts: sqliteEngine.getSnapshot().shifts,
  syncQueue: sqliteEngine.getSnapshot().syncQueue,
  ledgerPayments: sqliteEngine.getSnapshot().ledgerPayments,
  settings: SettingsService.getSettings(),
  notification: null,

  loadInitialData: async () => {
    const [
      products,
      invoices,
      purchaseInvoices,
      controlledLogs,
      expenses,
      shifts,
      syncQueue,
      ledgerPayments,
      syncedSettings,
    ] = await Promise.all([
      productRepo.getAllProducts(),
      invoiceRepo.getAllInvoices(),
      invoiceRepo.getAllPurchaseInvoices(),
      invoiceRepo.getControlledDrugLogs(),
      invoiceRepo.getAllExpenses(),
      invoiceRepo.getShifts(),
      invoiceRepo.getSyncQueue(),
      invoiceRepo.getLedgerPayments(),
      SettingsService.syncFromSQLite(),
    ]);
    set({
      products,
      invoices,
      purchaseInvoices,
      controlledLogs,
      expenses,
      shifts,
      syncQueue,
      ledgerPayments,
      settings: syncedSettings,
    });
  },

  updatePharmacySettings: (newSettings) => {
    const saved = SettingsService.saveSettings(newSettings);
    set({
      settings: saved,
      notification: {
        type: "success",
        message: "تم حفظ إعدادات الصيدلية والطابعة والمزامنة بنجاح.",
      },
    });
  },

  setNotification: (notification) => {
    set({ notification });
  },

  syncPendingBatchToCloud: async () => {
    const pending = get().syncQueue.filter((i) => i.status === "PENDING");
    const result = await pushBatchToCloudServer(pending);
    if (result.syncedIds.length > 0) {
      await invoiceRepo.markSyncItemsCompleted(result.syncedIds);
      await get().loadInitialData();
    }
    set({
      notification: {
        type: "success",
        message:
          result.syncedCount > 0
            ? `تمت مزامنة حزمة العمليات (${result.syncedCount} حركة) بنجاح إلى السيرفر السحابي [${result.batchId}]`
            : "جميع السجلات المحلية متزامنة بالفعل مع السحابة المركزية.",
      },
    });
    return { syncedCount: result.syncedCount, batchId: result.batchId };
  },

  exportDatabaseBackup: () => {
    const state = get();
    const fileName = BackupService.exportBackupFile(
      {
        products: state.products,
        invoices: state.invoices,
        purchaseInvoices: state.purchaseInvoices,
        controlledLogs: state.controlledLogs,
        expenses: state.expenses,
        shifts: state.shifts,
        syncQueue: state.syncQueue,
        ledgerPayments: state.ledgerPayments,
      },
      state.settings,
    );

    set({
      notification: {
        type: "success",
        message: `تم تصدير النسخة الاحتياطية الكاملة بنجاح (${fileName}).`,
      },
    });
  },

  restoreDatabaseBackup: async (file) => {
    try {
      const summary = await BackupService.restoreFromBackupFile(file);
      get().clearCart();
      await get().loadInitialData();
      set({
        heldInvoices: [],
        notification: {
          type: "success",
          message: `تمت استعادة النسخة الاحتياطية بنجاح (${summary.productsCount} صنف دوائي، ${summary.invoicesCount} فاتورة).`,
        },
      });
    } catch (err) {
      set({
        notification: {
          type: "error",
          message:
            err instanceof Error
              ? err.message
              : "فشل استعادة النسخة الاحتياطية.",
        },
      });
    }
  },

  resetDemoDatabase: async () => {
    sqliteEngine.resetToFactory();
    get().clearCart();
    await get().loadInitialData();
    set({
      heldInvoices: [],
      notification: {
        type: "info",
        message: "تمت إعادة ضبط قاعدة البيانات المحلية للبيانات الافتراضية.",
      },
    });
  },
});
