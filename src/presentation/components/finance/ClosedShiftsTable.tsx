import React, { useMemo, useState } from "react";
import { ShiftSummaryEntity } from "../../../domain/entities";
import {
  History,
  Search,
  Filter,
  CheckCircle2,
  AlertOctagon,
} from "lucide-react";

interface Props {
  closedShifts: ShiftSummaryEntity[];
}

/**
 * تبويب أرشيف تقارير تسليم الورديات السابقة (Z-Reports Archive)
 * يعرض ملخص الفروقات والتوريد للخزنة مع البحث الفوري وتصفية الورديات ذات الفارق
 */
export const ClosedShiftsTable: React.FC<Props> = ({ closedShifts }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyWithVariance, setOnlyWithVariance] = useState(false);

  const archiveStats = useMemo(() => {
    let totalCashSales = 0;
    let totalSafeDrop = 0;
    let netVariance = 0;
    let varianceShiftsCount = 0;

    closedShifts.forEach((s) => {
      totalCashSales += s.cashSalesTotal;
      totalSafeDrop += s.safeDropAmount || 0;
      const variance = s.variance || 0;
      netVariance += variance;
      if (variance !== 0) varianceShiftsCount += 1;
    });

    return {
      totalCashSales,
      totalSafeDrop,
      netVariance,
      varianceShiftsCount,
    };
  }, [closedShifts]);

  const filteredShifts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return closedShifts.filter((s) => {
      if (onlyWithVariance && (s.variance || 0) === 0) return false;
      if (
        q &&
        !s.id.toLowerCase().includes(q) &&
        !s.pharmacistName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [closedShifts, searchQuery, onlyWithVariance]);

  const filteredSafeDrop = useMemo(
    () => filteredShifts.reduce((sum, s) => sum + (s.safeDropAmount || 0), 0),
    [filteredShifts],
  );

  const filteredVariance = useMemo(
    () => filteredShifts.reduce((sum, s) => sum + (s.variance || 0), 0),
    [filteredShifts],
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* الترويسة وبطاقات الملخص */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-sky-400" /> سجل تقارير تسليم
            الورديات السابقة (Z-Reports Archive)
          </h3>
          <p className="text-slate-400 text-[11px] mt-0.5">
            أرشيف كامل لمطابقات الدرج، المبالغ المورّدة للخزنة، والعهد المرحلة
            لكل وردية مغلقة.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-slate-400">عدد الورديات</div>
            <div className="font-mono font-bold text-white text-sm">
              {closedShifts.length}
            </div>
          </div>

          <div className="bg-emerald-950/30 border border-emerald-800/70 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-emerald-300/80">
              إجمالي مبيعات الكاش
            </div>
            <div className="font-mono font-extrabold text-emerald-400 text-sm">
              {archiveStats.totalCashSales.toFixed(2)} ر.س
            </div>
          </div>

          <div className="bg-purple-950/30 border border-purple-800/70 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-purple-300/80">
              إجمالي المورّد للخزنة
            </div>
            <div className="font-mono font-extrabold text-purple-400 text-sm">
              {archiveStats.totalSafeDrop.toFixed(2)} ر.س
            </div>
          </div>

          <div
            className={`rounded-xl px-3.5 py-2 text-center border ${
              archiveStats.netVariance < 0
                ? "bg-rose-950/35 border-rose-800/70"
                : archiveStats.netVariance > 0
                  ? "bg-sky-950/35 border-sky-800/70"
                  : "bg-slate-950 border-slate-800"
            }`}
          >
            <div className="text-[10px] text-slate-400">صافي الفروقات</div>
            <div
              className={`font-mono font-extrabold text-sm ${
                archiveStats.netVariance < 0
                  ? "text-rose-400"
                  : archiveStats.netVariance > 0
                    ? "text-sky-400"
                    : "text-emerald-400"
              }`}
            >
              {archiveStats.netVariance > 0
                ? `+${archiveStats.netVariance.toFixed(2)}`
                : archiveStats.netVariance.toFixed(2)}{" "}
              ر.س
            </div>
          </div>
        </div>
      </div>

      {/* شريط البحث والفلترة داخل الأرشيف */}
      {closedShifts.length > 0 && (
        <div className="flex items-center justify-between gap-3 bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الوردية أو اسم الصيدلي المناوب..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-lg pr-9 pl-3 py-1.5 text-white outline-none"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => setOnlyWithVariance((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 transition ${
                onlyWithVariance
                  ? "bg-rose-950/60 border-rose-700 text-rose-300"
                  : "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              الورديات ذات الفارق ({archiveStats.varianceShiftsCount})
            </button>

            <div className="text-slate-400 font-mono text-[11px]">
              المعروض: <b className="text-white">{filteredShifts.length}</b> •
              توريد:{" "}
              <b className="text-purple-400">{filteredSafeDrop.toFixed(2)}</b> •
              فارق:{" "}
              <b
                className={
                  filteredVariance < 0
                    ? "text-rose-400"
                    : filteredVariance > 0
                      ? "text-sky-400"
                      : "text-emerald-400"
                }
              >
                {filteredVariance > 0
                  ? `+${filteredVariance.toFixed(2)}`
                  : filteredVariance.toFixed(2)}
              </b>
            </div>
          </div>
        </div>
      )}

      {/* جدول الأرشيف أو الحالة الفارغة */}
      {closedShifts.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-500 text-center gap-2">
          <History className="w-9 h-9 text-slate-700 stroke-1" />
          <p className="font-bold text-slate-400">
            لا توجد ورديات مغلقة في الأرشيف حتى الآن.
          </p>
          <p className="text-[11px] text-slate-500">
            عند إغلاق الوردية واعتماد تقرير Z-Report سيُحفظ سجل المطابقة هنا
            تلقائياً.
          </p>
        </div>
      ) : filteredShifts.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          لا توجد ورديات مطابقة لخيارات البحث أو الفلترة الحالية.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 px-2">رقم الوردية</th>
                <th className="py-2 px-2">الصيدلي</th>
                <th className="py-2 px-2">العهدة الافتتاحية</th>
                <th className="py-2 px-2">مبيعات الكاش</th>
                <th className="py-2 px-2">النقد المتوقع</th>
                <th className="py-2 px-2">الجرد الفعلي</th>
                <th className="py-2 px-2">الفارق (Variance)</th>
                <th className="py-2 px-2">المورّد للخزنة</th>
                <th className="py-2 px-2">العهدة المرحلة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredShifts.map((s) => {
                const variance = s.variance || 0;
                return (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-2 font-bold text-white">{s.id}</td>
                    <td className="py-2.5 px-2 font-sans font-semibold text-slate-200">
                      {s.pharmacistName}
                    </td>
                    <td className="py-2.5 px-2">
                      {s.openingBalance.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-emerald-400">
                      {s.cashSalesTotal.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-amber-400">
                      {s.expectedDrawerCash.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 font-bold text-white">
                      {(s.actualDrawerCash ?? 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 font-bold">
                      <span
                        className={`inline-flex items-center gap-1 ${
                          variance < 0
                            ? "text-rose-400"
                            : variance > 0
                              ? "text-sky-400"
                              : "text-emerald-400"
                        }`}
                      >
                        {variance === 0 ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <AlertOctagon className="w-3.5 h-3.5" />
                        )}
                        {variance > 0
                          ? `+${variance.toFixed(2)}`
                          : variance.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-purple-400">
                      {(s.safeDropAmount || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-slate-300">
                      {(s.nextShiftFloat || 0).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
