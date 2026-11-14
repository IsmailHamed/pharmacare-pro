import React from "react";
import { Flame, AlertTriangle, ArchiveRestore } from "lucide-react";

export type InventoryFilterMode =
  | "ALL"
  | "LOW_STOCK"
  | "EXP_30"
  | "EXP_90"
  | "EXP_180"
  | "DEAD_STOCK";

export interface RadarStats {
  lowStockCount: number;
  exp30Count: number;
  exp90Count: number;
  exp180Count: number;
  deadStockCount: number;
}

interface Props {
  totalProducts: number;
  filterMode: InventoryFilterMode;
  radarStats: RadarStats;
  onSelectFilter: (mode: InventoryFilterMode) => void;
}

export const InventoryRadarBar: React.FC<Props> = ({
  totalProducts,
  filterMode,
  radarStats,
  onSelectFilter,
}) => {
  return (
    <div className="grid grid-cols-6 gap-2.5 mb-5">
      <button
        onClick={() => onSelectFilter("ALL")}
        className={`p-3 rounded-xl border text-right transition ${
          filterMode === "ALL"
            ? "bg-slate-800 border-emerald-500 text-white"
            : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
        }`}
      >
        <div className="text-[11px]">إجمالي الأصناف</div>
        <div className="text-base font-extrabold text-white font-mono mt-0.5">
          {totalProducts}
        </div>
      </button>

      <button
        onClick={() => onSelectFilter("EXP_30")}
        className={`p-3 rounded-xl border text-right transition ${
          filterMode === "EXP_30"
            ? "bg-rose-950/80 border-rose-500 text-rose-200"
            : "bg-slate-900 border-slate-800 text-rose-400 hover:border-rose-800"
        }`}
      >
        <div className="text-[11px] flex items-center gap-1 font-bold">
          <Flame className="w-3.5 h-3.5" /> خطر صلاحية (أقل من 30 يوماً)
        </div>
        <div className="text-base font-extrabold font-mono mt-0.5">
          {radarStats.exp30Count} صنف
        </div>
      </button>

      <button
        onClick={() => onSelectFilter("EXP_90")}
        className={`p-3 rounded-xl border text-right transition ${
          filterMode === "EXP_90"
            ? "bg-orange-950/80 border-orange-500 text-orange-200"
            : "bg-slate-900 border-slate-800 text-orange-400 hover:border-orange-800"
        }`}
      >
        <div className="text-[11px] font-bold">
          صلاحية قريبة (31 - 90 يوماً)
        </div>
        <div className="text-base font-extrabold font-mono mt-0.5">
          {radarStats.exp90Count} صنف
        </div>
      </button>

      <button
        onClick={() => onSelectFilter("EXP_180")}
        className={`p-3 rounded-xl border text-right transition ${
          filterMode === "EXP_180"
            ? "bg-amber-950/80 border-amber-500 text-amber-200"
            : "bg-slate-900 border-slate-800 text-amber-400 hover:border-amber-800"
        }`}
      >
        <div className="text-[11px] font-bold">تنبيه مبكر (91 - 180 يوماً)</div>
        <div className="text-base font-extrabold font-mono mt-0.5">
          {radarStats.exp180Count} صنف
        </div>
      </button>

      <button
        onClick={() => onSelectFilter("LOW_STOCK")}
        className={`p-3 rounded-xl border text-right transition ${
          filterMode === "LOW_STOCK"
            ? "bg-sky-950/80 border-sky-500 text-sky-200"
            : "bg-slate-900 border-slate-800 text-sky-400 hover:border-sky-800"
        }`}
      >
        <div className="text-[11px] flex items-center gap-1 font-bold">
          <AlertTriangle className="w-3.5 h-3.5" /> نواقص تحت حد الطلب
        </div>
        <div className="text-base font-extrabold font-mono mt-0.5">
          {radarStats.lowStockCount} صنف
        </div>
      </button>

      <button
        onClick={() => onSelectFilter("DEAD_STOCK")}
        className={`p-3 rounded-xl border text-right transition ${
          filterMode === "DEAD_STOCK"
            ? "bg-purple-950/80 border-purple-500 text-purple-200"
            : "bg-slate-900 border-slate-800 text-purple-400 hover:border-purple-800"
        }`}
      >
        <div className="text-[11px] flex items-center gap-1 font-bold">
          <ArchiveRestore className="w-3.5 h-3.5" /> أدوية راكدة (لم تُبع)
        </div>
        <div className="text-base font-extrabold font-mono mt-0.5">
          {radarStats.deadStockCount} صنف
        </div>
      </button>
    </div>
  );
};
