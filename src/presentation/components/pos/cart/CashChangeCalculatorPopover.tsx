import React, { useEffect, useRef } from "react";
import { Banknote, RotateCcw, X } from "lucide-react";

const CASH_DENOMINATIONS = [10, 50, 100, 200, 500] as const;

interface Props {
  total: number;
  isExpanded: boolean;
  cashTenderedInput: string;
  hasCashInput: boolean;
  isCashSufficient: boolean;
  changeDue: number;
  remainingDue: number;
  onChangeCashInput: (value: string) => void;
  onExactCash: () => void;
  onAddDenomination: (noteValue: number) => void;
  onClose: () => void;
}

/**
 * الطبقة العائمة لحاسبة الفئات النقدية والباقي (تفتح فوق السلة في الوضع المقسوم وأسفل لوحة الدفع في الوضع الموسّع)
 */
export const CashChangeCalculatorPopover: React.FC<Props> = ({
  total,
  isExpanded,
  cashTenderedInput,
  hasCashInput,
  isCashSufficient,
  changeDue,
  remainingDue,
  onChangeCashInput,
  onExactCash,
  onAddDenomination,
  onClose,
}) => {
  const cashInputRef = useRef<HTMLInputElement>(null);

  // تركيز تلقائي على خانة المبلغ المدفوع فور فتح الحاسبة العائمة عبر F8 أو النقر
  useEffect(() => {
    const timer = window.setTimeout(() => {
      cashInputRef.current?.focus();
      cashInputRef.current?.select();
    }, 20);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className={`absolute left-0 right-0 z-30 bg-slate-900 border-2 border-emerald-600/80 rounded-xl p-3 shadow-2xl space-y-2.5 ${
        isExpanded
          ? "bottom-full mb-2 lg:bottom-auto lg:mb-0 lg:top-full lg:mt-2"
          : "bottom-full mb-2"
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
          <Banknote className="w-4 h-4" />
          حاسبة الفئات النقدية والباقي
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-400">
            الصافي: <b className="text-emerald-300">{total.toFixed(2)}</b>
          </span>
          <button
            type="button"
            onClick={onClose}
            title="إغلاق (Esc أو F8)"
            className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1 rounded-md transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-300 shrink-0">
          المدفوع نقداً:
        </span>
        <div className="flex items-center gap-1.5 flex-1 justify-end">
          <input
            ref={cashInputRef}
            type="number"
            min={0}
            step="any"
            value={cashTenderedInput}
            onChange={(e) => onChangeCashInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="0.00"
            dir="ltr"
            className="w-32 bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-left font-mono font-bold text-sm text-white outline-none"
          />
          {hasCashInput && (
            <button
              type="button"
              onClick={() => onChangeCashInput("")}
              title="تصفير المبلغ المدفوع"
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white p-1.5 rounded-lg transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* أزرار الفئات النقدية السريعة */}
      <div className="grid grid-cols-6 gap-1.5">
        <button
          type="button"
          onClick={onExactCash}
          title="تعيين المبلغ المستلم مطابقاً للصافي تماماً"
          className="py-1.5 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-800/80 text-sky-300 font-bold text-[10.5px] transition"
        >
          تماماً
        </button>
        {CASH_DENOMINATIONS.map((note) => (
          <button
            key={note}
            type="button"
            onClick={() => onAddDenomination(note)}
            title={`إضافة ورقة فئة ${note} ر.س للمبلغ المستلم`}
            className="py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-950 hover:border-emerald-700 border border-slate-700 text-slate-200 hover:text-emerald-300 font-mono font-bold text-xs transition"
          >
            +{note}
          </button>
        ))}
      </div>

      {/* شاشة عرض الباقي للزبون بخط ضخم */}
      {hasCashInput && (
        <div
          className={`rounded-lg px-3 py-2 border flex items-center justify-between ${
            isCashSufficient
              ? "bg-emerald-950/60 border-emerald-600/80"
              : "bg-amber-950/50 border-amber-600/80"
          }`}
        >
          <span
            className={`font-bold text-xs ${
              isCashSufficient ? "text-emerald-200" : "text-amber-200"
            }`}
          >
            {isCashSufficient ? "الباقي للزبون:" : "المتبقي على الزبون:"}
          </span>
          <span
            dir="ltr"
            className={`font-mono font-black tracking-tight ${
              isCashSufficient
                ? "text-2xl text-emerald-300"
                : "text-lg text-amber-300"
            }`}
          >
            {(isCashSufficient ? changeDue : remainingDue).toFixed(2)} ر.س
          </span>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-0.5">
        <span>Enter إغلاق • Esc إلغاء</span>
        <span>F1 إتمام البيع والطباعة</span>
      </div>
    </div>
  );
};
