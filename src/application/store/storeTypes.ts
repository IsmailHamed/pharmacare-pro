import { StateCreator } from "zustand";
import {
  ProductEntity,
  CartItemEntity,
  HeldInvoiceEntity,
  ControlledDrugMeta,
  DrugInteractionAlert,
  PurchaseInvoiceEntity,
  PurchaseOrderEntity,
  PurchaseOrderDispatchChannel,
  ControlledDrugLogEntity,
  CashExpenseEntity,
  ShiftSummaryEntity,
  SyncQueueItemEntity,
  LedgerPaymentEntity,
  PharmacySettingsEntity,
  UserEntity,
  SupplierEntity,
} from "../../domain/entities";
import { InvoiceEntity } from "../../domain/entities/Invoice";
import { PurchaseLineInput } from "../use-cases/AddPurchaseWithBonus";
import { SQLiteProductRepository } from "../../infrastructure/persistence/SQLiteProductRepository";
import { SQLiteBatchRepository } from "../../infrastructure/persistence/SQLiteBatchRepository";
import { SQLiteInvoiceRepository } from "../../infrastructure/persistence/SQLiteInvoiceRepository";
import { SQLiteUserRepository } from "../../infrastructure/persistence/SQLiteUserRepository";
import { SQLiteSupplierRepository } from "../../infrastructure/persistence/SQLiteSupplierRepository";
import { SQLitePurchaseOrderRepository } from "../../infrastructure/persistence/SQLitePurchaseOrderRepository";

export const productRepo = new SQLiteProductRepository();
export const batchRepo = new SQLiteBatchRepository();
export const invoiceRepo = new SQLiteInvoiceRepository();
export const userRepo = new SQLiteUserRepository();
export const supplierRepo = new SQLiteSupplierRepository();
export const purchaseOrderRepo = new SQLitePurchaseOrderRepository();

/**
 * بيانات بند واحد عند إنشاء أمر شراء جديد من دفتر النواقص
 */
export interface PurchaseOrderLineDraftInput {
  product: ProductEntity;
  orderedPacks: number;
}

/**
 * بيانات إنشاء أمر شراء جديد لمستودع محدد
 */
export interface CreatePurchaseOrderInput {
  supplierId?: string;
  supplierName: string;
  supplierPhone?: string;
  salesRepName?: string;
  notes?: string;
  items: PurchaseOrderLineDraftInput[];
}

export interface PosState {
  // البيانات المتزامنة مع SQLite المحلي
  products: ProductEntity[];
  invoices: InvoiceEntity[];
  purchaseInvoices: PurchaseInvoiceEntity[];
  purchaseOrders: PurchaseOrderEntity[];
  controlledLogs: ControlledDrugLogEntity[];
  expenses: CashExpenseEntity[];
  shifts: ShiftSummaryEntity[];
  syncQueue: SyncQueueItemEntity[];
  ledgerPayments: LedgerPaymentEntity[];
  suppliers: SupplierEntity[];
  settings: PharmacySettingsEntity;

  // أمر الشراء المحدّد حالياً للتحويل إلى شاشة إدخال فاتورة الشراء (استلام بنقرة واحدة)
  pendingOrderForInvoice: PurchaseOrderEntity | null;

  // حالة نقطة البيع (POS State)
  cart: CartItemEntity[];
  heldInvoices: HeldInvoiceEntity[];
  interactionAlerts: DrugInteractionAlert[];
  invoiceMode: "SALE" | "RETURN";
  returnSourceInvoiceId: string | null;
  paymentMode: "CASH" | "CREDIT";
  discountPercent: number;
  customerName: string;
  selectedProductForAlternatives: ProductEntity | null;
  pendingControlledItem: {
    product: ProductEntity;
    unit: "pack" | "strip";
  } | null;
  lastPrintedInvoice: InvoiceEntity | null;
  notification: {
    type: "success" | "error" | "warning" | "info";
    message: string;
  } | null;

  users: UserEntity[];
  currentUser: UserEntity | null;
  activeRole: "CASHIER" | "ADMIN"; // قيمة مستنتجة ديناميكياً للتوافق مع الكود السابق

  // الإجراءات الأساسية (Actions)
  loadInitialData: () => Promise<void>;
  updatePharmacySettings: (newSettings: PharmacySettingsEntity) => void;
  setNotification: (
    notification: {
      type: "success" | "error" | "warning" | "info";
      message: string;
    } | null,
  ) => void;
  setInvoiceMode: (mode: "SALE" | "RETURN") => void;
  toggleReturnMode: () => void;
  setPaymentMode: (mode: "CASH" | "CREDIT") => void;
  setDiscountPercent: (percent: number) => void;
  setCustomerName: (name: string) => void;
  setSelectedProductForAlternatives: (product: ProductEntity | null) => void;
  setPendingControlledItem: (
    pending: { product: ProductEntity; unit: "pack" | "strip" } | null,
  ) => void;
  setLastPrintedInvoice: (invoice: InvoiceEntity | null) => void;

