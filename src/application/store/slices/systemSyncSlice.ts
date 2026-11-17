import { pushBatchToCloudServer } from "../../../infrastructure/tauri/system";
import { SettingsService } from "../../../infrastructure/config/SettingsService";
import { BackupService } from "../../../infrastructure/backup/BackupService";
import { sqliteEngine } from "../../../infrastructure/db/database";
import {
  PosState,
  PosSlice,
  productRepo,
  invoiceRepo,
  userRepo,
} from "../storeTypes";
import { UserEntity } from "../../../domain/entities/User";
import { DEFAULT_ADMIN_USER } from "../../../infrastructure/db/seedData";

// دالة مساعدة لاستنتاج activeRole ديناميكياً من المستخدم الحالي
const deriveActiveRole = (user: UserEntity | null): "CASHIER" | "ADMIN" => {
  if (!user) return "CASHIER";
  return user.role === "ADMIN" ? "ADMIN" : "CASHIER";
};

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
  | "loadUsers"
  | "addOrUpdateUser"
  | "toggleUserStatus"
  | "loginWithPinOrBarcode"
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
  users: [DEFAULT_ADMIN_USER],
  currentUser: DEFAULT_ADMIN_USER,
  activeRole: "ADMIN",

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
    await get().loadUsers();
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

  loadUsers: async () => {
    let allUsers = await userRepo.getAllUsers();
    if (!allUsers || allUsers.length === 0) {
      await userRepo.upsertUser(DEFAULT_ADMIN_USER);
      allUsers = [DEFAULT_ADMIN_USER];
    }

    const current = get().currentUser;
    // تحديث بيانات المستخدم الحالي إذا تم تعديل صلاحياته، أو اختيار أول مستخدم نشط
    const resolvedCurrent = current
      ? allUsers.find((u) => u.id === current.id && u.isActive) ||
        allUsers.find((u) => u.isActive) ||
        null
      : allUsers.find((u) => u.isActive) || null;

    set({
      users: allUsers,
      currentUser: resolvedCurrent,
      activeRole: deriveActiveRole(resolvedCurrent),
    });
  },

  addOrUpdateUser: async (user: UserEntity) => {
    await userRepo.upsertUser(user);
    await get().loadUsers();
    set({
      notification: {
        type: "success",
        message: `تم حفظ بيانات وصلاحيات الموظف (${user.name}) بنجاح.`,
      },
    });
  },

  toggleUserStatus: async (userId: string) => {
    const target = get().users.find((u) => u.id === userId);
    if (!target) return;

    // حماية ضد تعطيل آخر مدير نشط في النظام
    if (target.role === "ADMIN" && target.isActive) {
      const activeAdmins = get().users.filter(
        (u) => u.role === "ADMIN" && u.isActive,
      );
      if (activeAdmins.length <= 1) {
        set({
          notification: {
            type: "error",
            message: "لا يمكن تجميد حساب مدير النظام الوحيد النشط!",
          },
        });
        return;
      }
    }

    await userRepo.toggleUserStatus(userId, !target.isActive);
    await get().loadUsers();
    set({
      notification: {
        type: "info",
        message: `تم ${!target.isActive ? "تفعيل" : "تجميد"} حساب (${target.name}).`,
      },
    });
  },

  loginWithPinOrBarcode: async (credential: string) => {
    const cleanCred = credential.trim();
    if (!cleanCred) return false;

    const matchedUser = await userRepo.getUserByPin(cleanCred);
    if (!matchedUser) {
      set({
        notification: {
          type: "error",
          message: "الرمز السري (PIN) غير صحيح أو الحساب مجمد!",
        },
      });
      return false;
    }

    set({
      currentUser: matchedUser,
      activeRole: deriveActiveRole(matchedUser),
      notification: {
        type: "success",
        message: `تم تبديل المستخدم إلى: ${matchedUser.name} (${
          matchedUser.role === "ADMIN"
            ? "مدير النظام"
            : matchedUser.role === "PHARMACIST"
              ? "صيدلي"
              : "كاشير"
        })`,
      },
    });
    return true;
  },
});
