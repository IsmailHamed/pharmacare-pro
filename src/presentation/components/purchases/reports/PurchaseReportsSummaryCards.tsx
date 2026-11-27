import React from "react";
import { PurchaseReportsSummary } from "./purchaseReports.config";
import { CreditCard, FileText, Gift, Package } from "lucide-react";

interface Props {
  summary: PurchaseReportsSummary;
}

/**
 * شريط المؤشرات الملخصة (KPIs) لتقارير فواتير الشراء والبونص
 */
export const PurchaseReportsSummaryCards: React.FC<Props> = ({ summary }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
      <div className="text-[11px] text-slate-400 flex items-center justify-between">
        <span>عدد فواتير الشراء</span>
        <FileText className="w-4 h-4 text-indigo-400" />
      </div>
      <div className="font-mono font-extrabold text-lg text-white mt-1">
        {summary.invoicesCount}
        <span className="text-[11px] font-sans font-normal text-slate-400 mr-1.5">
          ({summary.totalLinesCount} بند)
        </span>
      </div>
      <div className="text-[10.5px] text-slate-500 font-mono mt-0.5">
        العلب: {summary.totalPurchasedPacks} مشتراة +{" "}
        <span className="text-emerald-400">{summary.totalBonusPacks} بونص</span>
      </div>
    </div>

    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
      <div className="text-[11px] text-slate-400 flex items-center justify-between">
        <span>إجمالي المشتريات</span>
        <Package className="w-4 h-4 text-sky-400" />
      </div>
      <div className="font-mono font-extrabold text-lg text-white mt-1">
        {summary.totalAmount.toFixed(2)}{" "}
        <span className="text-xs font-sans text-slate-400">ر.س</span>
      </div>
      <div className="text-[10.5px] text-slate-500 mt-0.5">
        مجموع صافي فواتير الشراء المطابقة
      </div>
    </div>

    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
      <div className="text-[11px] text-slate-400 flex items-center justify-between">
        <span>توزيع الدفع (نقدي / آجل)</span>
        <CreditCard className="w-4 h-4 text-amber-400" />
      </div>
      <div className="mt-1.5 space-y-1 font-mono text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-sky-300 font-sans">نقدي:</span>
          <b className="text-sky-400">{summary.cashTotal.toFixed(2)} ر.س</b>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-amber-300 font-sans">آجل (ذمم):</span>
          <b className="text-amber-400">{summary.creditTotal.toFixed(2)} ر.س</b>
        </div>
      </div>
    </div>

    <div className="bg-emerald-950/25 border border-emerald-800/60 rounded-2xl p-3.5">
      <div className="text-[11px] text-emerald-300/90 flex items-center justify-between">
        <span>إجمالي قيمة البونص المجاني</span>
        <Gift className="w-4 h-4 text-emerald-400" />
      </div>
      <div className="font-mono font-extrabold text-lg text-emerald-400 mt-1">
        +{summary.totalBonusValue.toFixed(2)}{" "}
        <span className="text-xs font-sans text-emerald-300/80">ر.س</span>
      </div>
      <div className="text-[10.5px] text-emerald-300/70 font-mono mt-0.5">
        إجمالي الوفر الناتج عن البونص ({summary.totalBonusPacks} علبة)
      </div>
    </div>
  </div>
);
