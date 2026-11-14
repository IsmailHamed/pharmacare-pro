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