  // إجراءات السلة والبيع والباركود والمرتجع
  requestAddToCart: (product: ProductEntity, unit: "pack" | "strip") => void;
  addToCart: (
    product: ProductEntity,
    unit: "pack" | "strip",
    meta?: ControlledDrugMeta,
  ) => void;
  updateCartQty: (cartKey: string, delta: number) => void;
  toggleCartItemUnit: (cartKey: string) => void;
  removeFromCart: (cartKey: string) => void;
  clearCart: () => void;
  holdCurrentInvoice: (customerName?: string) => void;
  resumeInvoice: (invoiceId: string) => void;
  completeCheckout: () => Promise<InvoiceEntity | null>;
  handleBarcodeScan: (rawBarcode: string) => boolean;
  loadInvoiceForReturn: (invoiceQuery: string) => boolean;

  // إجراءات المشتريات والبونص
  createPurchaseWithBonus: (
    supplierName: string,
    supplierInvoiceNumber: string,
    paymentMode: "CASH" | "CREDIT",
    lines: PurchaseLineInput[],
    purchaseOrderId?: string,
  ) => Promise<PurchaseInvoiceEntity>;

  // إجراءات دورة أوامر الشراء (Purchase Orders Lifecycle)
  setPendingOrderForInvoice: (order: PurchaseOrderEntity | null) => void;
  loadPurchaseOrders: () => Promise<void>;
  createPurchaseOrdersBatch: (
    ordersInput: CreatePurchaseOrderInput[],
  ) => Promise<PurchaseOrderEntity[]>;
  updatePurchaseOrderItems: (
    orderId: string,
    updatedItems: { itemId: string; orderedPacks: number }[],
    notes?: string,
    addedItems?: PurchaseOrderLineDraftInput[],
  ) => Promise<void>;
  markPurchaseOrderSent: (
    orderId: string,
    channel?: PurchaseOrderDispatchChannel,
  ) => Promise<void>;
  cancelPurchaseOrder: (orderId: string) => Promise<void>;
  deleteDraftPurchaseOrder: (orderId: string) => Promise<void>;

  // إجراءات المخزون والتسعير الجماعي وتسوية الجرد
  addNewProduct: (product: Omit<ProductEntity, "id">) => Promise<void>;
  importProductsBatch: (products: ProductEntity[]) => Promise<number>;
  applyBulkPricing: (
    percentChange: number,
    categoryFilter?: string,
  ) => Promise<void>;
  adjustProductStock: (params: {
    productId: string;
    actualPacks: number;
    actualLooseStrips: number;
    targetBatchId: string;
    reason: "STOCKTAKING" | "DAMAGED" | "EXPIRED" | "SHORTAGE";
    notes: string;
    recordLossInFinance: boolean;
  }) => Promise<void>;

  // إجراءات الصندوق والوردية (Cash Drawer & Shift)
  addCashExpense: (
    title: string,
    category: CashExpenseEntity["category"],
    amount: number,
    notes?: string,
  ) => Promise<void>;
  closeCurrentShift: (
    actualDrawerCash: number,
    safeDropAmount?: number,
  ) => Promise<void>;
  openNewShift: (
    pharmacistName: string,
    openingBalance: number,
  ) => Promise<void>;

  // إجراءات المزامنة السحابية والنسخ الاحتياطي المحلي
  syncPendingBatchToCloud: () => Promise<{
    syncedCount: number;
    batchId: string;
  }>;
  exportDatabaseBackup: () => void;
  restoreDatabaseBackup: (file: File) => Promise<void>;
  resetDemoDatabase: () => Promise<void>;

  recordLedgerPayment: (
    partyType: "CUSTOMER" | "SUPPLIER",
    partyName: string,
    amount: number,
    notes?: string,
  ) => Promise<void>;

  // إجراءات إدارة المستخدمين والصلاحيات (RBAC)
  loadUsers: () => Promise<void>;
  addOrUpdateUser: (user: UserEntity) => Promise<void>;
  toggleUserStatus: (userId: string) => Promise<void>;
  loginWithPinOrBarcode: (credential: string) => Promise<boolean>;

  // إجراءات إدارة دليل المستودعات والموردين
  loadSuppliers: () => Promise<void>;
  addOrUpdateSupplier: (supplier: SupplierEntity) => Promise<boolean>;
  toggleSupplierStatus: (supplierId: string) => Promise<void>;
}

export type PosSlice<T> = StateCreator<PosState, [], [], T>;
