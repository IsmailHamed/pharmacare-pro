import React, { useEffect, useState } from "react";
import {
  PartyAccountSummary,
  ShiftSummaryEntity,
} from "../../../domain/entities";
import { usePosStore } from "../../../application/store/usePosStore";
import { LedgerVoucherReceiptData } from "./LedgerVoucherReceiptModal";
import {
  X,
  HandCoins,
  AlertTriangle,
  Wallet,
  Printer,
  RotateCcw,
  Lock,
} from "lucide-react";

const QUICK_ADD_AMOUNTS = [50, 100] as const;

interface Props {
  party: PartyAccountSummary | null;
  openShift?: ShiftSummaryEntity;
  onClose: () => void;
  onRecordPayment: (
    partyType: "CUSTOMER" | "SUPPLIER",
    partyName: string,
    amount: number,
    notes?: string,
  ) => Promise<void>;
  onPaymentSuccess?: (
    receipt: LedgerVoucherReceiptData,
    shouldPrint: boolean,
  ) => void;
}

/**
 * نافذة تسجيل سند قبض (عميل) أو سند صرف (مستودع)
 * مقفلة عند إغلاق الوردية لضمان ربط كل حركة نقدية بالدرج المفتوح وتوثيق المنفّذ الفعلي
 */
export const LedgerPaymentModal: React.FC<Props> = ({
  party,
  openShift,
  onClose,
  onRecordPayment,
  onPaymentSuccess,
}) => {
  const currentUser = usePosStore((s) => s.currentUser);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [printAfterSave, setPrintAfterSave] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // تهيئة الحقول تلقائياً عند فتح النافذة لطرف جديد
  useEffect(() => {
    if (!party) return;
    setPaymentAmount(String(party.remainingBalance));
    setPaymentNotes("");
    setPrintAfterSave(true);
  }, [party]);

  // إغلاق النافذة عبر مفتاح Escape
  useEffect(() => {
    if (!party) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [party, isSubmitting, onClose]);

  if (!party) return null;

  const isShiftClosed = !openShift;
  const isCustomer = party.partyType === "CUSTOMER";
  const numericAmount = Number(paymentAmount) || 0;
  const isValidAmount =
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    numericAmount <= party.remainingBalance + 0.001;

  const projectedRemaining = Math.max(
    0,
    Number((party.remainingBalance - Math.max(0, numericAmount)).toFixed(2)),
  );

  const projectedDrawerCash = openShift
    ? Number(
        (
          openShift.expectedDrawerCash +
          (isCustomer ? numericAmount : -numericAmount)
        ).toFixed(2),
      )
    : null;

  const exceedsDrawerCash =
    !isCustomer &&
    openShift !== undefined &&
    numericAmount > openShift.expectedDrawerCash;

  const isDifferentPerformer = Boolean(
    openShift &&
    currentUser &&
    ((openShift.openedByUserId &&
      openShift.openedByUserId !== currentUser.id) ||
      (!openShift.openedByUserId &&
        openShift.pharmacistName.trim() !== currentUser.name.trim())),
  );

  const handleSetFull = () => {
    setPaymentAmount(String(party.remainingBalance));
  };

  const handleSetHalf = () => {
    const half = Number((party.remainingBalance / 2).toFixed(2));
    setPaymentAmount(String(half));
  };

  const handleAddQuickAmount = (delta: number) => {
    const current = Math.max(0, Number(paymentAmount) || 0);
    const next = Math.min(
      party.remainingBalance,
      Number((current + delta).toFixed(2)),
    );
    setPaymentAmount(String(next));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isShiftClosed || !isValidAmount || isSubmitting) return;

    const cleanNotes = paymentNotes.trim() || undefined;
    const prevIds = new Set(
      (usePosStore.getState().ledgerPayments || []).map((p) => p.id),
    );

    setIsSubmitting(true);
    try {
      await onRecordPayment(
        party.partyType,
        party.partyName,
        numericAmount,
        cleanNotes,
      );

      // التحقق من تسجيل السند فعلياً قبل إغلاق النافذة أو عرض الإيصال الحراري
      const latestPayments = usePosStore.getState().ledgerPayments || [];
      const createdPayment = latestPayments.find(
        (p) =>
          !prevIds.has(p.id) &&
          p.partyType === party.partyType &&
          p.partyName.trim() === party.partyName.trim(),
      );

      if (!createdPayment) return;

      const receiptData: LedgerVoucherReceiptData = {
        id: createdPayment.id,
        partyType: party.partyType,
        partyName: party.partyName,
        amount: numericAmount,
        createdAt: createdPayment.createdAt,
        notes: cleanNotes,
        previousBalance: party.remainingBalance,
        remainingBalance: projectedRemaining,
        pharmacistName:
          createdPayment.performedByName ||
          usePosStore.getState().currentUser?.name ||
          openShift.pharmacistName,
      };

      onClose();
      onPaymentSuccess?.(receiptData, printAfterSave);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-3.5 shadow-2xl"
      >
        {/* رأس النافذة */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <HandCoins
              className={`w-4 h-4 ${
                isCustomer ? "text-sky-400" : "text-purple-400"
              }`}
            />
            {isCustomer
              ? `سند قبض دفعة من العميل: ${party.partyName}`
              : `سند صرف دفعة للمستودع: ${party.partyName}`}
          </h3>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ملخص الرصيد السابق والمتبقي بعد الدفع */}
        <div className="grid grid-cols-2 gap-2.5 bg-slate-950 border border-slate-800 rounded-xl p-3">
          <div>
            <div className="text-[10px] text-slate-400">
              الرصيد المتبقي الحالي
            </div>
            <div className="font-mono font-extrabold text-sm text-amber-400 mt-0.5">
              {party.remainingBalance.toFixed(2)} ر.س
            </div>
          </div>
          <div className="border-r border-slate-800 pr-2.5">
            <div className="text-[10px] text-slate-400">المتبقي بعد السند</div>
            <div
              className={`font-mono font-extrabold text-sm mt-0.5 ${
                projectedRemaining === 0 ? "text-emerald-400" : "text-white"
              }`}
            >
              {projectedRemaining.toFixed(2)} ر.س
            </div>
          </div>
        </div>

        {/* حقل المبلغ + أزرار التسديد السريع */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-slate-300 font-bold">المبلغ المسدد</label>
            <button
              type="button"
              disabled={isShiftClosed}
              onClick={() => setPaymentAmount("")}
              title="تصفير الحقل"
              className="text-[10px] text-slate-400 hover:text-white disabled:opacity-40 flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3 h-3" /> تصفير
            </button>
          </div>

          <input
            type="number"
            step="any"
            min={0.01}
            max={party.remainingBalance}
            required
            autoFocus={!isShiftClosed}
            disabled={isShiftClosed}
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl p-2.5 text-white font-mono font-bold text-sm outline-none"
          />

          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              disabled={isShiftClosed}
              onClick={handleSetFull}
              className="py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/70 disabled:opacity-40 border border-emerald-800/80 text-emerald-300 font-bold text-[11px] transition"
            >
              كامل الرصيد
            </button>
            <button
              type="button"
              disabled={isShiftClosed}
              onClick={handleSetHalf}
              className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-200 font-bold text-[11px] transition"
            >
              50%
            </button>
            {QUICK_ADD_AMOUNTS.map((val) => (
              <button
                key={val}
                type="button"
                disabled={isShiftClosed}
                onClick={() => handleAddQuickAmount(val)}
                className="py-1.5 rounded-lg bg-slate-800 hover:bg-sky-950 hover:border-sky-700 disabled:opacity-40 border border-slate-700 text-slate-200 hover:text-sky-300 font-mono font-bold text-[11px] transition"
              >
                +{val}
              </button>
            ))}
          </div>
        </div>

        {/* ملاحظات السند */}
        <div>
          <label className="block text-slate-400 mb-1">ملاحظات السند</label>
          <input
            type="text"
            disabled={isShiftClosed}
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.target.value)}
            placeholder={
              isCustomer
                ? "مثال: دفعة نقدية من الحساب الجاري"
                : "مثال: تسديد دفعة لمندوب المستودع"
            }
            className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl p-2.5 text-white outline-none"
          />
        </div>

        {/* بيان أثر السند على درج الوردية أو قفل الإغلاق */}
        {openShift ? (
          <div
            className={`rounded-xl p-2.5 border text-[11px] space-y-1 ${
              exceedsDrawerCash
                ? "bg-rose-950/35 border-rose-800 text-rose-200"
                : isCustomer
                  ? "bg-emerald-950/25 border-emerald-800/70 text-emerald-200"
                  : "bg-purple-950/25 border-purple-800/70 text-purple-200"
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold">
              {exceedsDrawerCash ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              ) : (
                <Wallet className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                {isCustomer
                  ? `سيُضاف المبلغ إلى «مقبوضات ديون عملاء» في وردية (${openShift.pharmacistName})`
                  : `سيُخصم المبلغ من «دفعات نقدية للمستودعات» في وردية (${openShift.pharmacistName})`}
              </span>
            </div>
            <div className="flex justify-between text-[10.5px] opacity-90 font-mono">
              <span>
                الدرج الحالي: {openShift.expectedDrawerCash.toFixed(2)}
              </span>
              <span>
                الدرج بعد السند: {(projectedDrawerCash ?? 0).toFixed(2)} ر.س
              </span>
            </div>
            {isDifferentPerformer && currentUser && (
              <div className="text-[10px] text-amber-300 font-semibold">
                سيُوثّق السند باسم المنفّذ النشط: {currentUser.name}
              </div>
            )}
            {exceedsDrawerCash && (
              <div className="text-[10px] text-rose-300 font-semibold">
                تنبيه: مبلغ الصرف أكبر من النقد المتوقع بالدرج حالياً.
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl p-2.5 bg-rose-950/35 border border-rose-800/80 text-rose-200 text-[11px] flex items-start gap-2">
            <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>
              الوردية مغلقة حالياً — لا يمكن اعتماد سند قبض أو صرف قبل فتح وردية
              من تبويب الوردية لربط الحركة النقدية بدرج الكاشير.
            </span>
          </div>
        )}

        {/* خيار طباعة السند الحراري فور التأكيد */}
        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2">
          <input
            type="checkbox"
            disabled={isShiftClosed}
            checked={printAfterSave}
            onChange={(e) => setPrintAfterSave(e.target.checked)}
            className="accent-emerald-500 w-3.5 h-3.5"
          />
          <Printer className="w-3.5 h-3.5 text-emerald-400" />
          <span>معاينة وطباعة السند الحراري (80mm) فور الاعتماد</span>
        </label>

        {/* أزرار التأكيد والإلغاء */}
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={isShiftClosed || isSubmitting || !isValidAmount}
            className={`flex-1 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition ${
              isCustomer
                ? "bg-sky-600 hover:bg-sky-500"
                : "bg-purple-600 hover:bg-purple-500"
            }`}
          >
            {isShiftClosed ? (
              <>
                <Lock className="w-3.5 h-3.5" /> افتح وردية أولاً
              </>
            ) : isSubmitting ? (
              "جارٍ الترحيل..."
            ) : isCustomer ? (
              "اعتماد سند القبض"
            ) : (
              "اعتماد سند الصرف"
            )}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
};
