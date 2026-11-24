import React, { useMemo, useState } from "react";
import { usePosStore } from "../../application/store/usePosStore";
import { ExcelService } from "../../infrastructure/excel/ExcelService";
import {
  DEFAULT_DATE_RANGE,
  DateRangeValue,
  isDateRangeActive,
  matchesDateRange,
} from "../components/common/table/dateRangeUtils";
import { DateRangeFilter } from "../components/common/table/DateRangeFilter";
import {
  SortAccessors,
  SortDirection,
  SortState,
  useTableSort,
} from "../components/common/table/useTableSort";
import { useTablePagination } from "../components/common/table/useTablePagination";
import { SortableTh } from "../components/common/table/SortableTh";
import { DataTableToolbar } from "../components/common/table/DataTableToolbar";
import { DataTableShell } from "../components/common/table/DataTableShell";
import { TableLoadMoreFooter } from "../components/common/table/TableLoadMoreFooter";
import { ShieldAlert, FileSpreadsheet } from "lucide-react";

// مفاتيح الأعمدة القابلة للفرز التفاعلي في دفتر الأدوية المراقبة
type ControlledSortKey =
  | "dispensedAt"
  | "productName"
  | "qty"
  | "batchNumber"
  | "patientName"
  | "nationalId"
  | "doctorName"
  | "prescriptionId";

// الترتيب الافتراضي للدفتر (الأحدث صرفاً أولاً) والاتجاه الابتدائي لكل عمود عند النقر الأول
const DEFAULT_CONTROLLED_SORT: SortState<ControlledSortKey> = {
  key: "dispensedAt",
  direction: "desc",
};

const CONTROLLED_DEFAULT_DIRECTIONS: Partial<
  Record<ControlledSortKey, SortDirection>
> = {
  dispensedAt: "desc",
  productName: "asc",
  qty: "desc",
  batchNumber: "asc",
  patientName: "asc",
  nationalId: "asc",
  doctorName: "asc",
  prescriptionId: "asc",
};

/**
 * دفتر الأدوية المراقبة والنفسية
 * سجل رسمي جاهز للتصدير للجهات الصحية عبر ExcelService المعزولة،
 * ومبني على نواة الجداول الموحّدة (فلاتر التواريخ السريعة، فرز الأعمدة، والتحميل التدريجي).
 */
