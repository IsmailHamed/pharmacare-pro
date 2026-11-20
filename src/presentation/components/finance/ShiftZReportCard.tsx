import React, { useEffect, useState } from "react";
import { ShiftSummaryEntity, UserRole } from "../../../domain/entities";
import { usePosStore } from "../../../application/store/usePosStore";
import {
  Lock,
  CheckCircle2,
  AlertOctagon,
  UserCheck,
  AlertTriangle,
} from "lucide-react";

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "مدير النظام",
  PHARMACIST: "صيدلي",
  CASHIER: "كاشير",
};

interface Props {
  openShift?: ShiftSummaryEntity;
  lastClosedShift?: ShiftSummaryEntity;
  onCloseShift: (
    actualDrawerCash: number,
    safeDropAmount: number,
  ) => Promise<void>;
  onOpenShift: (
    pharmacistName: string,
    openingBalance: number,
  ) => Promise<void>;
}

export const ShiftZReportCard: React.FC<Props> = ({
  openShift,
  lastClosedShift,
  onCloseShift,
  onOpenShift,
}) => {
  const currentUser = usePosStore((s) => s.currentUser);

  const [actualCash, setActualCash] = useState<string>("");
  const [safeDrop, setSafeDrop] = useState<string>("0");
  const [opening, setOpening] = useState<number>(500);

  useEffect(() => {
    if (!openShift && lastClosedShift?.nextShiftFloat !== undefined) {
      setOpening(lastClosedShift.nextShiftFloat);
    }
  }, [openShift, lastClosedShift]);

  // اكتشاف ما إذا كان المستخدم النشط حالياً يختلف عن صاحب عهدة الوردية المفتوحة
  const isDifferentUser = Boolean(
    openShift &&
    currentUser &&
    ((openShift.openedByUserId &&
      openShift.openedByUserId !== currentUser.id) ||
      (!openShift.openedByUserId &&
        openShift.pharmacistName.trim() !== currentUser.name.trim())),
  );

  const actualCashNum = Number(actualCash || 0);
  const safeDropNum = Number(safeDrop || 0);
  const liveVariance = openShift
    ? Number((actualCashNum - openShift.expectedDrawerCash).toFixed(2))
    : 0;
  const liveNextFloat = Math.max(
    0,
    Number((actualCashNum - safeDropNum).toFixed(2)),
  );

  const activeUserName = currentUser?.name?.trim() || "د. صيدلي مناوب";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
      <h3 className="font-bold text-white text-sm flex items-center gap-2 pb-1 border-b border-slate-800">
        <Lock className="w-4 h-4 text-sky-400" /> تسليم الوردية ومطابقة الصندوق
        (Z-Report)
      </h3>

      {openShift ? (
        <>
          {/* تنبيه بصري عند اختلاف المستخدم النشط (PIN) عن صاحب عهدة الدرج */}
          {isDifferentUser && currentUser && (
            <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-700/80 text-amber-200 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                عهدة الدرج مفتوحة باسم{" "}
                <b className="text-white">{openShift.pharmacistName}</b>،
                والمستخدم النشط الآن{" "}
                <b className="text-amber-300">{currentUser.name}</b>. في حال
                إغلاق الوردية الآن سيُوثّق الإغلاق باسمك.
              </div>
            </div>
          )}

          <div className="text-slate-300 space-y-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px]">
            <div className="flex justify-between border-b border-slate-800 pb-1">
              <span>صاحب عهدة الوردية:</span>
              <b className="text-white">{openShift.pharmacistName}</b>
            </div>
            <div className="flex justify-between">
              <span>(+) الرصيد الافتتاحي (العهدة):</span>
              <b className="font-mono">{openShift.openingBalance.toFixed(2)}</b>
            </div>
            <div className="flex justify-between">
              <span>(+) مبيعات نقدية (Cash Sales):</span>
              <b className="font-mono text-emerald-400">
                +{openShift.cashSalesTotal.toFixed(2)}
              </b>
            </div>
            <div className="flex justify-between">
              <span>(+) مقبوضات ديون عملاء (سندات قبض):</span>
              <b className="font-mono text-emerald-400">
                +{(openShift.debtCollectionsTotal || 0).toFixed(2)}
              </b>
            </div>
            <div className="flex justify-between">
              <span>(-) مرتجعات نقدية (Cash Returns):</span>
              <b className="font-mono text-rose-400">
                -{openShift.returnsTotal.toFixed(2)}
              </b>
            </div>
            <div className="flex justify-between">
              <span>(-) مصاريف نثرية + مشتريات نقدية:</span>
              <b className="font-mono text-rose-400">
                -
                {(
                  openShift.pettyCashTotal + (openShift.cashPurchasesTotal || 0)
                ).toFixed(2)}
              </b>
            </div>
            <div className="flex justify-between">
              <span>(-) دفعات نقدية للمستودعات (سندات صرف):</span>
              <b className="font-mono text-rose-400">
                -{(openShift.supplierPaymentsTotal || 0).toFixed(2)}
              </b>
            </div>

            <div className="flex justify-between pt-1.5 border-t border-slate-800 text-xs font-extrabold">
              <span className="text-amber-300">(=) النقد المتوقع بالدرج:</span>
              <span className="font-mono text-amber-400">
                {openShift.expectedDrawerCash.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between pt-1 text-[10px] text-slate-400 border-t border-dashed border-slate-800">
              <span>مبيعات آجلة (خارج الدرج):</span>
              <span className="font-mono">
                {openShift.creditSalesTotal.toFixed(2)} (مرتجع آجل:{" "}
                {(openShift.creditReturnsTotal || 0).toFixed(2)})
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">
                النقد الفعلي المعدود بالدرج *
              </label>
              <input
                type="number"
                step="any"
                min={0}
                placeholder="أدخل الجرد الفعلي"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 focus:border-sky-500 rounded-lg p-2 text-white font-mono outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">
                المورّد للخزنة (Safe Drop)
              </label>
              <input
                type="number"
                step="any"
                min={0}
                placeholder="0.00"
                value={safeDrop}
                onChange={(e) => setSafeDrop(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 focus:border-sky-500 rounded-lg p-2 text-white font-mono outline-none"
              />
            </div>
          </div>

          {actualCash !== "" && (
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                {liveVariance === 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertOctagon className="w-4 h-4 text-rose-400" />
                )}
                <span>
                  الفارق:{" "}
                  <b
                    className={`font-mono ${
                      liveVariance === 0
                        ? "text-emerald-400"
                        : liveVariance > 0
                          ? "text-sky-400"
                          : "text-rose-400"
                    }`}
                  >
                    {liveVariance > 0
                      ? `+${liveVariance.toFixed(2)} (فائض)`
                      : liveVariance < 0
                        ? `${liveVariance.toFixed(2)} (عجز)`
                        : "0.00 (مطابق)"}
                  </b>
                </span>
              </div>
              <span className="text-slate-400">
                عهدة مرحلة:{" "}
                <b className="font-mono text-white">
                  {liveNextFloat.toFixed(2)}
                </b>
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (actualCash === "") {
                alert("يرجى إدخال النقد الفعلي الموجود في الدرج أولاً.");
                return;
              }
              void onCloseShift(actualCashNum, safeDropNum);
              setActualCash("");
              setSafeDrop("0");
            }}
            className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-lg transition"
          >
            إغلاق الوردية واعتماد تقرير Z-Report
          </button>
        </>
      ) : (
        <div className="space-y-3">
          <div className="p-2.5 bg-amber-950/30 border border-amber-800/70 rounded-xl text-amber-200 text-[11px]">
            الوردية مغلقة حالياً. قم بفتح وردية جديدة لاستلام العهدة وتفعيل نقطة
            البيع والصندوق.
          </div>

          {/* ربط تلقائي غير قابل للتعديل اليدوي بالمستخدم النشط */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400">
                  المستلم للعهدة (المستخدم النشط تلقائياً)
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
            <label className="block text-slate-400 mb-1">
              الرصيد الافتتاحي (العهدة المرحلة للدرج)
            </label>
            <input
              type="number"
              step="any"
              min={0}
              value={opening}
              onChange={(e) => setOpening(Math.max(0, Number(e.target.value)))}
              className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-lg p-2 text-white font-mono outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => void onOpenShift(activeUserName, opening)}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg transition"
          >
            فتح وردية جديدة واستلام العهدة
          </button>
        </div>
      )}
    </div>
  );
};
