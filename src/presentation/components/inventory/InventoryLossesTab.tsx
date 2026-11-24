import React, { useMemo, useState } from "react";
import {
  DEFAULT_DATE_RANGE,
  DateRangeValue,
  isDateRangeActive,
  matchesDateRange,
} from "../common/table/dateRangeUtils";
import { DateRangeFilter } from "../common/table/DateRangeFilter";
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
import { ClipboardCheck } from "lucide-react";

export interface InventoryLossLog {
  id: string;
  title: string;
  notes?: string | null;
  createdAt: string;
  amount: number;
}

interface Props {
  logs: InventoryLossLog[];
}

// مفاتيح الأعمدة القابلة للفرز التفاعلي في سجل التوالف والفروقات الجردية
type LossSortKey = "id" | "title" | "notes" | "createdAt" | "amount";

// دوال استخراج قيم الأعمدة للفرز (مُعرّفة خارج المكوّن للحفاظ على ثبات المرجع)
const LOSS_SORT_ACCESSORS: SortAccessors<InventoryLossLog, LossSortKey> = {
  id: (log) => log.id,
  title: (log) => log.title,
  notes: (log) => log.notes || null,
  createdAt: (log) => new Date(log.createdAt),
  amount: (log) => log.amount,
};

// الترتيب الافتراضي للسجل (الأحدث أولاً) والاتجاه الابتدائي لكل عمود عند النقر الأول
const DEFAULT_LOSS_SORT: SortState<LossSortKey> = {
  key: "createdAt",
  direction: "desc",
};

const LOSS_DEFAULT_DIRECTIONS: Partial<Record<LossSortKey, SortDirection>> = {
  id: "asc",
  title: "asc",
  notes: "asc",
  createdAt: "desc",
  amount: "desc",
};

/**
 * تبويب سجل التوالف والكسور والفروقات الجردية المقيدة مالياً
 * مبني على نواة الجداول الموحّدة (فلاتر التواريخ السريعة، فرز الأعمدة، والتحميل التدريجي)
 */
