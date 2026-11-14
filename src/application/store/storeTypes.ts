import { StateCreator } from "zustand";
import {
  ProductEntity,
  CartItemEntity,
  HeldInvoiceEntity,
  ControlledDrugMeta,
  DrugInteractionAlert,
  PurchaseInvoiceEntity,
  ControlledDrugLogEntity,
  CashExpenseEntity,
  ShiftSummaryEntity,
  SyncQueueItemEntity,
  LedgerPaymentEntity,
  PharmacySettingsEntity,
} from "../../domain/entities";
import { InvoiceEntity } from "../../domain/entities/Invoice";
import { PurchaseLineInput } from "../use-cases/AddPurchaseWithBonus";
import { SQLiteProductRepository } from "../../infrastructure/persistence/SQLiteProductRepository";
import { SQLiteBatchRepository } from "../../infrastructure/persistence/SQLiteBatchRepository";
import { SQLiteInvoiceRepository } from "../../infrastructure/persistence/SQLiteInvoiceRepository";

export const productRepo = new SQLiteProductRepository();
export const batchRepo = new SQLiteBatchRepository();
export const invoiceRepo = new SQLiteInvoiceRepository();

export interface PosState {
  // البيانات المتزامنة مع SQLite المحلي
  products: ProductEntity[];
  invoices: InvoiceEntity[];
  purchaseInvoices: PurchaseInvoiceEntity[];
  controlledLogs: ControlledDrugLogEntity[];
  expenses: CashExpenseEntity[];
  shifts: ShiftSummaryEntity[];
  syncQueue: SyncQueueItemEntity[];
  ledgerPayments: LedgerPaymentEntity[];
  settings: PharmacySettingsEntity;

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
  ) => Promise<PurchaseInvoiceEntity>;

  // إجراءات المخزون والتسعير الجماعي
  addNewProduct: (product: Omit<ProductEntity, "id">) => Promise<void>;
  importProductsBatch: (products: ProductEntity[]) => Promise<number>;
  applyBulkPricing: (
    percentChange: number,
    categoryFilter?: string,
  ) => Promise<void>;

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
}

/**
 * نوع مساعد موحّد لإنشاء الشرائح (Slice Creator) مع وصول كامل لحالة PosState
 */
export type PosSlice<T> = StateCreator<PosState, [], [], T>;
