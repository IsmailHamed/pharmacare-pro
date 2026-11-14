import { InvoiceEntity } from "../entities/Invoice";
import {
  PurchaseInvoiceEntity,
  ControlledDrugLogEntity,
  CashExpenseEntity,
  ShiftSummaryEntity,
  SyncQueueItemEntity,
  LedgerPaymentEntity,
} from "../entities";

export interface IInvoiceRepository {
  /**
   * حفظ الفاتورة الجديدة في قاعدة البيانات (وإضافتها لطابور المزامنة الصامت)
   */
  saveInvoice(invoice: InvoiceEntity): Promise<void>;

  /**
   * جلب جميع فواتير المبيعات والمرتجعات
   */
  getAllInvoices(): Promise<InvoiceEntity[]>;

  /**
   * حفظ فاتورة مشتريات المستودع مع البونص
   */
  savePurchaseInvoice(purchase: PurchaseInvoiceEntity): Promise<void>;

  /**
   * جلب جميع فواتير المشتريات
   */
  getAllPurchaseInvoices(): Promise<PurchaseInvoiceEntity[]>;

  /**
   * تسجيل عملية صرف دواء مراقب في السجل الرسمي
   */
  saveControlledDrugLog(log: ControlledDrugLogEntity): Promise<void>;

  /**
   * جلب سجل الأدوية المراقبة والنفسية
   */
  getControlledDrugLogs(): Promise<ControlledDrugLogEntity[]>;

  /**
   * حفظ مصروف نثري من الدرج
   */
  saveExpense(expense: CashExpenseEntity): Promise<void>;

  /**
   * جلب جميع المصاريف النثرية
   */
  getAllExpenses(): Promise<CashExpenseEntity[]>;

  /**
   * حفظ أو تحديث حالة الوردية
   */
  saveShift(shift: ShiftSummaryEntity): Promise<void>;

  /**
   * جلب سجل الورديات
   */
  getShifts(): Promise<ShiftSummaryEntity[]>;

  /**
   * جلب طابور المزامنة السحابية (Sync Queue)
   */
  getSyncQueue(): Promise<SyncQueueItemEntity[]>;

  /**
   * تحديث حالة حزمة المزامنة بعد الإرسال للسيرفر المركزي
   */
  markSyncItemsCompleted(ids: string[]): Promise<void>;

  saveLedgerPayment(payment: LedgerPaymentEntity): Promise<void>;

  getLedgerPayments(): Promise<LedgerPaymentEntity[]>;
}
