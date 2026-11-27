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
  supplierRepo,
  purchaseOrderRepo,
} from "../storeTypes";
import { UserEntity } from "../../../domain/entities/User";
import { SupplierEntity } from "../../../domain/entities/Supplier";
import { DEFAULT_ADMIN_USER } from "../../../infrastructure/db/seedData";

// دالة مساعدة لاستنتاج activeRole ديناميكياً من المستخدم الحالي للحفاظ على التوافقية العكسية
const deriveActiveRole = (user: UserEntity | null): "CASHIER" | "ADMIN" => {
  if (!user) return "CASHIER";
  return user.role === "ADMIN" ? "ADMIN" : "CASHIER";
};

export type SystemSyncSlice = Pick<
  PosState,
  | "products"
  | "invoices"
  | "purchaseInvoices"
  | "purchaseOrders"
  | "controlledLogs"
  | "expenses"
  | "shifts"
  | "syncQueue"
  | "ledgerPayments"
  | "suppliers"
  | "settings"
  | "notification"
  | "users"
  | "currentUser"
  | "activeRole"
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
  | "loadSuppliers"
  | "addOrUpdateSupplier"
  | "toggleSupplierStatus"
>;

export const createSystemSyncSlice: PosSlice<SystemSyncSlice> = (set, get) => ({
  products: sqliteEngine.getSnapshot().products,
  invoices: sqliteEngine.getSnapshot().invoices,
  purchaseInvoices: sqliteEngine.getSnapshot().purchaseInvoices,
  purchaseOrders: sqliteEngine.getSnapshot().purchaseOrders || [],
  controlledLogs: sqliteEngine.getSnapshot().controlledLogs,
  expenses: sqliteEngine.getSnapshot().expenses,
  shifts: sqliteEngine.getSnapshot().shifts,
  syncQueue: sqliteEngine.getSnapshot().syncQueue,
  ledgerPayments: sqliteEngine.getSnapshot().ledgerPayments,
  suppliers: sqliteEngine.getSnapshot().suppliers || [],
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
      purchaseOrders,
      controlledLogs,
      expenses,
      shifts,
      syncQueue,
      ledgerPayments,
      suppliers,
      syncedSettings,
    ] = await Promise.all([
      productRepo.getAllProducts(),
      invoiceRepo.getAllInvoices(),
      invoiceRepo.getAllPurchaseInvoices(),
      purchaseOrderRepo.getAllPurchaseOrders(),
      invoiceRepo.getControlledDrugLogs(),
      invoiceRepo.getAllExpenses(),
      invoiceRepo.getShifts(),
      invoiceRepo.getSyncQueue(),
      invoiceRepo.getLedgerPayments(),
      supplierRepo.getAllSuppliers(),
      SettingsService.syncFromSQLite(),
    ]);
    set({
      products,
      invoices,
      purchaseInvoices,
      purchaseOrders,
      controlledLogs,
      expenses,
      shifts,
      syncQueue,
      ledgerPayments,
      suppliers,
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

    // إذا لم تكن هناك عمليات معلقة، نُبلغ المستخدم مباشرة دون إرسال طلب فارغ
    if (pending.length === 0) {
      const batchId = `BATCH-${Date.now()}`;
      set({
        notification: {
          type: "info",
          message: "جميع السجلات المحلية متزامنة بالفعل مع السحابة المركزية.",
        },
      });
      return { syncedCount: 0, batchId };
    }

    const result = await pushBatchToCloudServer(pending);

    // في حال فشل الاتصال أو رفض السيرفر للدفعة، تبقى العمليات PENDING دون فقدان
    if (!result.success) {
      set({
        notification: {
          type: "error",
          message:
            result.error ||
            "فشلت المزامنة مع السيرفر السحابي — ستبقى الحركات محفوظة محلياً لإعادة المحاولة لاحقاً.",
        },
      });
      return { syncedCount: 0, batchId: result.batchId };
    }

    // لا يتم تعليم العناصر كمزامنة إلا بعد تأكيد السيرفر الصريح
    if (result.syncedIds.length > 0) {
      await invoiceRepo.markSyncItemsCompleted(result.syncedIds);
      await get().loadInitialData();
    }

    set({
      notification: {
        type: "success",
        message: `تمت مزامنة حزمة العمليات (${result.syncedCount} حركة) بنجاح إلى السيرفر السحابي [${result.batchId}]`,
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
        purchaseOrders: state.purchaseOrders,
        controlledLogs: state.controlledLogs,
        expenses: state.expenses,
        shifts: state.shifts,
        syncQueue: state.syncQueue,
        ledgerPayments: state.ledgerPayments,
        users: state.users,
        suppliers: state.suppliers,
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
        pendingOrderForInvoice: null,
        notification: {
          type: "success",
          message: `تمت استعادة النسخة الاحتياطية بنجاح (${summary.productsCount} صنف دوائي، ${summary.invoicesCount} فاتورة، ${summary.suppliersCount} مستودع، ${summary.purchaseOrdersCount} أمر شراء، ${summary.usersCount} موظف).`,
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
    try {
      await BackupService.resetDatabaseToFactory();
      get().clearCart();
      await get().loadInitialData();
      set({
        heldInvoices: [],
        pendingOrderForInvoice: null,
        notification: {
          type: "info",
          message:
            "تمت إعادة ضبط قاعدة البيانات المحلية (SQLite) للبيانات الافتراضية بنجاح.",
        },
      });
    } catch (err) {
      set({
        notification: {
          type: "error",
          message:
            err instanceof Error
              ? err.message
              : "فشل إعادة ضبط قاعدة البيانات المحلية.",
        },
      });
    }
  },

  loadUsers: async () => {
    let allUsers = await userRepo.getAllUsers();
    if (!allUsers || allUsers.length === 0) {
      // زرع المدير الافتراضي في SQLite وطابور المزامنة عند أول تشغيل
      await userRepo.upsertUser(DEFAULT_ADMIN_USER);
      allUsers = [DEFAULT_ADMIN_USER];
    }

    // تحديث طابور المزامنة في الحالة ليظهر عدد حركات الموظفين المعلقة فوراً في الشريط العلوي
    const syncQueue = await invoiceRepo.getSyncQueue();

    const current = get().currentUser;
    // تحديث بيانات المستخدم الحالي إذا تم تعديل صلاحياته، أو اختيار أول مستخدم نشط
    const resolvedCurrent = current
      ? allUsers.find((u) => u.id === current.id && u.isActive) ||
        allUsers.find((u) => u.isActive) ||
        null
      : allUsers.find((u) => u.isActive) || null;

    set({
      users: allUsers,
      syncQueue,
      currentUser: resolvedCurrent,
      activeRole: deriveActiveRole(resolvedCurrent),
    });
  },

  addOrUpdateUser: async (user: UserEntity) => {
    try {
      await userRepo.upsertUser(user);
      await get().loadUsers();
      set({
        notification: {
          type: "success",
          message: `تم حفظ بيانات وصلاحيات الموظف (${user.name}) بنجاح وإدراجها للمزامنة.`,
        },
      });
    } catch (err) {
      // عرض رسالة واضحة عند تكرار الـ PIN أو حدوث خطأ في الحفظ
      set({
        notification: {
          type: "error",
          message:
            err instanceof Error ? err.message : "تعذر حفظ بيانات الموظف.",
        },
      });
    }
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

    try {
      await userRepo.toggleUserStatus(userId, !target.isActive);
      await get().loadUsers();
      set({
        notification: {
          type: "info",
          message: `تم ${!target.isActive ? "تفعيل" : "تجميد"} حساب (${target.name}).`,
        },
      });
    } catch (err) {
      set({
        notification: {
          type: "error",
          message:
            err instanceof Error ? err.message : "تعذر تحديث حالة حساب الموظف.",
        },
      });
    }
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

  loadSuppliers: async () => {
    const [allSuppliers, syncQueue] = await Promise.all([
      supplierRepo.getAllSuppliers(),
      invoiceRepo.getSyncQueue(),
    ]);
    set({ suppliers: allSuppliers, syncQueue });
  },

  addOrUpdateSupplier: async (supplier: SupplierEntity) => {
    try {
      await supplierRepo.upsertSupplier(supplier);
      await get().loadSuppliers();
      set({
        notification: {
          type: "success",
          message: `تم حفظ بيانات المستودع (${supplier.name.trim()}) بنجاح وإدراجها للمزامنة.`,
        },
      });
      return true;
    } catch (err) {
      set({
        notification: {
          type: "error",
          message:
            err instanceof Error ? err.message : "تعذر حفظ بيانات المستودع.",
        },
      });
      return false;
    }
  },

  toggleSupplierStatus: async (supplierId: string) => {
    const target = get().suppliers.find((s) => s.id === supplierId);
    if (!target) return;

    try {
      await supplierRepo.toggleSupplierStatus(supplierId, !target.isActive);
      await get().loadSuppliers();
      set({
        notification: {
          type: "info",
          message: `تم ${!target.isActive ? "تفعيل" : "تجميد"} المستودع (${target.name}).`,
        },
      });
    } catch (err) {
      set({
        notification: {
          type: "error",
          message:
            err instanceof Error ? err.message : "تعذر تحديث حالة المستودع.",
        },
      });
    }
  },
});
