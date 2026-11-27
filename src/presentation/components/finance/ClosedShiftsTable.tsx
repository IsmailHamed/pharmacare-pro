import React, { useMemo, useState } from "react";
import { ShiftSummaryEntity } from "../../../domain/entities";
import {
  DEFAULT_DATE_RANGE,
  DateRangeValue,
  isDateRangeActive,
  matchesDateRange,
} from "../common/table/dateRangeUtils";
import { DateRangeFilter } from "../common/table/DateRangeFilter";
import { FilterPills } from "../common/table/FilterPills";
import { useTableSort } from "../common/table/useTableSort";
import { useTablePagination } from "../common/table/useTablePagination";
import { useTableColumns } from "../common/table/useTableColumns";
import { ColumnVisibilityMenu } from "../common/table/ColumnVisibilityMenu";
import { TableExportButton } from "../common/table/TableExportButton";
import { SortableTh } from "../common/table/SortableTh";
import { DataTableToolbar } from "../common/table/DataTableToolbar";
import { DataTableShell } from "../common/table/DataTableShell";
import { TableLoadMoreFooter } from "../common/table/TableLoadMoreFooter";
import {
  CLOSED_SHIFT_COLUMNS,
  CLOSED_SHIFT_DEFAULT_DIRECTIONS,
  CLOSED_SHIFT_EXPORT_COLUMNS,
  CLOSED_SHIFT_SORT_ACCESSORS,
  DEFAULT_CLOSED_SHIFT_SORT,
  VarianceFilter,
  computeClosedShiftsArchiveStats,
  getVarianceFilterOptions,
} from "./shifts/closedShifts.config";
import { ClosedShiftsHeader } from "./shifts/ClosedShiftsHeader";
import { AlertOctagon, CheckCircle2, History, UserCheck } from "lucide-react";

interface Props {
  closedShifts: ShiftSummaryEntity[];
}

/**
 * تبويب أرشيف تقارير تسليم الورديات السابقة (Z-Reports Archive)
 * يعرض ملخص الفروقات والتوريد للخزنة مع توثيق صاحب العهدة والمستخدم الذي أغلق الوردية،
 * ومبني على نواة الجداول الموحّدة (فلاتر التواريخ السريعة، فرز الأعمدة، إظهار/إخفاء الأعمدة، والتصدير)
 */
