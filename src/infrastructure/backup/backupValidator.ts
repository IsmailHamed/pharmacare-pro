import {
  CashExpenseEntity,
  ControlledDrugLogEntity,
  LedgerPaymentEntity,
  PharmacySettingsEntity,
  ProductEntity,
  PurchaseInvoiceEntity,
  PurchaseOrderEntity,
  PurchaseOrderStatus,
  ShiftSummaryEntity,
  SupplierEntity,
  SyncQueueItemEntity,
} from "../../domain/entities";
import { InvoiceEntity } from "../../domain/entities/Invoice";
import {
  ROLE_DEFAULT_PERMISSIONS,
  UserEntity,
  UserPermissions,
  UserRole,
} from "../../domain/entities/User";
import { CURRENT_BRANCH_ID } from "../db/database";
import { DEFAULT_ADMIN_USER } from "../db/seedData";

export interface BackupSnapshotData {
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
  purchaseOrders?: PurchaseOrderEntity[];
}

export interface FullBackupPayload {
  meta: {
    app: "PharmaCare Pro";
    version: "1.0.0";
    branchId: string;
    exportedAt: string;
  };
  settings: PharmacySettingsEntity;
  data: BackupSnapshotData;
}

export interface NormalizedRestorePayload {
  snapshot: BackupSnapshotData;
  settings?: PharmacySettingsEntity;
  exportedAt: string;
  overwriteUsersTable: boolean;
  overwriteSuppliersTable: boolean;
  overwritePurchaseOrdersTable: boolean;
}

/**
 * تطبيع سجل موظف مستعاد من ملف النسخة الاحتياطية لضمان توافق الدور ومفاتيح الصلاحيات
 */
export const normalizeBackupUser = (raw: UserEntity): UserEntity => {
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
export const normalizeBackupSupplier = (
  raw: SupplierEntity,
): SupplierEntity => ({
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

/**
 * تطبيع سجل أمر شراء مستعاد من ملف النسخة الاحتياطية لضمان توافق الحقول مع جدول purchase_orders
 */
export const normalizeBackupPurchaseOrder = (
  raw: PurchaseOrderEntity,
): PurchaseOrderEntity => {
  const validStatuses: PurchaseOrderStatus[] = [
    "DRAFT",
    "SENT",
    "PARTIAL",
    "RECEIVED",
    "CANCELLED",
  ];
  const status: PurchaseOrderStatus = validStatuses.includes(raw.status)
    ? raw.status
    : "DRAFT";
  const createdAt = raw.createdAt || new Date().toISOString();

  return {
    id: String(raw.id),
    supplierId: raw.supplierId ? String(raw.supplierId) : undefined,
    supplierName: String(raw.supplierName || "").trim(),
    supplierPhone: raw.supplierPhone
      ? String(raw.supplierPhone).trim() || undefined
      : undefined,
    salesRepName: raw.salesRepName
      ? String(raw.salesRepName).trim() || undefined
      : undefined,
    status,
    items: Array.isArray(raw.items) ? raw.items : [],
    totalOrderedPacks: Number(raw.totalOrderedPacks || 0),
    totalReceivedPacks: Number(raw.totalReceivedPacks || 0),
    estimatedTotalAmount: Number(raw.estimatedTotalAmount || 0),
    notes: raw.notes ? String(raw.notes).trim() || undefined : undefined,
    dispatchChannel: raw.dispatchChannel,
    sentAt: raw.sentAt ? String(raw.sentAt) : undefined,
    completedAt: raw.completedAt ? String(raw.completedAt) : undefined,
    cancelledAt: raw.cancelledAt ? String(raw.cancelledAt) : undefined,
    linkedPurchaseInvoiceIds: Array.isArray(raw.linkedPurchaseInvoiceIds)
      ? raw.linkedPurchaseInvoiceIds.map(String)
      : [],
    createdByUserId: raw.createdByUserId
      ? String(raw.createdByUserId)
      : undefined,
    createdByName: raw.createdByName ? String(raw.createdByName) : undefined,
    createdAt,
    updatedAt: raw.updatedAt || createdAt,
    branchId: raw.branchId || CURRENT_BRANCH_ID,
  };
};

/**
 * تحليل ملف النسخة الاحتياطية والتحقق من سلامته وتطبيع كافة الكيانات المستعادة
 */
export const parseAndValidateBackupJson = (
  rawText: string,
): NormalizedRestorePayload => {
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
    purchaseOrders: rawPurchaseOrders,
  } = parsed.data;

  // معالجة الموظفين مع ضمان وجود مدير نشط واحد على الأقل لتفادي قفل النظام
  const overwriteUsersTable = Array.isArray(rawUsers) && rawUsers.length > 0;
  let normalizedUsers: UserEntity[] | undefined;

  if (overwriteUsersTable) {
    normalizedUsers = rawUsers.map(normalizeBackupUser);
    const hasActiveAdmin = normalizedUsers.some(
      (u) => u.role === "ADMIN" && u.isActive,
    );
    if (!hasActiveAdmin) {
      normalizedUsers.unshift(DEFAULT_ADMIN_USER);
    }
  }

  // معالجة المستودعات مع منع تكرار الأسماء
  const overwriteSuppliersTable = Array.isArray(rawSuppliers);
  let normalizedSuppliers: SupplierEntity[] | undefined;

  if (overwriteSuppliersTable) {
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

  // معالجة أوامر الشراء
  const overwritePurchaseOrdersTable = Array.isArray(rawPurchaseOrders);
  let normalizedPurchaseOrders: PurchaseOrderEntity[] | undefined;

  if (overwritePurchaseOrdersTable) {
    normalizedPurchaseOrders = rawPurchaseOrders
      .map(normalizeBackupPurchaseOrder)
      .filter((o) => Boolean(o.id && o.supplierName));
  }

  return {
    snapshot: {
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
      purchaseOrders: normalizedPurchaseOrders,
    },
    settings: parsed.settings,
    exportedAt: parsed.meta?.exportedAt || new Date().toISOString(),
    overwriteUsersTable,
    overwriteSuppliersTable,
    overwritePurchaseOrdersTable,
  };
};
