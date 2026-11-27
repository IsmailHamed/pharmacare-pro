import React from "react";
import { InvoicesArchiveStats } from "./invoicesHistory.config";
import { FileText } from "lucide-react";

interface Props {
  totalInvoicesCount: number;
  stats: InvoicesArchiveStats;
}

/**
 * ترويسة سجل فواتير المبيعات والمرتجعات مع بطاقات الملخص المالي العلوي
 */
export const InvoicesHistoryHeader: React.FC<Props> = ({
  totalInvoicesCount,
  stats,
}) => (
  <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
    <div>
      <h3 className="font-bold text-white text-sm flex items-center gap-2">
        <FileText className="w-4 h-4 text-emerald-400" /> سجل فواتير المبيعات
        والمرتجعات
      </h3>
      <p className="text-slate-400 text-[11px] mt-0.5">
        أرشيف تفصيلي لكافة الفواتير الصادرة مع التوثيق الرقابي للأصناف والمنفّذ
        والوردية وإمكانية الطباعة والاسترداد.
      </p>
    </div>

    <div className="flex items-center gap-2.5 flex-wrap">
      <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-center">
        <div className="text-[10px] text-slate-400">إجمالي الفواتير</div>
        <div className="font-mono font-bold text-white text-sm">
          {totalInvoicesCount}
        </div>
      </div>

      <div className="bg-emerald-950/30 border border-emerald-800/70 rounded-xl px-3.5 py-2 text-center">
        <div className="text-[10px] text-emerald-300/80">
          المبيعات ({stats.salesCount})
        </div>
        <div className="font-mono font-extrabold text-emerald-400 text-sm">
          +{stats.salesTotal.toFixed(2)} ر.س
        </div>
      </div>

      <div className="bg-rose-950/35 border border-rose-800/70 rounded-xl px-3.5 py-2 text-center">
        <div className="text-[10px] text-rose-300/80">
          المرتجعات ({stats.returnsCount})
        </div>
        <div className="font-mono font-extrabold text-rose-400 text-sm">
          -{stats.returnsTotal.toFixed(2)} ر.س
        </div>
      </div>

      <div className="bg-sky-950/35 border border-sky-800/70 rounded-xl px-3.5 py-2 text-center">
        <div className="text-[10px] text-sky-300/80">صافي الفواتير</div>
        <div
          className={`font-mono font-extrabold text-sm ${
            stats.netTotal < 0 ? "text-rose-400" : "text-sky-400"
          }`}
        >
          {stats.netTotal.toFixed(2)} ر.س
        </div>
      </div>
    </div>
  </div>
);