export const ClosedShiftsTable: React.FC<Props> = ({ closedShifts }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [varianceFilter, setVarianceFilter] = useState<VarianceFilter>("ALL");
  // حالة نطاق التواريخ الموحّدة (الأزرار السريعة + النطاق اليدوي من/إلى)
  const [dateRange, setDateRange] =
    useState<DateRangeValue>(DEFAULT_DATE_RANGE);

  // إدارة إظهار وإخفاء الأعمدة مع حفظ تفضيلات المستخدم في localStorage
  const columnsState = useTableColumns("closed_shifts", CLOSED_SHIFT_COLUMNS);

  const archiveStats = useMemo(
    () => computeClosedShiftsArchiveStats(closedShifts),
    [closedShifts],
  );

  // خيارات فلتر الفروقات الممرّرة إلى المكوّن الموحّد FilterPills
  const varianceFilterOptions = useMemo(
    () =>
      getVarianceFilterOptions(
        closedShifts.length,
        archiveStats.varianceShiftsCount,
      ),
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

  // تطبيق الفرز التفاعلي بالأعمدة على الورديات المطابقة (يُستخدم أيضاً لترتيب ملف التصدير)
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
      <ClosedShiftsHeader
        totalShiftsCount={closedShifts.length}
        stats={archiveStats}
      />

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
              secondaryActions={
                <>
                  <ColumnVisibilityMenu
                    columnsState={columnsState}
                    accent="sky"
                  />
                  <TableExportButton
                    items={filteredShifts}
                    columns={CLOSED_SHIFT_EXPORT_COLUMNS}
                    isColumnVisible={columnsState.isVisible}
                    fileNamePrefix="Closed_Shifts_Archive"
                    itemLabel="وردية"
                  />
                </>
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
            {columnsState.isVisible("closedAt") && (
              <SortableTh
                direction={getSortDirection("closedAt")}
                onSort={() => toggleSort("closedAt")}
                accent="sky"
              >
                رقم الوردية
              </SortableTh>
            )}
            {columnsState.isVisible("pharmacistName") && (
              <SortableTh
                direction={getSortDirection("pharmacistName")}
                onSort={() => toggleSort("pharmacistName")}
                accent="sky"
              >
                صاحب العهدة / المُغلق
              </SortableTh>
            )}
            {columnsState.isVisible("openingBalance") && (
              <SortableTh
                direction={getSortDirection("openingBalance")}
                onSort={() => toggleSort("openingBalance")}
                accent="sky"
              >
                العهدة الافتتاحية
              </SortableTh>
            )}
            {columnsState.isVisible("cashSalesTotal") && (
              <SortableTh
                direction={getSortDirection("cashSalesTotal")}
                onSort={() => toggleSort("cashSalesTotal")}
                accent="sky"
              >
                مبيعات الكاش
              </SortableTh>
            )}
            {columnsState.isVisible("expectedDrawerCash") && (
              <SortableTh
                direction={getSortDirection("expectedDrawerCash")}
                onSort={() => toggleSort("expectedDrawerCash")}
                accent="sky"
              >
                النقد المتوقع
              </SortableTh>
            )}
            {columnsState.isVisible("actualDrawerCash") && (
              <SortableTh
                direction={getSortDirection("actualDrawerCash")}
                onSort={() => toggleSort("actualDrawerCash")}
                accent="sky"
              >
                الجرد الفعلي
              </SortableTh>
            )}
            {columnsState.isVisible("variance") && (
              <SortableTh
                direction={getSortDirection("variance")}
                onSort={() => toggleSort("variance")}
                accent="sky"
              >
                الفارق (Variance)
              </SortableTh>
            )}
            {columnsState.isVisible("safeDropAmount") && (
              <SortableTh
                direction={getSortDirection("safeDropAmount")}
                onSort={() => toggleSort("safeDropAmount")}
                accent="sky"
              >
                المورّد للخزنة
              </SortableTh>
            )}
            {columnsState.isVisible("nextShiftFloat") && (
              <SortableTh
                direction={getSortDirection("nextShiftFloat")}
                onSort={() => toggleSort("nextShiftFloat")}
                accent="sky"
              >
                العهدة المرحلة
              </SortableTh>
            )}
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
              {columnsState.isVisible("closedAt") && (
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
              )}
              {columnsState.isVisible("pharmacistName") && (
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
              )}
              {columnsState.isVisible("openingBalance") && (
                <td className="py-2.5 px-3">{s.openingBalance.toFixed(2)}</td>
              )}
              {columnsState.isVisible("cashSalesTotal") && (
                <td className="py-2.5 px-3 text-emerald-400">
                  {s.cashSalesTotal.toFixed(2)}
                </td>
              )}
              {columnsState.isVisible("expectedDrawerCash") && (
                <td className="py-2.5 px-3 text-amber-400">
                  {s.expectedDrawerCash.toFixed(2)}
                </td>
              )}
              {columnsState.isVisible("actualDrawerCash") && (
                <td className="py-2.5 px-3 font-bold text-white">
                  {(s.actualDrawerCash ?? 0).toFixed(2)}
                </td>
              )}
              {columnsState.isVisible("variance") && (
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
              )}
              {columnsState.isVisible("safeDropAmount") && (
                <td className="py-2.5 px-3 text-purple-400">
                  {(s.safeDropAmount || 0).toFixed(2)}
                </td>
              )}
              {columnsState.isVisible("nextShiftFloat") && (
                <td className="py-2.5 px-3 text-slate-300">
                  {(s.nextShiftFloat || 0).toFixed(2)}
                </td>
              )}
            </tr>
          );
        })}
      </DataTableShell>
    </div>
  );
};
