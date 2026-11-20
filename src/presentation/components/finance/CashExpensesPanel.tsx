import React, { useMemo, useState } from "react";
import { CashExpenseEntity } from "../../../domain/entities";
import { usePosStore } from "../../../application/store/usePosStore";
import { Wallet, PlusCircle, Search, Filter, Lock, User } from "lucide-react";

const EXPENSE_CATEGORY_LABELS: Record<CashExpenseEntity["category"], string> = {
  SUPPLIES: "مستلزمات وأكياس",
  UTILITIES: "كهرباء ومياه ومرافق",
  DELIVERY: "توصيل ونقل",
  MAINTENANCE: "صيانة",
  OTHER: "أخرى",
};

interface Props {
  expenses: CashExpenseEntity[];
  onAddExpense: (
    title: string,
    category: CashExpenseEntity["category"],
    amount: number,
  ) => Promise<void>;
  canViewCostAndProfit?: boolean;
  activeShiftId?: string;
}

/**
 * بطاقة تسجيل ومتابعة مصروفات الصيدلية النثرية للوردية
 * مقفلة بصرياً عند إغلاق الوردية وتوثّق اسم المستخدم المنفّذ لكل قيد
 */
export const CashExpensesPanel: React.FC<Props> = ({
  expenses,
  onAddExpense,
  canViewCostAndProfit,
  activeShiftId,
}) => {
  // قراءة الصلاحية من المتجر كمرجع احتياطي آمن (false) في حال عدم تمريرها عبر Props
  const storeCanViewCost = usePosStore(
    (s) => s.currentUser?.permissions.canViewCostAndProfit ?? false,
  );
  const hasCostAndProfitAccess = canViewCostAndProfit ?? storeCanViewCost;
  const isShiftClosed = !activeShiftId;

  const [title, setTitle] = useState("");
  const [category, setCategory] =
    useState<CashExpenseEntity["category"]>("SUPPLIES");
  const [amountInput, setAmountInput] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<
    "ALL" | CashExpenseEntity["category"]
  >("ALL");
  const [onlyCurrentShift, setOnlyCurrentShift] = useState(false);

  // إخفاء قيود خسائر التوالف والجرد (INVENTORY-LOSS) عن غير المخولين لأنها محسوبة بالتكلفة المرجحة
  const accessibleExpenses = useMemo(
    () =>
      hasCostAndProfitAccess
        ? expenses
        : expenses.filter((exp) => exp.shiftId !== "INVENTORY-LOSS"),
    [expenses, hasCostAndProfitAccess],
  );

  const filteredExpenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accessibleExpenses.filter((exp) => {
      if (onlyCurrentShift && activeShiftId && exp.shiftId !== activeShiftId) {
        return false;
      }
      if (filterCategory !== "ALL" && exp.category !== filterCategory) {
        return false;
      }
      if (
        q &&
        !exp.title.toLowerCase().includes(q) &&
        !(exp.notes || "").toLowerCase().includes(q) &&
        !(exp.performedByName || "").toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [
    accessibleExpenses,
    onlyCurrentShift,
    activeShiftId,
    filterCategory,
    searchQuery,
  ]);

  const filteredTotal = useMemo(
    () => filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0),
    [filteredExpenses],
  );

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (isShiftClosed) return;
    const numericAmount = Number(amountInput);
    if (
      !title.trim() ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      return;
    }
    void onAddExpense(title.trim(), category, numericAmount);
    setTitle("");
    setAmountInput("");
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3.5">
      {/* الترويسة وإجمالي المصروفات الظاهرة */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <Wallet className="w-4 h-4 text-amber-400" /> تسجيل مصروفات الصيدلية
        </h3>
        <span className="font-mono text-[11px] bg-rose-950/40 border border-rose-800/70 text-rose-300 px-2.5 py-0.5 rounded-lg font-bold">
          المجموع: -{filteredTotal.toFixed(2)} ر.س
        </span>
      </div>

      {/* تنبيه قفل الصرف عند إغلاق الوردية */}
      {isShiftClosed && (
        <div className="p-2.5 rounded-xl bg-amber-950/35 border border-amber-800/80 text-amber-200 text-[11px] flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            الوردية مغلقة حالياً — افتح وردية أولاً للسماح بخصم مصروفات نثرية من
            درج الكاشير.
          </span>
        </div>
      )}

      {/* نموذج إضافة مصروف نثري جديد */}
      <form onSubmit={handleCreateExpense} className="space-y-2.5">
        <input
          type="text"
          disabled={isShiftClosed}
          placeholder="بيان المصروف (مثال: فاتورة كهرباء / أكياس)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg p-2.5 text-white outline-none"
        />

        <div className="grid grid-cols-2 gap-2">
          <select
            disabled={isShiftClosed}
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as CashExpenseEntity["category"])
            }
            className="bg-slate-800 border border-slate-700 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg p-2.5 text-white outline-none"
          >
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <input
            type="number"
            min={0}
            step="any"
            disabled={isShiftClosed}
            placeholder="المبلغ"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            className="bg-slate-800 border border-slate-700 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg p-2.5 text-white font-mono outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isShiftClosed || !title.trim() || Number(amountInput) <= 0}
          className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition"
        >
          {isShiftClosed ? (
            <>
              <Lock className="w-4 h-4" /> الصرف مقفل (الوردية مغلقة)
            </>
          ) : (
            <>
              <PlusCircle className="w-4 h-4" /> خصم من درج الكاشير
            </>
          )}
        </button>
      </form>

      {/* شريط البحث والفلترة داخل سجل المصروفات */}
      <div className="pt-2 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            سجل المصروفات ({filteredExpenses.length})
          </span>

          {activeShiftId && (
            <button
              type="button"
              onClick={() => setOnlyCurrentShift((prev) => !prev)}
              className={`text-[10px] px-2 py-0.5 rounded-md border font-bold transition ${
                onlyCurrentShift
                  ? "bg-amber-950/70 border-amber-700 text-amber-300"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
              }`}
            >
              {onlyCurrentShift ? "الوردية الحالية فقط" : "كل الورديات"}
            </button>
          )}
        </div>

        {accessibleExpenses.length > 0 && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالبيان أو اسم الموظف..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg pr-8 pl-2.5 py-1.5 text-[11px] text-white outline-none"
              />
            </div>

            <select
              value={filterCategory}
              onChange={(e) =>
                setFilterCategory(
                  e.target.value as "ALL" | CashExpenseEntity["category"],
                )
              }
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 outline-none"
            >
              <option value="ALL">كل الفئات</option>
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* قائمة المصروفات المسجلة */}
      <div className="flex-1 overflow-y-auto max-h-[300px] space-y-1.5 pr-0.5">
        {accessibleExpenses.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-[11px]">
            لا توجد مصروفات مسجلة حتى الآن.
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-[11px]">
            لا توجد مصروفات مطابقة لخيارات البحث أو الفلترة الحالية.
          </div>
        ) : (
          filteredExpenses.map((exp) => {
            const isInventoryLoss = exp.shiftId === "INVENTORY-LOSS";
            const categoryLabel =
              EXPENSE_CATEGORY_LABELS[exp.category] || exp.category;

            return (
              <div
                key={exp.id}
                className="flex items-center justify-between gap-2 text-[11px] bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 hover:border-slate-700 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-100 flex items-center gap-1.5 flex-wrap">
                    <span className="truncate">{exp.title}</span>
                    <span className="text-[9.5px] font-normal px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {categoryLabel}
                    </span>
                    {isInventoryLoss && (
                      <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800">
                        تالف/جرد
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="font-mono">
                      {new Date(exp.createdAt).toLocaleString("ar-SA")}
                    </span>
                    {exp.performedByName && (
                      <span className="inline-flex items-center gap-0.5 text-sky-400/90">
                        <User className="w-2.5 h-2.5" />
                        {exp.performedByName}
                      </span>
                    )}
                    {exp.notes && (
                      <span className="truncate text-slate-400">
                        • {exp.notes}
                      </span>
                    )}
                  </div>
                </div>
                <span className="font-mono font-bold text-rose-400 shrink-0">
                  -{exp.amount.toFixed(2)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
