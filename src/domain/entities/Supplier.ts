// src/domain/entities/Supplier.ts

/**
 * كيان المستودع / المورد الصيدلاني (Pharmaceutical Supplier / Warehouse)
 */
export interface SupplierEntity {
  id: string;
  name: string;
  phone?: string; // رقم الهاتف أو واتساب المندوب لإرسال الطلبيات
  salesRepName?: string; // اسم المندوب (اختياري)
  notes?: string; // ملاحظات (مثال: أيام التوزيع أو الحد الأدنى للطلبية)
  isActive: boolean;
  createdAt: string;
  branchId: string;
}
