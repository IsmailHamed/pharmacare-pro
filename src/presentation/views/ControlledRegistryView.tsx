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
import {
  TableColumnDef,
  useTableColumns,
} from "../components/common/table/useTableColumns";
import { ColumnVisibilityMenu } from "../components/common/table/ColumnVisibilityMenu";
import { SortableTh } from "../components/common/table/SortableTh";
import { DataTableToolbar } from "../components/common/table/DataTableToolbar";
import { DataTableShell } from "../components/common/table/DataTableShell";
import { TableLoadMoreFooter } from "../components/common/table/TableLoadMoreFooter";
import { ShieldAlert, FileSpreadsheet } from "lucide-react";
import {
  TableExportButton,
  TableExportColumn,
} from "../components/common/table/TableExportButton";
// مفاتيح الأعمدة القابلة للفرز والتحكم في الظهور داخل دفتر الأدوية المراقبة
type ControlledSortKey =
  | "dispensedAt"
  | "productName"
  | "qty"
  | "batchNumber"
  | "patientName"
  | "nationalId"
  | "doctorName"
  | "prescriptionId";

// تعريف أعمدة الجدول للتحكم البصري في الإظهار والإخفاء (مع قفل التاريخ والدواء، ودون التأثير على التقرير الرسمي)
const CONTROLLED_COLUMNS: readonly TableColumnDef<ControlledSortKey>[] = [
  { id: "dispensedAt", label: "التاريخ", locked: true },
  { id: "productName", label: "الدواء", locked: true },
  { id: "qty", label: "الكمية" },
  { id: "batchNumber", label: "الدفعة" },
  { id: "patientName", label: "المريض" },
  { id: "nationalId", label: "الرقم الوطني" },
  { id: "doctorName", label: "الطبيب" },
  { id: "prescriptionId", label: "الوصفة" },
];
type ControlledLogItem = ReturnType<
  typeof usePosStore.getState
>["controlledLogs"][number];

// أعمدة تصدير الجدول إلى Excel / CSV مرتبطة بمعرّفات الأعمدة لتصدير الحقول الظاهرة فقط
const CONTROLLED_TABLE_EXPORT_COLUMNS: readonly TableExportColumn<
  ControlledLogItem,
  ControlledSortKey
>[] = [
  {
    columnId: "dispensedAt",
    header: "التاريخ",
    getValue: (l) => l.dispensedAt.slice(0, 16).replace("T", " "),
  },
  {
    columnId: "productName",
    header: "الدواء",
    getValue: (l) => l.productName,
  },
  {
    columnId: "qty",
    header: "الكمية",
    getValue: (l) => `${l.qty} ${l.unit === "pack" ? "علبة" : "شريط"}`,
  },
  {
    columnId: "batchNumber",
    header: "الدفعة",
    getValue: (l) => l.batchNumber,
  },
  {
    columnId: "patientName",
    header: "المريض",
    getValue: (l) => l.patientName,
  },
  {
    columnId: "nationalId",
    header: "الرقم الوطني",
    getValue: (l) => l.nationalId,
  },
  {
    columnId: "doctorName",
    header: "الطبيب",
    getValue: (l) => l.doctorName,
  },
  {
    columnId: "prescriptionId",
    header: "الوصفة",
    getValue: (l) => l.prescriptionId,
  },
];
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
 * ومبني على نواة الجداول الموحّدة (فلاتر التواريخ السريعة، فرز الأعمدة، إظهار/إخفاء الأعمدة، والتحميل التدريجي).
 */