export const InventoryLossesTab: React.FC<Props> = ({ logs }) => {
  const [searchQuery, setSearchQuery] = useState("");
  // حالة نطاق التواريخ الموحّدة (الأزرار السريعة + النطاق اليدوي من/إلى)
  const [dateRange, setDateRange] =
    useState<DateRangeValue>(DEFAULT_DATE_RANGE);

  // تصفية السجلات حسب نطاق التواريخ ونص البحث (رقم التسوية، البيان، الملاحظات)
  const matchedLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return logs.filter((log) => {
      if (!matchesDateRange(log.createdAt, dateRange)) return false;
      if (!q) return true;

      return (
        log.id.toLowerCase().includes(q) ||
        log.title.toLowerCase().includes(q) ||
        (log.notes || "").toLowerCase().includes(q)
      );
    });
  }, [logs, searchQuery, dateRange]);

  // تطبيق الفرز التفاعلي بالأعمدة على السجلات المطابقة
  const {
    sortedItems: filteredLogs,
    sortState,
    toggleSort,
    getSortDirection,
  } = useTableSort(matchedLogs, {
    accessors: LOSS_SORT_ACCESSORS,
    defaultSort: DEFAULT_LOSS_SORT,
    defaultDirections: LOSS_DEFAULT_DIRECTIONS,
  });

  // التحميل التدريجي للصفوف (50 تسوية في الدفعة) مع إعادة ضبط تلقائية عند تغيّر الفلاتر أو الفرز
  const pagination = useTablePagination(filteredLogs, {
    pageSize: 50,
    resetDeps: [
      searchQuery,
      dateRange.from,
      dateRange.to,
      sortState?.key,
      sortState?.direction,
    ],
  });

  const totalLossAmount = useMemo(
    () => logs.reduce((sum, e) => sum + e.amount, 0),
    [logs],
  );

  const filteredLossAmount = useMemo(
    () => filteredLogs.reduce((sum, e) => sum + e.amount, 0),
    [filteredLogs],
  );

  const hasActiveFilters =
    Boolean(searchQuery.trim()) || isDateRangeActive(dateRange);

  const handleResetFilters = () => {
    setSearchQuery("");
    setDateRange(DEFAULT_DATE_RANGE);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* الترويسة وملخص الإحصائيات */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-rose-400" /> سجل التوالف
            والكسور والفروقات الجردية المقيدة مالياً
          </h3>
          <p className="text-slate-400 text-[11px] mt-0.5">
            جميع تسويات التلف والكسر والعجز الجردي المرحلة تلقائياً كقيود خسارة
            بالتكلفة.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-slate-400">عدد التسويات</div>
            <div className="font-mono font-bold text-white text-sm">
              {logs.length}
            </div>
          </div>
          <div className="bg-rose-950/35 border border-rose-800/70 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-rose-300/80">
              إجمالي خسائر التوالف والعجز
            </div>
            <div className="font-mono font-extrabold text-rose-400 text-sm">
              -{totalLossAmount.toFixed(2)} ر.س
            </div>
          </div>
        </div>
      </div>

      {/* الهيكل الموحّد للجدول (framed=false للحفاظ على البطاقة الخارجية الحالية) */}
      <DataTableShell
        framed={false}
        totalCount={logs.length}
        filteredCount={filteredLogs.length}
        searchQuery={searchQuery}
        onResetFilters={hasActiveFilters ? handleResetFilters : undefined}
        stickyHeader
        emptyState={{
          icon: ClipboardCheck,
          title: "لا توجد توالف أو فروقات جردية مقيدة مالياً حتى الآن.",
          description:
            "عند إجراء أي تسوية عجز أو تلف من تبويب المخزون ستظهر هنا تلقائياً مع قيمتها بالتكلفة.",
        }}
        noResultsState={{
          description:
            "لا توجد تسويات مطابقة لعبارة البحث أو نطاق التواريخ المحدد.",
        }}
        toolbar={
          logs.length > 0 ? (
            <DataTableToolbar
              accent="rose"
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="ابحث برقم التسوية، اسم الصنف، أو تفاصيل الملاحظات..."
              secondaryFilters={
                <DateRangeFilter
                  value={dateRange}
                  onChange={setDateRange}
                  accent="rose"
                />
              }
              hasActiveFilters={hasActiveFilters}
              onResetFilters={handleResetFilters}
              visibleCount={pagination.visibleCount}
              filteredCount={filteredLogs.length}
              totalCount={logs.length}
              itemLabel="تسوية"
              metaExtra={
                <span className="font-mono text-slate-400">
                  مجموع المطابق:{" "}
                  <b className="text-rose-400">
                    -{filteredLossAmount.toFixed(2)} ر.س
                  </b>
                </span>
              }
            />
          ) : undefined
        }
        header={
          <tr>
            <SortableTh
              direction={getSortDirection("id")}
              onSort={() => toggleSort("id")}
              accent="rose"
            >
              رقم التسوية
            </SortableTh>
            <SortableTh
              direction={getSortDirection("title")}
              onSort={() => toggleSort("title")}
              accent="rose"
            >
              البيان والصنف
            </SortableTh>
            <SortableTh
              direction={getSortDirection("notes")}
              onSort={() => toggleSort("notes")}
              accent="rose"
            >
              التفاصيل والملاحظات
            </SortableTh>
            <SortableTh
              direction={getSortDirection("createdAt")}
              onSort={() => toggleSort("createdAt")}
              accent="rose"
            >
              التاريخ
            </SortableTh>
            <SortableTh
              direction={getSortDirection("amount")}
              onSort={() => toggleSort("amount")}
              accent="rose"
            >
              قيمة الخسارة بالتكلفة
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
            itemLabel="تسوية"
            accent="rose"
            showSummaryWhenComplete
          />
        }
      >
        {pagination.visibleItems.map((log) => (
          <tr
            key={log.id}
            className="hover:bg-slate-800/40 transition font-mono"
          >
            <td className="py-2.5 px-3 font-bold text-white">{log.id}</td>
            <td className="py-2.5 px-3 font-sans font-bold text-amber-300">
              {log.title}
            </td>
            <td className="py-2.5 px-3 font-sans text-slate-400">
              {log.notes || "—"}
            </td>
            <td className="py-2.5 px-3 text-slate-400">
              {new Date(log.createdAt).toLocaleString("ar-SA")}
            </td>
            <td className="py-2.5 px-3 font-bold text-rose-400">
              -{log.amount.toFixed(2)} ر.س
            </td>
          </tr>
        ))}
      </DataTableShell>
    </div>
  );
};
