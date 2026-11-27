import { InvoiceEntity } from "../../domain/entities/Invoice";
import {
  CashExpenseEntity,
  ControlledDrugLogEntity,
  LedgerPaymentEntity,
  PurchaseInvoiceEntity,
  ShiftSummaryEntity,
  SyncQueueItemEntity,
} from "../../domain/entities";

/**
 * المعادلة المحاسبية الموحدة لحساب النقد المتوقع في درج الكاشير:
 * النقد المتوقع = الرصيد الافتتاحي + المبيعات النقدية + مقبوضات ديون العملاء
 *               - المرتجعات النقدية - المصاريف النثرية - المشتريات النقدية - دفعات الموردين النقدية
 */
export const recalculateShiftExpectedCash = (
  shift: ShiftSummaryEntity,
): void => {
  const opening = Number(shift.openingBalance || 0);
  const cashSales = Number(shift.cashSalesTotal || 0);
  const debtIn = Number(shift.debtCollectionsTotal || 0);

  const cashReturns = Number(shift.returnsTotal || 0);
  const pettyExpenses = Number(shift.pettyCashTotal || 0);
  const cashPurchases = Number(shift.cashPurchasesTotal || 0);
  const supplierOut = Number(shift.supplierPaymentsTotal || 0);

  shift.expectedDrawerCash = Number(
    (
      opening +
      cashSales +
      debtIn -
      cashReturns -
      pettyExpenses -
      cashPurchases -
      supplierOut
    ).toFixed(2),
  );
};

export const mapInvoiceRow = (r: Record<string, unknown>): InvoiceEntity => ({
  id: String(r.id),
  type: String(r.type) as "SALE" | "RETURN",
  paymentMode: String(r.payment_mode) as "CASH" | "CREDIT",
  customerName: String(r.customer_name),
  subtotal: Number(r.subtotal),
  discountPercent: Number(r.discount_percent),
  totalAmount: Number(r.total_amount),
  totalCostAmount: Number(r.total_cost_amount),
  netProfit: Number(r.net_profit),
  items: JSON.parse(String(r.items_json || "[]")),
  createdAt: String(r.created_at),
  shiftId: r.shift_id ? String(r.shift_id) : undefined,
  performedByUserId: r.performed_by_user_id
    ? String(r.performed_by_user_id)
    : undefined,
  performedByName: r.performed_by_name
    ? String(r.performed_by_name)
    : undefined,
  branchId: String(r.branch_id),
});

export const mapPurchaseInvoiceRow = (
  r: Record<string, unknown>,
): PurchaseInvoiceEntity => ({
  id: String(r.id),
  supplierName: String(r.supplier_name),
  supplierInvoiceNumber: String(r.supplier_invoice_number),
  paymentMode: String(r.payment_mode) as "CASH" | "CREDIT",
  totalAmount: Number(r.total_amount),
  totalBonusValue: Number(r.total_bonus_value),
  items: JSON.parse(String(r.items_json || "[]")),
  purchaseOrderId: r.purchase_order_id
    ? String(r.purchase_order_id)
    : undefined,
  createdAt: String(r.created_at),
  branchId: String(r.branch_id),
});

export const mapControlledDrugLogRow = (
  r: Record<string, unknown>,
): ControlledDrugLogEntity => ({
  id: String(r.id),
  invoiceId: String(r.invoice_id),
  productId: String(r.product_id),
  productName: String(r.product_name),
  scientificName: String(r.scientific_name),
  barcode: String(r.barcode),
  unit: String(r.unit) as "pack" | "strip",
  qty: Number(r.qty),
  batchNumber: String(r.batch_number),
  patientName: String(r.patient_name),
  nationalId: String(r.national_id),
  doctorName: String(r.doctor_name),
  prescriptionId: String(r.prescription_id),
  dispensedAt: String(r.dispensed_at),
  branchId: String(r.branch_id),
});

export const mapExpenseRow = (
  r: Record<string, unknown>,
): CashExpenseEntity => ({
  id: String(r.id),
  title: String(r.title),
  category: String(r.category) as CashExpenseEntity["category"],
  amount: Number(r.amount),
  notes: r.notes ? String(r.notes) : undefined,
  shiftId: String(r.shift_id),
  performedByUserId: r.performed_by_user_id
    ? String(r.performed_by_user_id)
    : undefined,
  performedByName: r.performed_by_name
    ? String(r.performed_by_name)
    : undefined,
  createdAt: String(r.created_at),
  branchId: String(r.branch_id),
});

export const mapShiftRow = (
  r: Record<string, unknown>,
): ShiftSummaryEntity => ({
  id: String(r.id),
  pharmacistName: String(r.pharmacist_name),
  openedByUserId: r.opened_by_user_id ? String(r.opened_by_user_id) : undefined,
  openedAt: String(r.opened_at),
  closedAt: r.closed_at ? String(r.closed_at) : undefined,
  closedByUserId: r.closed_by_user_id ? String(r.closed_by_user_id) : undefined,
  closedByName: r.closed_by_name ? String(r.closed_by_name) : undefined,
  status: String(r.status) as "OPEN" | "CLOSED",
  openingBalance: Number(r.opening_balance),
  cashSalesTotal: Number(r.cash_sales_total),
  creditSalesTotal: Number(r.credit_sales_total),
  returnsTotal: Number(r.returns_total),
  creditReturnsTotal: Number(r.credit_returns_total || 0),
  debtCollectionsTotal: Number(r.debt_collections_total || 0),
  supplierPaymentsTotal: Number(r.supplier_payments_total || 0),
  cashPurchasesTotal: Number(r.cash_purchases_total || 0),
  pettyCashTotal: Number(r.petty_cash_total),
  expectedDrawerCash: Number(r.expected_drawer_cash),
  actualDrawerCash:
    r.actual_drawer_cash !== null && r.actual_drawer_cash !== undefined
      ? Number(r.actual_drawer_cash)
      : undefined,
  variance:
    r.variance !== null && r.variance !== undefined
      ? Number(r.variance)
      : undefined,
  safeDropAmount: Number(r.safe_drop_amount || 0),
  nextShiftFloat: Number(r.next_shift_float || 0),
  branchId: String(r.branch_id),
});

export const mapSyncQueueRow = (
  r: Record<string, unknown>,
): SyncQueueItemEntity => ({
  id: String(r.id),
  entityType: String(r.entity_type) as SyncQueueItemEntity["entityType"],
  operation: String(r.operation) as SyncQueueItemEntity["operation"],
  recordId: String(r.record_id),
  payload: String(r.payload),
  branchId: String(r.branch_id),
  status: String(r.status) as SyncQueueItemEntity["status"],
  createdAt: String(r.created_at),
  syncedAt: r.synced_at ? String(r.synced_at) : undefined,
});

export const mapLedgerPaymentRow = (
  r: Record<string, unknown>,
): LedgerPaymentEntity => ({
  id: String(r.id),
  partyType: String(r.party_type) as "CUSTOMER" | "SUPPLIER",
  partyName: String(r.party_name),
  amount: Number(r.amount),
  notes: r.notes ? String(r.notes) : undefined,
  shiftId: r.shift_id ? String(r.shift_id) : undefined,
  performedByUserId: r.performed_by_user_id
    ? String(r.performed_by_user_id)
    : undefined,
  performedByName: r.performed_by_name
    ? String(r.performed_by_name)
    : undefined,
  createdAt: String(r.created_at),
  branchId: String(r.branch_id),
});
