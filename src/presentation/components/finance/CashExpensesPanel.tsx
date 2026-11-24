import React, { useMemo, useState } from "react";
import { CashExpenseEntity } from "../../../domain/entities";
import { usePosStore } from "../../../application/store/usePosStore";
import {
  DEFAULT_DATE_RANGE,
  DateRangeValue,
  isDateRangeActive,
  matchesDateRange,
} from "../common/table/dateRangeUtils";
import { DateRangeFilter } from "../common/table/DateRangeFilter";
import { FilterPillOption, FilterPills } from "../common/table/FilterPills";
import { useTablePagination } from "../common/table/useTablePagination";
import { DataTableToolbar } from "../common/table/DataTableToolbar";
import { TableEmptyState } from "../common/table/TableEmptyState";
import { TableLoadMoreFooter } from "../common/table/TableLoadMoreFooter";
import { Wallet, PlusCircle, Lock, User } from "lucide-react";

const EXPENSE_CATEGORY_LABELS: Record<CashExpenseEntity["category"], string> = {
  SUPPLIES: "مستلزمات وأكياس",
  UTILITIES: "كهرباء ومياه ومرافق",
  DELIVERY: "توصيل ونقل",
  MAINTENANCE: "صيانة",
  OTHER: "أخرى",
};

type ShiftScopeFilter = "ALL" | "CURRENT";

// خيارات نطاق الوردية الممرّرة إلى المكوّن الموحّد FilterPills
const SHIFT_SCOPE_OPTIONS: readonly FilterPillOption<ShiftScopeFilter>[] = [
  { id: "ALL", label: "كل الورديات", tone: "slate" },
  { id: "CURRENT", label: "الوردية الحالية", tone: "amber" },
];

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
 * مقفلة بصرياً عند إغلاق الوردية وتوثّق اسم المستخدم المنفّذ لكل قيد،
 * وتستخدم نواة الجداول الموحّدة للفلترة بالتاريخ والتحميل التدريجي
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
  const [shiftScope, setShiftScope] = useState<ShiftScopeFilter>("ALL");
  // حالة نطاق التواريخ الموحّدة (الأزرار السريعة + النطاق اليدوي من/إلى)
  const [dateRange, setDateRange] =
    useState<DateRangeValue>(DEFAULT_DATE_RANGE);

  // إخفاء قيود خسائر التوالف والجرد (INVENTORY-LOSS) عن غير المخولين لأنها محسوبة بالتكلفة المرجحة
  const accessibleExpenses = useMemo(
    () =>
      hasCostAndProfitAccess
        ? expenses
        : expenses.filter((exp) => exp.shiftId !== "INVENTORY-LOSS"),
    [expenses, hasCostAndProfitAccess],
  );

  // تصفية المصروفات حسب الوردية، الفئة، نطاق التواريخ الموحّد، وعبارة البحث
  const filteredExpenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accessibleExpenses.filter((exp) => {
      if (
        shiftScope === "CURRENT" &&
        activeShiftId &&
        exp.shiftId !== activeShiftId
      ) {
        return false;
      }
      if (filterCategory !== "ALL" && exp.category !== filterCategory) {
        return false;
      }
      if (!matchesDateRange(exp.createdAt, dateRange)) return false;

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
    shiftScope,
    activeShiftId,
    filterCategory,
    dateRange,
    searchQuery,
  ]);

  // التحميل التدريجي لقائمة المصروفات (50 مصروفاً في الدفعة) مع إعادة ضبط تلقائية عند تغيّر الفلاتر
  const pagination = useTablePagination(filteredExpenses, {
    pageSize: 50,
    resetDeps: [
      searchQuery,
      filterCategory,
      shiftScope,
      dateRange.from,
      dateRange.to,
    ],
  });

  const filteredTotal = useMemo(
    () => filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0),
    [filteredExpenses],
  );

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    filterCategory !== "ALL" ||
    shiftScope !== "ALL" ||
    isDateRangeActive(dateRange);

  const handleResetFilters = () => {
    setSearchQuery("");
    setFilterCategory("ALL");
    setShiftScope("ALL");
    setDateRange(DEFAULT_DATE_RANGE);
  };

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

      {/* شريط البحث والفلترة الموحّد لسجل المصروفات */}
      {accessibleExpenses.length > 0 && (
        <div className="pt-2.5 border-t border-slate-800">
          <DataTableToolbar
            accent="amber"
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="بحث بالبيان، الملاحظات، أو اسم الموظف..."
            filters={
              <>
                <select
                  value={filterCategory}
                  onChange={(e) =>
                    setFilterCategory(
                      e.target.value as "ALL" | CashExpenseEntity["category"],
                    )
                  }
                  className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-2.5 py-2 text-[11px] text-slate-200 outline-none"
                >
                  <option value="ALL">كل الفئات</option>
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(
                    ([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ),
                  )}
                </select>

                {activeShiftId && (
                  <FilterPills
                    variant="segmented"
                    options={SHIFT_SCOPE_OPTIONS}
                    value={shiftScope}
                    onChange={setShiftScope}
                    ariaLabel="تصفية المصروفات حسب الوردية"
                  />
                )}
              </>
            }
            secondaryFilters={
              <DateRangeFilter
                value={dateRange}
                onChange={setDateRange}
                accent="amber"
              />
            }
            hasActiveFilters={hasActiveFilters}
            onResetFilters={handleResetFilters}
            visibleCount={pagination.visibleCount}
            filteredCount={filteredExpenses.length}
            totalCount={accessibleExpenses.length}
            itemLabel="مصروف"
          />
        </div>
      )}

      {/* قائمة المصروفات المسجلة */}
      <div className="flex-1 overflow-y-auto max-h-[300px] space-y-1.5 pr-0.5">
        {accessibleExpenses.length === 0 ? (
          <TableEmptyState
            compact
            variant="empty"
            icon={Wallet}
            title="لا توجد مصروفات مسجلة حتى الآن"
            description="عند تسجيل أي مصروف نثري من الدرج سيظهر هنا مع اسم المنفّذ والتاريخ."
          />
        ) : filteredExpenses.length === 0 ? (
          <TableEmptyState
            compact
            variant="no-results"
            searchQuery={searchQuery}
            onResetFilters={handleResetFilters}
            description="لا توجد مصروفات مطابقة لخيارات البحث أو الفلترة الحالية."
          />
        ) : (
          <>
            {pagination.visibleItems.map((exp) => {
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
            })}

            {/* تذييل التحميل التدريجي الموحّد */}
            <TableLoadMoreFooter
              visibleCount={pagination.visibleCount}
              totalCount={pagination.totalCount}
              remainingCount={pagination.remainingCount}
              pageSize={pagination.pageSize}
              hasMore={pagination.hasMore}
              onLoadMore={pagination.loadMore}
              onShowAll={pagination.showAll}
              itemLabel="مصروف"
              accent="amber"
            />
          </>
        )}
      </div>
    </div>
  );
};
