import React, { useMemo, useState } from "react";
import { ShiftSummaryEntity } from "../../../domain/entities";
import {
  DEFAULT_DATE_RANGE,
  DateRangeValue,
  isDateRangeActive,
  matchesDateRange,
} from "../common/table/dateRangeUtils";
import { DateRangeFilter } from "../common/table/DateRangeFilter";
import { FilterPillOption, FilterPills } from "../common/table/FilterPills";
import {
  SortAccessors,
  SortDirection,
  SortState,
  useTableSort,
} from "../common/table/useTableSort";
import { useTablePagination } from "../common/table/useTablePagination";
import { SortableTh } from "../common/table/SortableTh";
import { DataTableToolbar } from "../common/table/DataTableToolbar";
import { DataTableShell } from "../common/table/DataTableShell";
import { TableLoadMoreFooter } from "../common/table/TableLoadMoreFooter";
import { History, CheckCircle2, AlertOctagon, UserCheck } from "lucide-react";

interface Props {
  closedShifts: ShiftSummaryEntity[];
}

type VarianceFilter = "ALL" | "WITH_VARIANCE";

// مفاتيح الأعمدة القابلة للفرز التفاعلي في أرشيف الورديات المغلقة
type ClosedShiftSortKey =
  | "closedAt"
  | "pharmacistName"
  | "openingBalance"
  | "cashSalesTotal"
  | "expectedDrawerCash"
  | "actualDrawerCash"
  | "variance"
  | "safeDropAmount"
  | "nextShiftFloat";

// دوال استخراج قيم الأعمدة للفرز (مُعرّفة خارج المكوّن للحفاظ على ثبات المرجع)
const CLOSED_SHIFT_SORT_ACCESSORS: SortAccessors<
  ShiftSummaryEntity,
  ClosedShiftSortKey
> = {
  closedAt: (s) => (s.closedAt ? new Date(s.closedAt) : s.id),
  pharmacistName: (s) => s.pharmacistName,
  openingBalance: (s) => s.openingBalance,
  cashSalesTotal: (s) => s.cashSalesTotal,
  expectedDrawerCash: (s) => s.expectedDrawerCash,
  actualDrawerCash: (s) => s.actualDrawerCash ?? 0,
  variance: (s) => s.variance || 0,
  safeDropAmount: (s) => s.safeDropAmount || 0,
  nextShiftFloat: (s) => s.nextShiftFloat || 0,
};

// الترتيب الافتراضي للأرشيف (الأحدث إغلاقاً أولاً) والاتجاه الابتدائي لكل عمود عند النقر الأول
const DEFAULT_CLOSED_SHIFT_SORT: SortState<ClosedShiftSortKey> = {
  key: "closedAt",
  direction: "desc",
};

const CLOSED_SHIFT_DEFAULT_DIRECTIONS: Partial<
  Record<ClosedShiftSortKey, SortDirection>
> = {
  closedAt: "desc",
  pharmacistName: "asc",
  openingBalance: "desc",
  cashSalesTotal: "desc",
  expectedDrawerCash: "desc",
  actualDrawerCash: "desc",
  variance: "asc",
  safeDropAmount: "desc",
  nextShiftFloat: "desc",
};

/**
 * تبويب أرشيف تقارير تسليم الورديات السابقة (Z-Reports Archive)
 * يعرض ملخص الفروقات والتوريد للخزنة مع توثيق صاحب العهدة والمستخدم الذي أغلق الوردية،
 * ومبني على نواة الجداول الموحّدة (فلاتر التواريخ السريعة، فرز الأعمدة، والتحميل التدريجي)
 */
