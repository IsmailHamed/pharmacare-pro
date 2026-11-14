import React, { useState } from "react";
import { CashExpenseEntity } from "../../../domain/entities";
import { TrendingUp, Wallet, PlusCircle } from "lucide-react";

export interface IncomeStatementSummary {
  grossSales: number;
  totalReturns: number;
  netRevenue: number;
  netCogs: number;
  grossProfit: number;
  totalExpenses: number;
  netOperatingProfit: number;
}

interface Props {
  incomeStatement: IncomeStatementSummary;
  expenses: CashExpenseEntity[];
  onAddExpense: (
    title: string,
    category: CashExpenseEntity["category"],
    amount: number,
  ) => Promise<void>;
}

export const IncomeAndExpensesRow: React.FC<Props> = ({
  incomeStatement,
  expenses,
  onAddExpense,
}) => {
  const [title, setTitle] = useState("");
  const [category, setCategory] =
    useState<CashExpenseEntity["category"]>("SUPPLIES");
  const [amount, setAmount] = useState(0);

  const handleCreateExpense = () => {
    if (!title.trim() || amount <= 0) return;
    void onAddExpense(title, category, amount);
    setTitle("");
    setAmount(0);
  };

  return (
    <>
      {/* 1. قائمة الدخل والأرباح المحاسبية */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2.5">
        <h3 className="font-bold text-white text-sm flex items-center gap-2 pb-1 border-b border-slate-800">
          <TrendingUp className="w-4 h-4 text-emerald-400" /> قائمة الدخل وصافي
          الربح المحاسبي
        </h3>
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between">
          <span className="text-slate-400">صافي المبيعات (بعد المرتجع):</span>
          <span className="font-mono font-bold text-white">
            {incomeStatement.netRevenue.toFixed(2)}
          </span>
        </div>
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between">
          <span className="text-slate-400">تكلفة البضاعة المباعة (COGS):</span>
          <span className="font-mono font-bold text-amber-400">
            -{incomeStatement.netCogs.toFixed(2)}
          </span>
        </div>
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between">
          <span className="text-slate-300 font-bold">
            مجمل الربح التشغيلي (Gross Profit):
          </span>
          <span className="font-mono font-bold text-sky-400">
            {incomeStatement.grossProfit.toFixed(2)}
          </span>
        </div>
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between">
          <span className="text-slate-400">المصاريف التشغيلية والنثرية:</span>
          <span className="font-mono font-bold text-rose-400">
            -{incomeStatement.totalExpenses.toFixed(2)}
          </span>
        </div>
        <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-800 flex justify-between">
          <span className="font-bold text-emerald-200">
            صافي الربح الفعلي (Net Profit):
          </span>
          <span className="font-mono font-extrabold text-base text-emerald-400">
            {incomeStatement.netOperatingProfit.toFixed(2)}
          </span>
        </div>
      </div>

      {/* 2. تسجيل مصروف نثري */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h3 className="font-bold text-white text-sm flex items-center gap-2 pb-1 border-b border-slate-800">
          <Wallet className="w-4 h-4 text-amber-400" /> تسجيل مصروفات الصيدلية
        </h3>
        <input
          type="text"
          placeholder="بيان المصروف (مثال: فاتورة كهرباء / أكياس)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as CashExpenseEntity["category"])
            }
            className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
          >
            <option value="SUPPLIES">مستلزمات وأكياس</option>
            <option value="UTILITIES">كهرباء ومياه ومرافق</option>
            <option value="DELIVERY">توصيل ونقل</option>
            <option value="MAINTENANCE">صيانة</option>
            <option value="OTHER">أخرى</option>
          </select>
          <input
            type="number"
            placeholder="المبلغ"
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white font-mono"
          />
        </div>
        <button
          onClick={handleCreateExpense}
          className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-1"
        >
          <PlusCircle className="w-4 h-4" /> خصم من درج الكاشير
        </button>

        {expenses.length > 0 && (
          <div className="pt-2 space-y-1.5 max-h-28 overflow-y-auto">
            <div className="text-[11px] text-slate-400 font-bold">
              آخر المصروفات المسجلة:
            </div>
            {expenses.slice(0, 4).map((exp) => (
              <div
                key={exp.id}
                className="flex justify-between text-[11px] bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800"
              >
                <span>{exp.title}</span>
                <span className="font-mono text-rose-400">
                  -{exp.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
