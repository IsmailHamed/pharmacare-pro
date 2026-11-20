import React, { useMemo } from "react";
import { CashExpenseEntity } from "../../../domain/entities";
import {
  TrendingUp,
  TrendingDown,
  PieChart,
  Receipt,
  AlertTriangle,
} from "lucide-react";

export interface IncomeStatementSummary {
  grossSales: number;
  totalReturns: number;
  netRevenue: number;
  netCogs: number;
  grossProfit: number;
  totalExpenses: number;
  netOperatingProfit: number;
}

const EXPENSE_CATEGORY_LABELS: Record<CashExpenseEntity["category"], string> = {
  SUPPLIES: "مستلزمات وأكياس",
  UTILITIES: "كهرباء ومياه ومرافق",
  DELIVERY: "توصيل ونقل",
  MAINTENANCE: "صيانة",
  OTHER: "مصاريف نثرية أخرى",
};

interface Props {
  incomeStatement: IncomeStatementSummary;
  expenses: CashExpenseEntity[];
}

/**
 * تبويب قائمة الدخل والأرباح المحاسبية (محمي بصلاحية canViewCostAndProfit)
 * يعرض تفاصيل المبيعات، تكلفة البضاعة المباعة (COGS)، هوامش الربح، وتوزيع المصروفات والتوالف
 */
