import {
  CashExpenseEntity,
  ShiftSummaryEntity,
  LedgerPaymentEntity,
} from "../../../domain/entities";
import { CURRENT_BRANCH_ID } from "../../../infrastructure/db/database";
import { PosState, PosSlice, invoiceRepo } from "../storeTypes";

export type FinanceShiftSlice = Pick<
  PosState,
  | "addCashExpense"
  | "closeCurrentShift"
  | "openNewShift"
  | "recordLedgerPayment"
>;

export const createFinanceShiftSlice: PosSlice<FinanceShiftSlice> = (
  set,
  get,
) => ({
  addCashExpense: async (title, category, amount, notes) => {
    const openShift = get().shifts.find((s) => s.status === "OPEN");
    const expense: CashExpenseEntity = {
      id: `EXP-${Date.now().toString().slice(-6)}`,
      title: title.trim(),
      category,
      amount: Number(amount.toFixed(2)),
      notes: notes?.trim(),
      createdAt: new Date().toISOString(),
      shiftId: openShift?.id || "shift-default-01",
      branchId: CURRENT_BRANCH_ID,
    };

    await invoiceRepo.saveExpense(expense);
    await get().loadInitialData();
    set({
      notification: {
        type: "success",
        message: `تم تسجيل مصروف (${expense.title}) بقيمة ${expense.amount.toFixed(2)}.`,
      },
    });
  },

  closeCurrentShift: async (actualDrawerCash, safeDropAmount = 0) => {
    const openShift = get().shifts.find((s) => s.status === "OPEN");
    if (!openShift) return;

    const safeActual = Number(actualDrawerCash.toFixed(2));
    const safeDrop = Math.max(
      0,
      Math.min(safeActual, Number(safeDropAmount.toFixed(2))),
    );
    const nextFloat = Number((safeActual - safeDrop).toFixed(2));
    const variance = Number(
      (safeActual - openShift.expectedDrawerCash).toFixed(2),
    );

    const closedShift: ShiftSummaryEntity = {
      ...openShift,
      status: "CLOSED",
      closedAt: new Date().toISOString(),
      actualDrawerCash: safeActual,
      variance,
      safeDropAmount: safeDrop,
      nextShiftFloat: nextFloat,
    };

    await invoiceRepo.saveShift(closedShift);
    await get().loadInitialData();

    const statusText =
      variance === 0
        ? "الصندوق مطابق تماماً (0.00)"
        : variance > 0
          ? `فائض في الصندوق (+${variance.toFixed(2)})`
          : `عجز في الصندوق (${variance.toFixed(2)})`;

    set({
      notification: {
        type: variance < 0 ? "error" : "success",
        message: `تم إغلاق الوردية (${closedShift.id}) — ${statusText} | المورّد للخزنة: ${safeDrop.toFixed(2)} | العهدة المرحلة: ${nextFloat.toFixed(2)}`,
      },
    });
  },

  openNewShift: async (pharmacistName, openingBalance) => {
    const initial = Number(openingBalance.toFixed(2));
    const newShift: ShiftSummaryEntity = {
      id: `SHIFT-${Date.now().toString().slice(-4)}`,
      pharmacistName: pharmacistName.trim() || "د. صيدلي مناوب",
      openedAt: new Date().toISOString(),
      status: "OPEN",
      openingBalance: initial,
      cashSalesTotal: 0,
      creditSalesTotal: 0,
      returnsTotal: 0,
      creditReturnsTotal: 0,
      debtCollectionsTotal: 0,
      supplierPaymentsTotal: 0,
      cashPurchasesTotal: 0,
      pettyCashTotal: 0,
      expectedDrawerCash: initial,
      branchId: CURRENT_BRANCH_ID,
    };
    await invoiceRepo.saveShift(newShift);
    await get().loadInitialData();
    set({
      notification: {
        type: "success",
        message: `تم فتح وردية جديدة للصيدلي (${newShift.pharmacistName}) بعهدة افتتاحية ${initial.toFixed(2)}.`,
      },
    });
  },

  recordLedgerPayment: async (partyType, partyName, amount, notes) => {
    if (!partyName.trim() || amount <= 0) return;
    const payment: LedgerPaymentEntity = {
      id: `PAY-${Date.now().toString().slice(-6)}`,
      partyType,
      partyName: partyName.trim(),
      amount: Number(amount.toFixed(2)),
      notes: notes?.trim(),
      createdAt: new Date().toISOString(),
      branchId: CURRENT_BRANCH_ID,
    };
    await invoiceRepo.saveLedgerPayment(payment);
    await get().loadInitialData();
    set({
      notification: {
        type: "success",
        message:
          partyType === "CUSTOMER"
            ? `تم تسجيل سند قبض بقيمة ${amount.toFixed(2)} من العميل (${partyName}).`
            : `تم تسجيل سند صرف بقيمة ${amount.toFixed(2)} للمستودع (${partyName}).`,
      },
    });
  },
});
