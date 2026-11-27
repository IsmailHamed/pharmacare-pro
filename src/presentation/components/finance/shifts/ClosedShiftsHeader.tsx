import React from "react";
import { ClosedShiftsArchiveStats } from "./closedShifts.config";
import { History } from "lucide-react";

interface Props {
  totalShiftsCount: number;
  stats: ClosedShiftsArchiveStats;
}

/**
 * ترويسة أرشيف الورديات المغلقة (Z-Reports Archive) وبطاقات الملخص المالي
 */
export const ClosedShiftsHeader: React.FC<Props> = ({
  totalShiftsCount,
  stats,
}) => (
  <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
    <div>
      <h3 className="font-bold text-white text-sm flex items-center gap-2">
        <History className="w-4 h-4 text-sky-400" /> سجل تقارير تسليم الورديات
        السابقة (Z-Reports Archive)
      </h3>
      <p className="text-slate-400 text-[11px] mt-0.5">
        أرشيف كامل لمطابقات الدرج، المبالغ المورّدة للخزنة، والعهد المرحلة لكل
        وردية مغلقة.
      </p>
    </div>

    <div className="flex items-center gap-2.5 flex-wrap">
      <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-center">
        <div className="text-[10px] text-slate-400">عدد الورديات</div>
        <div className="font-mono font-bold text-white text-sm">
          {totalShiftsCount}
        </div>
      </div>

      <div className="bg-emerald-950/30 border border-emerald-800/70 rounded-xl px-3.5 py-2 text-center">
        <div className="text-[10px] text-emerald-300/80">
          إجمالي مبيعات الكاش
        </div>
        <div className="font-mono font-extrabold text-emerald-400 text-sm">
          {stats.totalCashSales.toFixed(2)} ر.س
        </div>
      </div>

      <div className="bg-purple-950/30 border border-purple-800/70 rounded-xl px-3.5 py-2 text-center">
        <div className="text-[10px] text-purple-300/80">
          إجمالي المورّد للخزنة
        </div>
        <div className="font-mono font-extrabold text-purple-400 text-sm">
          {stats.totalSafeDrop.toFixed(2)} ر.س
        </div>
      </div>

      <div
        className={`rounded-xl px-3.5 py-2 text-center border ${
          stats.netVariance < 0
            ? "bg-rose-950/35 border-rose-800/70"
            : stats.netVariance > 0
              ? "bg-sky-950/35 border-sky-800/70"
              : "bg-slate-950 border-slate-800"
        }`}
      >
        <div className="text-[10px] text-slate-400">صافي الفروقات</div>
        <div
          className={`font-mono font-extrabold text-sm ${
            stats.netVariance < 0
              ? "text-rose-400"
              : stats.netVariance > 0
                ? "text-sky-400"
                : "text-emerald-400"
          }`}
        >
          {stats.netVariance > 0
            ? `+${stats.netVariance.toFixed(2)}`
            : stats.netVariance.toFixed(2)}{" "}
          ر.س
        </div>
      </div>
    </div>
  </div>
);