export const ControlledRegistryView: React.FC = () => {
  const { controlledLogs } = usePosStore();
  const [search, setSearch] = useState("");
  // حالة نطاق التواريخ الموحّدة (الأزرار السريعة + النطاق اليدوي من/إلى)
  const [dateRange, setDateRange] =
    useState<DateRangeValue>(DEFAULT_DATE_RANGE);

  // تصفية السجلات حسب نطاق التواريخ ونص البحث (المريض، الرقم الوطني، الدواء، الوصفة، الطبيب، الدفعة)
  const matchedLogs = useMemo(() => {
    const q = search.trim().toLowerCase();

    return controlledLogs.filter((l) => {
      if (!matchesDateRange(l.dispensedAt, dateRange)) return false;
      if (!q) return true;

      return (
        l.patientName.toLowerCase().includes(q) ||
        l.nationalId.includes(q) ||
        l.productName.toLowerCase().includes(q) ||
        l.prescriptionId.toLowerCase().includes(q) ||
        l.doctorName.toLowerCase().includes(q) ||
        l.batchNumber.toLowerCase().includes(q)
      );
    });
  }, [controlledLogs, search, dateRange]);

  // دوال استخراج قيم الأعمدة للفرز التفاعلي
  const sortAccessors = useMemo<
    SortAccessors<(typeof controlledLogs)[number], ControlledSortKey>
  >(
    () => ({
      dispensedAt: (l) => new Date(l.dispensedAt),
      productName: (l) => l.productName,
      qty: (l) => l.qty,
      batchNumber: (l) => l.batchNumber,
      patientName: (l) => l.patientName,
      nationalId: (l) => l.nationalId,
      doctorName: (l) => l.doctorName,
      prescriptionId: (l) => l.prescriptionId,
    }),
    [],
  );

  // تطبيق الفرز التفاعلي بالأعمدة (يُستخدم أيضاً لترتيب ملف التصدير الرسمي)
  const {
    sortedItems: filtered,
    sortState,
    toggleSort,
    getSortDirection,
  } = useTableSort(matchedLogs, {
    accessors: sortAccessors,
    defaultSort: DEFAULT_CONTROLLED_SORT,
    defaultDirections: CONTROLLED_DEFAULT_DIRECTIONS,
  });

  // التحميل التدريجي للصفوف (50 عملية صرف في الدفعة) مع إعادة ضبط تلقائية عند تغيّر الفلاتر أو الفرز
  const pagination = useTablePagination(filtered, {
    pageSize: 50,
    resetDeps: [
      search,
      dateRange.from,
      dateRange.to,
      sortState?.key,
      sortState?.direction,
    ],
  });

  const hasActiveFilters =
    Boolean(search.trim()) || isDateRangeActive(dateRange);

  const handleResetFilters = () => {
    setSearch("");
    setDateRange(DEFAULT_DATE_RANGE);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-950 text-slate-200 text-xs space-y-5">
      {/* ترويسة الشاشة */}
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-400" /> دفتر الأدوية
          المراقبة والنفسية
        </h2>
        <p className="text-slate-400 mt-1">
          سجل رسمي لكل عملية صرف دواء مراقب — إجباري التوثيق قبل البيع.
        </p>
      </div>

      {/* الهيكل الموحّد للجدول مع الفلاتر ونطاق التواريخ والتصفح التدريجي */}
      <DataTableShell
        totalCount={controlledLogs.length}
        filteredCount={filtered.length}
        searchQuery={search}
        onResetFilters={hasActiveFilters ? handleResetFilters : undefined}
        stickyHeader
        emptyState={{
          icon: ShieldAlert,
          title: "لا توجد عمليات صرف أدوية مراقبة مسجلة بعد",
          description:
            "عند صرف أي دواء مراقب من نقطة البيع وتوثيق بيانات المريض والوصفة سيظهر السجل هنا تلقائياً.",
        }}
        noResultsState={{
          description:
            "لا توجد عمليات صرف مطابقة لعبارة البحث أو نطاق التواريخ المحدد.",
        }}
        toolbar={
          <DataTableToolbar
            accent="rose"
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="بحث بالمريض، الرقم الوطني، الدواء، الوصفة، الطبيب، أو رقم الدفعة..."
            actions={
              <button
                type="button"
                disabled={filtered.length === 0}
                onClick={() => ExcelService.exportControlledLogs(filtered)}
                className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition"
              >
                <FileSpreadsheet className="w-4 h-4" /> تصدير تقرير رسمي (Excel)
              </button>
            }
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
            filteredCount={filtered.length}
            totalCount={controlledLogs.length}
            itemLabel="عملية صرف"
            metaExtra={
              <span className="text-[10.5px] text-slate-500 hidden sm:inline">
                اضغط على رأس أي عمود لترتيب السجل الرسمي
              </span>
            }
          />
        }
        header={
          <tr>
            <SortableTh
              direction={getSortDirection("dispensedAt")}
              onSort={() => toggleSort("dispensedAt")}
              accent="rose"
            >
              التاريخ
            </SortableTh>
            <SortableTh
              direction={getSortDirection("productName")}
              onSort={() => toggleSort("productName")}
              accent="rose"
            >
              الدواء
            </SortableTh>
            <SortableTh
              direction={getSortDirection("qty")}
              onSort={() => toggleSort("qty")}
              accent="rose"
            >
              الكمية
            </SortableTh>
            <SortableTh
              direction={getSortDirection("batchNumber")}
              onSort={() => toggleSort("batchNumber")}
              accent="rose"
            >
              الدفعة
            </SortableTh>
            <SortableTh
              direction={getSortDirection("patientName")}
              onSort={() => toggleSort("patientName")}
              accent="rose"
            >
              المريض
            </SortableTh>
            <SortableTh
              direction={getSortDirection("nationalId")}
              onSort={() => toggleSort("nationalId")}
              accent="rose"
            >
              الرقم الوطني
            </SortableTh>
            <SortableTh
              direction={getSortDirection("doctorName")}
              onSort={() => toggleSort("doctorName")}
              accent="rose"
            >
              الطبيب
            </SortableTh>
            <SortableTh
              direction={getSortDirection("prescriptionId")}
              onSort={() => toggleSort("prescriptionId")}
              accent="rose"
            >
              الوصفة
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
            itemLabel="عملية صرف"
            accent="rose"
            showSummaryWhenComplete
          />
        }
      >
        {pagination.visibleItems.map((l) => (
          <tr key={l.id} className="hover:bg-slate-800/40 transition">
            <td className="py-2.5 px-3 font-mono text-slate-400">
              {l.dispensedAt.slice(0, 16).replace("T", " ")}
            </td>
            <td className="py-2.5 px-3 font-bold text-white">
              {l.productName}
            </td>
            <td className="py-2.5 px-3 font-mono">
              {l.qty} {l.unit === "pack" ? "علبة" : "شريط"}
            </td>
            <td className="py-2.5 px-3 font-mono text-slate-400">
              {l.batchNumber}
            </td>
            <td className="py-2.5 px-3">{l.patientName}</td>
            <td className="py-2.5 px-3 font-mono">{l.nationalId}</td>
            <td className="py-2.5 px-3">{l.doctorName}</td>
            <td className="py-2.5 px-3 font-mono text-rose-300">
              {l.prescriptionId}
            </td>
          </tr>
        ))}
      </DataTableShell>
    </div>
  );
};