export const IncomeStatementTab: React.FC<Props> = ({
  incomeStatement,
  expenses,
}) => {
  const {
    grossSales,
    totalReturns,
    netRevenue,
    netCogs,
    grossProfit,
    totalExpenses,
    netOperatingProfit,
  } = incomeStatement;

  const grossMarginPercent =
    netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
  const netMarginPercent =
    netRevenue > 0 ? (netOperatingProfit / netRevenue) * 100 : 0;
  const returnRatePercent =
    grossSales > 0 ? (totalReturns / grossSales) * 100 : 0;

  // تفصيل المصروفات بين المصاريف التشغيلية حسب الفئة وخسائر التوالف والفروقات الجردية
  const expenseBreakdown = useMemo(() => {
    let operationalTotal = 0;
    let inventoryLossTotal = 0;
    const categoryTotals: Record<
      string,
      { label: string; amount: number; count: number; isLoss?: boolean }
    > = {};

    expenses.forEach((exp) => {
      if (exp.shiftId === "INVENTORY-LOSS") {
        inventoryLossTotal += exp.amount;
        const key = "INVENTORY-LOSS";
        if (!categoryTotals[key]) {
          categoryTotals[key] = {
            label: "توالف وكسور وفروقات جردية",
            amount: 0,
            count: 0,
            isLoss: true,
          };
        }
        categoryTotals[key].amount += exp.amount;
        categoryTotals[key].count += 1;
      } else {
        operationalTotal += exp.amount;
        const key = exp.category;
        if (!categoryTotals[key]) {
          categoryTotals[key] = {
            label: EXPENSE_CATEGORY_LABELS[exp.category] || exp.category,
            amount: 0,
            count: 0,
          };
        }
        categoryTotals[key].amount += exp.amount;
        categoryTotals[key].count += 1;
      }
    });

    const items = Object.entries(categoryTotals)
      .map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => b.amount - a.amount);

    return { operationalTotal, inventoryLossTotal, items };
  }, [expenses]);

  const isProfitable = netOperatingProfit >= 0;

  return (
    <div className="space-y-5">
      {/* 1. بطاقات المؤشرات الرئيسية لقائمة الدخل */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] text-slate-400">صافي المبيعات</div>
          <div className="font-mono font-extrabold text-xl text-white mt-1">
            {netRevenue.toFixed(2)}{" "}
            <span className="text-xs font-normal text-slate-400">ر.س</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">
            نسبة المرتجعات: {returnRatePercent.toFixed(1)}%
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] text-slate-400">
            مجمل الربح (Gross Profit)
          </div>
          <div className="font-mono font-extrabold text-xl text-sky-400 mt-1">
            {grossProfit.toFixed(2)}{" "}
            <span className="text-xs font-normal text-slate-400">ر.س</span>
          </div>
          <div className="text-[10px] text-sky-300/80 mt-1 font-mono">
            هامش مجمل الربح: {grossMarginPercent.toFixed(1)}%
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] text-slate-400">
            إجمالي المصاريف والتوالف
          </div>
          <div className="font-mono font-extrabold text-xl text-rose-400 mt-1">
            -{totalExpenses.toFixed(2)}{" "}
            <span className="text-xs font-normal text-slate-400">ر.س</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">
            تشغيلي: {expenseBreakdown.operationalTotal.toFixed(2)} • توالف:{" "}
            {expenseBreakdown.inventoryLossTotal.toFixed(2)}
          </div>
        </div>

        <div
          className={`rounded-2xl p-4 border ${
            isProfitable
              ? "bg-emerald-950/30 border-emerald-800"
              : "bg-rose-950/30 border-rose-800"
          }`}
        >
          <div
            className={`text-[11px] font-bold flex items-center gap-1.5 ${
              isProfitable ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {isProfitable ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            صافي الربح الفعلي (Net Profit)
          </div>
          <div
            className={`font-mono font-extrabold text-xl mt-1 ${
              isProfitable ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {netOperatingProfit.toFixed(2)}{" "}
            <span className="text-xs font-normal opacity-75">ر.س</span>
          </div>
          <div
            className={`text-[10px] mt-1 font-mono ${
              isProfitable ? "text-emerald-300/80" : "text-rose-300/80"
            }`}
          >
            هامش صافي الربح: {netMarginPercent.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* 2. تفاصيل قائمة الدخل + توزيع المصروفات حسب الفئة */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* جدول بنود قائمة الدخل التفصيلي */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2.5">
          <h3 className="font-bold text-white text-sm flex items-center gap-2 pb-2 border-b border-slate-800">
            <Receipt className="w-4 h-4 text-emerald-400" /> تفصيل قائمة الدخل
            المحاسبية
          </h3>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between">
            <span className="text-slate-400">
              إجمالي المبيعات (Gross Sales):
            </span>
            <span className="font-mono font-bold text-white">
              {grossSales.toFixed(2)} ر.س
            </span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between">
            <span className="text-slate-400">
              (-) إجمالي المرتجعات (Returns):
            </span>
            <span className="font-mono font-bold text-rose-400">
              -{totalReturns.toFixed(2)} ر.س
            </span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-700/80 flex justify-between">
            <span className="text-slate-200 font-bold">
              (=) صافي المبيعات (Net Revenue):
            </span>
            <span className="font-mono font-bold text-white">
              {netRevenue.toFixed(2)} ر.س
            </span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between">
            <span className="text-slate-400">
              (-) تكلفة البضاعة المباعة (COGS):
            </span>
            <span className="font-mono font-bold text-amber-400">
              -{netCogs.toFixed(2)} ر.س
            </span>
          </div>

          <div className="bg-sky-950/25 p-3 rounded-xl border border-sky-800/70 flex justify-between">
            <span className="text-sky-200 font-bold">
              (=) مجمل الربح التشغيلي (Gross Profit):
            </span>
            <span className="font-mono font-bold text-sky-400">
              {grossProfit.toFixed(2)} ر.س
            </span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between">
            <span className="text-slate-400">
              (-) المصاريف التشغيلية والنثرية:
            </span>
            <span className="font-mono font-bold text-rose-400">
              -{expenseBreakdown.operationalTotal.toFixed(2)} ر.س
            </span>
          </div>

          {expenseBreakdown.inventoryLossTotal > 0 && (
            <div className="bg-slate-950 p-3 rounded-xl border border-rose-900/60 flex justify-between">
              <span className="text-rose-300/90 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                (-) خسائر التوالف والفروقات الجردية:
              </span>
              <span className="font-mono font-bold text-rose-400">
                -{expenseBreakdown.inventoryLossTotal.toFixed(2)} ر.س
              </span>
            </div>
          )}

          <div
            className={`p-3.5 rounded-xl border flex justify-between items-center ${
              isProfitable
                ? "bg-emerald-950/35 border-emerald-800"
                : "bg-rose-950/35 border-rose-800"
            }`}
          >
            <span
              className={`font-bold ${
                isProfitable ? "text-emerald-200" : "text-rose-200"
              }`}
            >
              (=) صافي الربح الفعلي (Net Profit):
            </span>
            <span
              className={`font-mono font-extrabold text-base ${
                isProfitable ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {netOperatingProfit.toFixed(2)} ر.س
            </span>
          </div>
        </div>

        {/* توزيع المصروفات والتوالف حسب الفئة */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <PieChart className="w-4 h-4 text-amber-400" /> تحليل وتوزيع
              المصروفات
            </h3>
            <span className="font-mono text-[11px] text-slate-400">
              {expenses.length} قيد مسجل
            </span>
          </div>

          {expenseBreakdown.items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-500 text-center gap-2">
              <PieChart className="w-8 h-8 text-slate-700 stroke-1" />
              <p>لا توجد مصروفات أو قيود توالف مسجلة حتى الآن.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {expenseBreakdown.items.map((item) => {
                const sharePercent =
                  totalExpenses > 0 ? (item.amount / totalExpenses) * 100 : 0;

                return (
                  <div
                    key={item.key}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold ${
                            item.isLoss ? "text-rose-300" : "text-slate-200"
                          }`}
                        >
                          {item.label}
                        </span>
                        <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                          {item.count} قيد
                        </span>
                      </div>
                      <div className="font-mono text-left">
                        <span className="font-bold text-rose-400">
                          -{item.amount.toFixed(2)} ر.س
                        </span>
                        <span className="text-[10px] text-slate-500 mr-1.5">
                          ({sharePercent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          item.isLoss ? "bg-rose-500" : "bg-amber-500"
                        }`}
                        style={{ width: `${Math.min(100, sharePercent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