export const ControlledRegistryView: React.FC = () => {
  const { controlledLogs } = usePosStore();
  const [search, setSearch] = useState("");
  // حالة نطاق التواريخ الموحّدة (الأزرار السريعة + النطاق اليدوي من/إلى)
  const [dateRange, setDateRange] =
    useState<DateRangeValue>(DEFAULT_DATE_RANGE);

  // إدارة إظهار وإخفاء الأعمدة بصرياً مع حفظ تفضيلات المستخدم في localStorage
  const columnsState = useTableColumns(
    "controlled_registry",
    CONTROLLED_COLUMNS,
  );

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
              /* التصدير الرسمي يظل شاملاً لكافة الحقول الإجبارية عبر ExcelService */
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
            secondaryActions={
              <>
                <ColumnVisibilityMenu
                  columnsState={columnsState}
                  accent="rose"
                />
                <TableExportButton
                  items={filtered}
                  columns={CONTROLLED_TABLE_EXPORT_COLUMNS}
                  isColumnVisible={columnsState.isVisible}
                  fileNamePrefix="Controlled_Registry_Table"
                  itemLabel="عملية صرف"
                />
              </>
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
            {columnsState.isVisible("dispensedAt") && (
              <SortableTh
                direction={getSortDirection("dispensedAt")}
                onSort={() => toggleSort("dispensedAt")}
                accent="rose"
              >
                التاريخ
              </SortableTh>
            )}
            {columnsState.isVisible("productName") && (
              <SortableTh
                direction={getSortDirection("productName")}
                onSort={() => toggleSort("productName")}
                accent="rose"
              >
                الدواء
              </SortableTh>
            )}
            {columnsState.isVisible("qty") && (
              <SortableTh
                direction={getSortDirection("qty")}
                onSort={() => toggleSort("qty")}
                accent="rose"
              >
                الكمية
              </SortableTh>
            )}
            {columnsState.isVisible("batchNumber") && (
              <SortableTh
                direction={getSortDirection("batchNumber")}
                onSort={() => toggleSort("batchNumber")}
                accent="rose"
              >
                الدفعة
              </SortableTh>
            )}
            {columnsState.isVisible("patientName") && (
              <SortableTh
                direction={getSortDirection("patientName")}
                onSort={() => toggleSort("patientName")}
                accent="rose"
              >
                المريض
              </SortableTh>
            )}
            {columnsState.isVisible("nationalId") && (
              <SortableTh
                direction={getSortDirection("nationalId")}
                onSort={() => toggleSort("nationalId")}
                accent="rose"
              >
                الرقم الوطني
              </SortableTh>
            )}
            {columnsState.isVisible("doctorName") && (
              <SortableTh
                direction={getSortDirection("doctorName")}
                onSort={() => toggleSort("doctorName")}
                accent="rose"
              >
                الطبيب
              </SortableTh>
            )}
            {columnsState.isVisible("prescriptionId") && (
              <SortableTh
                direction={getSortDirection("prescriptionId")}
                onSort={() => toggleSort("prescriptionId")}
                accent="rose"
              >
                الوصفة
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
            itemLabel="عملية صرف"
            accent="rose"
            showSummaryWhenComplete
          />
        }
      >
        {pagination.visibleItems.map((l) => (
          <tr key={l.id} className="hover:bg-slate-800/40 transition">
            {columnsState.isVisible("dispensedAt") && (
              <td className="py-2.5 px-3 font-mono text-slate-400">
                {l.dispensedAt.slice(0, 16).replace("T", " ")}
              </td>
            )}
            {columnsState.isVisible("productName") && (
              <td className="py-2.5 px-3 font-bold text-white">
                {l.productName}
              </td>
            )}
            {columnsState.isVisible("qty") && (
              <td className="py-2.5 px-3 font-mono">
                {l.qty} {l.unit === "pack" ? "علبة" : "شريط"}
              </td>
            )}
            {columnsState.isVisible("batchNumber") && (
              <td className="py-2.5 px-3 font-mono text-slate-400">
                {l.batchNumber}
              </td>
            )}
            {columnsState.isVisible("patientName") && (
              <td className="py-2.5 px-3">{l.patientName}</td>
            )}
            {columnsState.isVisible("nationalId") && (
              <td className="py-2.5 px-3 font-mono">{l.nationalId}</td>
            )}
            {columnsState.isVisible("doctorName") && (
              <td className="py-2.5 px-3">{l.doctorName}</td>
            )}
            {columnsState.isVisible("prescriptionId") && (
              <td className="py-2.5 px-3 font-mono text-rose-300">
                {l.prescriptionId}
              </td>
            )}
          </tr>
        ))}
      </DataTableShell>
    </div>
  );
};
