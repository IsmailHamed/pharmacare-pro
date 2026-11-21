// src/domain/repositories/ISupplierRepository.ts
import { SupplierEntity } from "../entities/Supplier";

export interface ISupplierRepository {
  /** جلب جميع المستودعات (النشطة والمجمّدة) مرتبة حسب تاريخ الإنشاء أو الاسم */
  getAllSuppliers(): Promise<SupplierEntity[]>;

  /** البحث عن مستودع بواسطة المعرّف */
  getSupplierById(id: string): Promise<SupplierEntity | null>;

  /** إضافة مستودع جديد أو تحديث بيانات مستودع قائم مع التحقق من عدم تكرار الاسم */
  upsertSupplier(supplier: SupplierEntity): Promise<void>;

  /** تفعيل أو تجميد مستودع دون حذف فواتيره السابقة */
  toggleSupplierStatus(id: string, isActive: boolean): Promise<void>;
}
