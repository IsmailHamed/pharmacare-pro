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
