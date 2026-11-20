import {
  CashExpenseEntity,
  ShiftSummaryEntity,
  LedgerPaymentEntity,
} from "../../../domain/entities";
import { CURRENT_BRANCH_ID } from "../../../infrastructure/db/database";
import { SoundFeedbackService } from "../../../infrastructure/audio/SoundFeedbackService";
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
    if (!openShift) {
      SoundFeedbackService.playWarningBuzzer();
      set({
        notification: {
          type: "error",
          message:
            "لا يمكن تسجيل مصروف نثري والوردية مغلقة! يرجى فتح وردية أولاً.",
        },
      });
      return;
    }

    const currentUser = get().currentUser;
    const expense: CashExpenseEntity = {
      id: `EXP-${Date.now().toString().slice(-6)}`,
      title: title.trim(),
      category,
      amount: Number(amount.toFixed(2)),
      notes: notes?.trim(),
      createdAt: new Date().toISOString(),
      shiftId: openShift.id,
      performedByUserId: currentUser?.id,
      performedByName: currentUser?.name,
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

    const currentUser = get().currentUser;
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
      closedByUserId: currentUser?.id,
      closedByName: currentUser?.name,
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
    const existingOpenShift = get().shifts.find((s) => s.status === "OPEN");
    if (existingOpenShift) {
      SoundFeedbackService.playWarningBuzzer();
      set({
        notification: {
          type: "warning",
          message: `توجد وردية مفتوحة حالياً باسم (${existingOpenShift.pharmacistName}) — أغلقها أولاً قبل فتح وردية جديدة.`,
        },
      });
      return;
    }

    const currentUser = get().currentUser;
    const ownerName =
      currentUser?.name?.trim() || pharmacistName.trim() || "د. صيدلي مناوب";
    const initial = Math.max(0, Number(openingBalance.toFixed(2)));

    const newShift: ShiftSummaryEntity = {
      id: `SHIFT-${Date.now().toString().slice(-4)}`,
      pharmacistName: ownerName,
      openedByUserId: currentUser?.id,
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
        message: `تم فتح وردية جديدة باسم (${newShift.pharmacistName}) بعهدة افتتاحية ${initial.toFixed(2)}.`,
      },
    });
  },

  recordLedgerPayment: async (partyType, partyName, amount, notes) => {
    if (!partyName.trim() || amount <= 0) return;

    const openShift = get().shifts.find((s) => s.status === "OPEN");
    if (!openShift) {
      SoundFeedbackService.playWarningBuzzer();
      set({
        notification: {
          type: "error",
          message:
            "لا يمكن تسجيل سند قبض أو صرف والوردية مغلقة! يرجى فتح وردية أولاً لربط الحركة بالدرج.",
        },
      });
      return;
    }

    const currentUser = get().currentUser;
    const payment: LedgerPaymentEntity = {
      id: `PAY-${Date.now().toString().slice(-6)}`,
      partyType,
      partyName: partyName.trim(),
      amount: Number(amount.toFixed(2)),
      notes: notes?.trim(),
      createdAt: new Date().toISOString(),
      shiftId: openShift.id,
      performedByUserId: currentUser?.id,
      performedByName: currentUser?.name,
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
