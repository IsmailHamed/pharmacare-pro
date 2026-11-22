import React, { useEffect, useState } from "react";
import {
  ShiftSummaryEntity,
  UserEntity,
  UserRole,
} from "../../../domain/entities";
import { Lock, PlayCircle, UserCheck } from "lucide-react";

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "مدير النظام",
  PHARMACIST: "صيدلي",
  CASHIER: "كاشير",
};

interface Props {
  currentUser: UserEntity | null;
  lastClosedShift: ShiftSummaryEntity | undefined;
  onOpenShift: (
    pharmacistName: string,
    openingBalance: number,
  ) => Promise<void>;
  onShiftOpenedFocus?: () => void;
}

/**
 * طبقة قفل نقطة البيع ونموذج فتح الوردية واستلام العهدة السريع
 */
export const ShiftLockOverlay: React.FC<Props> = ({
  currentUser,
  lastClosedShift,
  onOpenShift,
  onShiftOpenedFocus,
}) => {
  const [quickOpeningCash, setQuickOpeningCash] = useState<string>("500");
  const [isOpeningShift, setIsOpeningShift] = useState(false);

  useEffect(() => {
    const carriedFloat = lastClosedShift?.nextShiftFloat ?? 500;
    setQuickOpeningCash(String(carriedFloat));
  }, [lastClosedShift]);

  const activeUserName = currentUser?.name?.trim() || "د. صيدلي مناوب";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOpeningShift) return;

    const amount = Number(quickOpeningCash);
    if (!Number.isFinite(amount) || amount < 0) return;

    setIsOpeningShift(true);
    try {
      await onOpenShift(activeUserName, amount);
      window.setTimeout(() => {
        onShiftOpenedFocus?.();
      }, 60);
    } finally {
      setIsOpeningShift(false);
    }
  };

  return (
    <div className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 text-xs">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-950/70 border border-amber-700/80 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">
              الوردية مغلقة — افتح وردية لبدء البيع
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              لضمان مطابقة الدرج وتقرير Z-Report، لا يمكن إصدار فواتير قبل
              استلام العهدة.
            </p>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400">
                صاحب العهدة (المستخدم النشط حالياً)
              </div>
              <div className="font-bold text-white truncate">
                {activeUserName}
              </div>
            </div>
          </div>
          {currentUser && (
            <span className="text-[10px] font-bold bg-slate-800 border border-slate-700 text-sky-300 px-2 py-0.5 rounded-full shrink-0">
              {ROLE_LABELS[currentUser.role]}
            </span>
          )}
        </div>

        <div>
          <label className="block text-slate-300 font-bold mb-1">
            الرصيد الافتتاحي للدرج (العهدة المستلمة)
          </label>
          <input
            type="number"
            step="any"
            min={0}
            required
            autoFocus
            value={quickOpeningCash}
            onChange={(e) => setQuickOpeningCash(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-xl p-2.5 text-white font-mono font-bold text-sm outline-none"
          />
          {lastClosedShift && (
            <p className="text-[10.5px] text-slate-400 mt-1 font-mono">
              العهدة المرحلة من آخر وردية ({lastClosedShift.id}):{" "}
              <b className="text-emerald-400">
                {(lastClosedShift.nextShiftFloat ?? 0).toFixed(2)} ر.س
              </b>
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={
            isOpeningShift ||
            quickOpeningCash === "" ||
            Number(quickOpeningCash) < 0
          }
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition"
        >
          <PlayCircle className="w-4 h-4" />
          {isOpeningShift
            ? "جارٍ فتح الوردية..."
            : "فتح الوردية واستلام العهدة وبدء البيع"}
        </button>

        <p className="text-[10.5px] text-slate-500 text-center">
          إذا كنت موظفاً آخر، يمكنك تبديل الحساب عبر رمز PIN من الشريط العلوي
          قبل استلام العهدة.
        </p>
      </form>
    </div>
  );
};
