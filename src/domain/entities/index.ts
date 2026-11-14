/**
 * كيان الدفعة (Batch)
 * يمثل دفعة محددة من دواء معين بتاريخ صلاحية وكمية خاصة بها (لتطبيق نظام FIFO).
 */
export interface BatchEntity {
  id: string;
  productId?: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  qtyPacks: number;
  branchId?: string;
}

/**
 * كيان المنتج/الدواء (Product)
 * يمثل المعرّف الأساسي للدواء في الصيدلية مع حساباته المالية الأساسية.
 */
export interface ProductEntity {
  id: string;
  barcode: string;
  name: string;
  scientificName: string;
  category?: string;
  packPrice: number;
  weightedCostPrice: number; // متوسط التكلفة المرجح (بعد البونص)
  stripsPerPack: number;
  stockPacks: number;
  stockLooseStrips: number;
  minLimit: number;
  isControlled: boolean;
  batches: BatchEntity[];
  branchId?: string;
  updatedAt?: string;
}

/**
 * كيان البيانات الوصفية للأدوية المراقبة والنفسية (Controlled Drugs)
 */
export interface ControlledDrugMeta {
  patientName: string;
  nationalId: string;
  doctorName: string;
  prescriptionId: string;
}

/**
 * تفصيل السحب من الدفعة حسب نظام الوارد أولاً يصرف أولاً (FIFO Allocation)
 */
export interface BatchAllocationEntity {
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  deductedPacks: number;
  remainingPacks: number;
}

/**
 * كيان عنصر السلة (CartItem)
 * يمثل دواءً واحداً تم إدراجه في فاتورة البيع (إما علبة أو شريط).
 */
export interface CartItemEntity {
  cartKey: string; // صيغة مميزة: productId-unit لمنع التكرار
  product: ProductEntity;
  unit: "pack" | "strip";
  qty: number;
  unitPrice: number; // السعر المحسوب بناءً على الوحدة
  isControlled: boolean;
  controlledMeta?: ControlledDrugMeta;
  fifoAllocations?: BatchAllocationEntity[];
}

/**
 * كيان الفاتورة المعلقة (Held Invoice)
 */
export interface HeldInvoiceEntity {
  id: string;
  customerName: string;
  items: CartItemEntity[];
  heldAt: string;
}

/**
 * كيان التداخل الدوائي (Drug-Drug Interaction Alert)
 */
export interface DrugInteractionAlert {
  id: string;
  drugAName: string;
  drugBName: string;
  scientificA: string;
  scientificB: string;
  severity: "HIGH" | "MODERATE";
  description: string;
  recommendation: string;
}

/**
 * كيان سجل دفتر الأدوية المراقبة والنفسية (Controlled Drug Log)
 */
export interface ControlledDrugLogEntity {
  id: string;
  invoiceId: string;
  productId: string;
  productName: string;
  scientificName: string;
  barcode: string;
  unit: "pack" | "strip";
  qty: number;
  batchNumber: string;
  patientName: string;
  nationalId: string;
  doctorName: string;
  prescriptionId: string;
  dispensedAt: string;
  branchId: string;
}

/**
 * كيان بند فاتورة المشتريات مع البونص (Purchase Item with Bonus)
 */
export interface PurchaseItemEntity {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  batchNumber: string;
  expiryDate: string;
  purchasedPacks: number;
  bonusPacks: number; // كمية البونص المجانية
  purchasePricePerPack: number; // سعر شراء العلبة الواحدة قبل البونص
  previousStockPacks: number;
  previousWeightedCost: number;
  newWeightedCost: number; // التكلفة المرجحة الجديدة للعلبة بعد البونص
  newPackSalePrice: number;
  lineTotal: number;
}

/**
 * كيان فاتورة المشتريات (Purchase Invoice)
 */
export interface PurchaseInvoiceEntity {
  id: string;
  supplierName: string;
  supplierInvoiceNumber: string;
  paymentMode: "CASH" | "CREDIT";
  totalAmount: number;
  totalBonusValue: number;
  items: PurchaseItemEntity[];
  createdAt: string;
  branchId: string;
}

/**
 * كيان المصاريف النثرية وحركات الدرج (Petty Cash / Expense)
 */
export interface CashExpenseEntity {
  id: string;
  title: string;
  category: "SUPPLIES" | "UTILITIES" | "DELIVERY" | "MAINTENANCE" | "OTHER";
  amount: number;
  notes?: string;
  createdAt: string;
  shiftId: string;
  branchId: string;
}

/**
 * كيان الوردية والصندوق (Cash Drawer Shift)
 */
export interface ShiftSummaryEntity {
  id: string;
  pharmacistName: string;
  openedAt: string;
  closedAt?: string;
  status: "OPEN" | "CLOSED";
  openingBalance: number;
  cashSalesTotal: number;
  creditSalesTotal: number;
  returnsTotal: number;
  pettyCashTotal: number;
  expectedDrawerCash: number; // الرصيد الدفتري المتوقع بالدرج
  actualDrawerCash?: number; // الجرد الفعلي عند الإغلاق
  variance?: number; // الفارق (عجز / زيادة)
  branchId: string;
}

/**
 * كيان عنصر طابور المزامنة السحابية (Offline-First Sync Queue Record)
 */
export interface SyncQueueItemEntity {
  id: string; // UUID v4
  entityType:
    | "PRODUCT"
    | "BATCH"
    | "INVOICE"
    | "PURCHASE"
    | "CONTROLLED_LOG"
    | "EXPENSE"
    | "SHIFT"
    | "BULK_PRICING";
  operation: "INSERT" | "UPDATE" | "DELETE";
  recordId: string;
  payload: string; // JSON serialized
  branchId: string;
  status: "PENDING" | "SYNCED" | "FAILED";
  createdAt: string;
  syncedAt?: string;
}

// --- إضافة في نهاية src/domain/entities/index.ts ---

export type LedgerPartyType = "CUSTOMER" | "SUPPLIER";

export interface LedgerPaymentEntity {
  id: string;
  partyType: LedgerPartyType;
  partyName: string;
  amount: number;
  notes?: string;
  createdAt: string;
  branchId: string;
}

export interface PartyAccountSummary {
  partyName: string;
  partyType: LedgerPartyType;
  totalCreditAmount: number; // إجمالي الفواتير الآجلة
  totalPaidAmount: number; // إجمالي الدفعات المسددة
  remainingBalance: number; // الرصيد المتبقي (الدين الفعلي)
  lastTransactionAt: string;
}