export const ClosedShiftsTable: React.FC<Props> = ({ closedShifts }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [varianceFilter, setVarianceFilter] = useState<VarianceFilter>("ALL");
  // حالة نطاق التواريخ الموحّدة (الأزرار السريعة + النطاق اليدوي من/إلى)
  const [dateRange, setDateRange] =
    useState<DateRangeValue>(DEFAULT_DATE_RANGE);

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

  // خيارات فلتر الفروقات الممرّرة إلى المكوّن الموحّد FilterPills
  const varianceFilterOptions = useMemo<FilterPillOption<VarianceFilter>[]>(
    () => [
      {
        id: "ALL",
        label: "كل الورديات",
        count: closedShifts.length,
        tone: "slate",
      },
      {
        id: "WITH_VARIANCE",
        label: "ذات الفارق",
        count: archiveStats.varianceShiftsCount,
        icon: AlertOctagon,
        tone: "rose",
      },
    ],
    [closedShifts.length, archiveStats.varianceShiftsCount],
  );

  // تصفية الورديات حسب حالة الفارق ونطاق التواريخ ونص البحث
  const matchedShifts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return closedShifts.filter((s) => {
      if (varianceFilter === "WITH_VARIANCE" && (s.variance || 0) === 0) {
        return false;
      }
      if (!matchesDateRange(s.closedAt, dateRange)) return false;

      if (
        q &&
        !s.id.toLowerCase().includes(q) &&
        !s.pharmacistName.toLowerCase().includes(q) &&
        !(s.closedByName || "").toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [closedShifts, searchQuery, varianceFilter, dateRange]);

  // تطبيق الفرز التفاعلي بالأعمدة على الورديات المطابقة
  const {
    sortedItems: filteredShifts,
    sortState,
    toggleSort,
    getSortDirection,
  } = useTableSort(matchedShifts, {
    accessors: CLOSED_SHIFT_SORT_ACCESSORS,
    defaultSort: DEFAULT_CLOSED_SHIFT_SORT,
    defaultDirections: CLOSED_SHIFT_DEFAULT_DIRECTIONS,
  });

  // التحميل التدريجي للصفوف (50 وردية في الدفعة) مع إعادة ضبط تلقائية عند تغيّر الفلاتر أو الفرز
  const pagination = useTablePagination(filteredShifts, {
    pageSize: 50,
    resetDeps: [
      searchQuery,
      varianceFilter,
      dateRange.from,
      dateRange.to,
      sortState?.key,
      sortState?.direction,
    ],
  });

  const filteredSafeDrop = useMemo(
    () => filteredShifts.reduce((sum, s) => sum + (s.safeDropAmount || 0), 0),
    [filteredShifts],
  );

  const filteredVariance = useMemo(
    () => filteredShifts.reduce((sum, s) => sum + (s.variance || 0), 0),
    [filteredShifts],
  );

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    varianceFilter !== "ALL" ||
    isDateRangeActive(dateRange);

  const handleResetFilters = () => {
    setSearchQuery("");
    setVarianceFilter("ALL");
    setDateRange(DEFAULT_DATE_RANGE);
  };

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

      {/* الهيكل الموحّد للجدول (framed=false للحفاظ على البطاقة الخارجية الحالية) */}
      <DataTableShell
        framed={false}
        totalCount={closedShifts.length}
        filteredCount={filteredShifts.length}
        searchQuery={searchQuery}
        onResetFilters={hasActiveFilters ? handleResetFilters : undefined}
        stickyHeader
        emptyState={{
          icon: History,
          title: "لا توجد ورديات مغلقة في الأرشيف حتى الآن.",
          description:
            "عند إغلاق الوردية واعتماد تقرير Z-Report سيُحفظ سجل المطابقة هنا تلقائياً.",
        }}
        noResultsState={{
          description:
            "لا توجد ورديات مطابقة لخيارات البحث أو الفلترة الحالية.",
        }}
        toolbar={
          closedShifts.length > 0 ? (
            <DataTableToolbar
              accent="sky"
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="ابحث برقم الوردية، صاحب العهدة، أو من أغلقها..."
              filters={
                <FilterPills
                  variant="segmented"
                  options={varianceFilterOptions}
                  value={varianceFilter}
                  onChange={setVarianceFilter}
                  ariaLabel="تصفية الورديات حسب وجود فارق"
                />
              }
              secondaryFilters={
                <DateRangeFilter
                  value={dateRange}
                  onChange={setDateRange}
                  accent="sky"
                />
              }
              hasActiveFilters={hasActiveFilters}
              onResetFilters={handleResetFilters}
              visibleCount={pagination.visibleCount}
              filteredCount={filteredShifts.length}
              totalCount={closedShifts.length}
              itemLabel="وردية"
              metaExtra={
                <div className="text-slate-400 font-mono text-[11px]">
                  توريد:{" "}
                  <b className="text-purple-400">
                    {filteredSafeDrop.toFixed(2)}
                  </b>{" "}
                  • فارق:{" "}
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
              }
            />
          ) : undefined
        }
        header={
          <tr>
            <SortableTh
              direction={getSortDirection("closedAt")}
              onSort={() => toggleSort("closedAt")}
              accent="sky"
            >
              رقم الوردية
            </SortableTh>
            <SortableTh
              direction={getSortDirection("pharmacistName")}
              onSort={() => toggleSort("pharmacistName")}
              accent="sky"
            >
              صاحب العهدة / المُغلق
            </SortableTh>
            <SortableTh
              direction={getSortDirection("openingBalance")}
              onSort={() => toggleSort("openingBalance")}
              accent="sky"
            >
              العهدة الافتتاحية
            </SortableTh>
            <SortableTh
              direction={getSortDirection("cashSalesTotal")}
              onSort={() => toggleSort("cashSalesTotal")}
              accent="sky"
            >
              مبيعات الكاش
            </SortableTh>
            <SortableTh
              direction={getSortDirection("expectedDrawerCash")}
              onSort={() => toggleSort("expectedDrawerCash")}
              accent="sky"
            >
              النقد المتوقع
            </SortableTh>
            <SortableTh
              direction={getSortDirection("actualDrawerCash")}
              onSort={() => toggleSort("actualDrawerCash")}
              accent="sky"
            >
              الجرد الفعلي
            </SortableTh>
            <SortableTh
              direction={getSortDirection("variance")}
              onSort={() => toggleSort("variance")}
              accent="sky"
            >
              الفارق (Variance)
            </SortableTh>
            <SortableTh
              direction={getSortDirection("safeDropAmount")}
              onSort={() => toggleSort("safeDropAmount")}
              accent="sky"
            >
              المورّد للخزنة
            </SortableTh>
            <SortableTh
              direction={getSortDirection("nextShiftFloat")}
              onSort={() => toggleSort("nextShiftFloat")}
              accent="sky"
            >
              العهدة المرحلة
            </SortableTh>
          </tr>
        }
        footer={
          <TableLoadMoreFooter
            visibleCount={pagination.visibleCount}
            totalCount={pagination.totalCount}
            remainingCount={pagination.remainingCount}
            pageSize={pagination.pageSize}
            hasMore={pagination.hasMore}
            onLoadMore={pagination.loadMore}
            onShowAll={pagination.showAll}
            itemLabel="وردية"
            accent="sky"
            showSummaryWhenComplete
          />
        }
      >
        {pagination.visibleItems.map((s) => {
          const variance = s.variance || 0;
          const closedByDifferentUser = Boolean(
            s.closedByName &&
            ((s.closedByUserId &&
              s.openedByUserId &&
              s.closedByUserId !== s.openedByUserId) ||
              s.closedByName.trim() !== s.pharmacistName.trim()),
          );

          return (
            <tr
              key={s.id}
              className="hover:bg-slate-800/40 transition font-mono"
            >
              <td className="py-2.5 px-3">
                <div className="font-bold text-white">{s.id}</div>
                {s.closedAt && (
                  <div className="text-[9.5px] text-slate-500 mt-0.5">
                    {new Date(s.closedAt).toLocaleString("ar-SA", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </div>
                )}
              </td>
              <td className="py-2.5 px-3 font-sans">
                <div className="font-semibold text-slate-200">
                  {s.pharmacistName}
                </div>
                {closedByDifferentUser && (
                  <div className="inline-flex items-center gap-1 text-[9.5px] text-amber-300 bg-amber-950/50 border border-amber-800/70 px-1.5 py-0.5 rounded mt-0.5">
                    <UserCheck className="w-2.5 h-2.5 shrink-0" />
                    أغلقها: {s.closedByName}
                  </div>
                )}
              </td>
              <td className="py-2.5 px-3">{s.openingBalance.toFixed(2)}</td>
              <td className="py-2.5 px-3 text-emerald-400">
                {s.cashSalesTotal.toFixed(2)}
              </td>
              <td className="py-2.5 px-3 text-amber-400">
                {s.expectedDrawerCash.toFixed(2)}
              </td>
              <td className="py-2.5 px-3 font-bold text-white">
                {(s.actualDrawerCash ?? 0).toFixed(2)}
              </td>
              <td className="py-2.5 px-3 font-bold">
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
              <td className="py-2.5 px-3 text-purple-400">
                {(s.safeDropAmount || 0).toFixed(2)}
              </td>
              <td className="py-2.5 px-3 text-slate-300">
                {(s.nextShiftFloat || 0).toFixed(2)}
              </td>
            </tr>
          );
        })}
      </DataTableShell>
    </div>
  );
};
