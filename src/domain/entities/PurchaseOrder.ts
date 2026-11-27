// src/domain/entities/PurchaseOrder.ts

/**
 * حالات دورة حياة أمر الشراء (Purchase Order Lifecycle)
 * - DRAFT: مسودة قابلة للتعديل أو الحذف قبل الإرسال للمستودع
 * - SENT: تم إرسالها للمستودع وبانتظار التوريد
 * - PARTIAL: تم استلام جزء من الكميات/الأصناف وما زال هناك متبقٍ
 * - RECEIVED: تم استلام كامل الأصناف وإغلاق الأمر بفواتير شراء مرتبطة
 * - CANCELLED: ملغي ومحفوظ للأرشفة والتدقيق
 */
export type PurchaseOrderStatus =
  | "DRAFT"
  | "SENT"
  | "PARTIAL"
  | "RECEIVED"
  | "CANCELLED";

/**
 * قناة إرسال أمر الشراء للمستودع (جاهزة للتوسعة مستقبلاً بـ API_AUTO للواتساب التلقائي)
 */
export type PurchaseOrderDispatchChannel =
  | "MANUAL_WHATSAPP"
  | "WHATSAPP_LINK"
  | "CSV_EXPORT"
  | "API_AUTO"
  | "MANUAL";

/**
 * كيان بند أمر الشراء (Purchase Order Item)
 * يتتبع الكمية المطلوبة مقابل المستلمة فعلياً لدعم الاستلام الجزئي والكلي
 */
export interface PurchaseOrderItemEntity {
  id: string;
  productId: string;
  productName: string;
  scientificName?: string;
  barcode: string;
  orderedPacks: number; // الكمية المطلوبة (علبة)
  receivedPacks: number; // الكمية المستلمة حتى الآن (علبة)
  estimatedUnitCost: number; // آخر تكلفة مرجحة للعلبة وقت إنشاء الأمر
  lineEstimatedTotal: number; // إجمالي السطر التقديري (orderedPacks * estimatedUnitCost)
}

/**
 * كيان أمر الشراء الصيدلاني (Purchase Order - PO)
 */
export interface PurchaseOrderEntity {
  id: string;
  supplierId?: string; // معرّف المستودع في الدليل (اختياري)
  supplierName: string;
  supplierPhone?: string; // رقم هاتف/واتساب المستودع وقت الإنشاء
  salesRepName?: string; // اسم المندوب وقت الإنشاء
  status: PurchaseOrderStatus;
  items: PurchaseOrderItemEntity[];
  totalOrderedPacks: number;
  totalReceivedPacks: number;
  estimatedTotalAmount: number;
  notes?: string;
  dispatchChannel?: PurchaseOrderDispatchChannel; // وسيلة الإرسال المستخدمة
  sentAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  linkedPurchaseInvoiceIds: string[]; // أرقام فواتير الشراء المرتبطة باستلام هذا الأمر
  createdByUserId?: string; // معرّف المستخدم الذي أنشأ الأمر
  createdByName?: string; // اسم المستخدم الذي أنشأ الأمر
  createdAt: string;
  updatedAt: string;
  branchId: string;
}
