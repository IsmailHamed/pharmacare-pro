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
  performedByUserId?: string; // معرّف المستخدم الذي سجّل المصروف
  performedByName?: string; // اسم المستخدم الذي سجّل المصروف
  branchId: string;
}

/**
 * كيان الوردية والصندوق (Cash Drawer Shift)
 */
export interface ShiftSummaryEntity {
  id: string;
  pharmacistName: string; // اسم صاحب العهدة (المستخدم الذي فتح الوردية)
  openedByUserId?: string; // معرّف المستخدم الذي فتح الوردية
  openedAt: string;
  closedAt?: string;
  closedByUserId?: string; // معرّف المستخدم الذي أغلق الوردية
  closedByName?: string; // اسم المستخدم الذي أغلق الوردية
  status: "OPEN" | "CLOSED";
  openingBalance: number; // الرصيد الافتتاحي (العهدة المستلمة)
  cashSalesTotal: number; // المبيعات النقدية فقط
  creditSalesTotal: number; // المبيعات الآجلة (ذمم عملاء)
  returnsTotal: number; // المرتجعات النقدية فقط (تُخصم من الدرج)
  creditReturnsTotal?: number; // مرتجعات الآجل (تُخصم من دين العميل ولا تمس الدرج)
  debtCollectionsTotal?: number; // سندات القبض النقدية المحصلة من ديون العملاء (+)
  supplierPaymentsTotal?: number; // سندات الصرف النقدية المسددة للمستودعات (-)
  cashPurchasesTotal?: number; // فواتير الشراء المسددة نقداً من الدرج (-)
  pettyCashTotal: number; // المصاريف النثرية المسحوبة من الدرج (-)
  expectedDrawerCash: number; // النقد المتوقع بالدرج حسب المعادلة المحاسبية
  actualDrawerCash?: number; // النقد الفعلي المعدود بيد الصيدلي عند الإغلاق
  variance?: number; // الفارق النقدي (+ فائض / - عجز)
  safeDropAmount?: number; // المبلغ المورّد لخزنة الإدارة عند الإغلاق
  nextShiftFloat?: number; // العهدة المتروكة في الدرج للوردية القادمة
  branchId: string;
}

export type LedgerPartyType = "CUSTOMER" | "SUPPLIER";

export interface LedgerPaymentEntity {
  id: string;
  partyType: LedgerPartyType;
  partyName: string;
  amount: number;
  notes?: string;
  createdAt: string;
  shiftId?: string; // رقم الوردية التي سُجّل خلالها السند
  performedByUserId?: string; // معرّف المستخدم الذي نفّذ السند
  performedByName?: string; // اسم المستخدم الذي نفّذ السند
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
