import React, { useMemo, useState } from "react";
import { usePosStore } from "../../../application/store/usePosStore";
import { InvoiceEntity } from "../../../domain/entities/Invoice";
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
import {
  TableColumnDef,
  useTableColumns,
} from "../common/table/useTableColumns";
import { ColumnVisibilityMenu } from "../common/table/ColumnVisibilityMenu";
import {
  TableExportButton,
  TableExportColumn,
} from "../common/table/TableExportButton";
import { SortableTh } from "../common/table/SortableTh";
import { DataTableToolbar } from "../common/table/DataTableToolbar";
import { DataTableShell } from "../common/table/DataTableShell";
import { TableLoadMoreFooter } from "../common/table/TableLoadMoreFooter";
import {
  FileText,
  Printer,
  Undo2,
  User,
  UserCheck,
  Lock,
  CreditCard,
  Banknote,
  ChevronDown,
  ChevronLeft,
  ChevronsUpDown,
  Package,
} from "lucide-react";

interface Props {
  invoices?: InvoiceEntity[];
  // دالة اختيارية للانتقال إلى شاشة نقطة البيع بعد تحميل فاتورة للمرتجع
  onReturnInvoiceLoaded?: () => void;
}

type InvoiceTypeFilter = "ALL" | "SALE" | "RETURN";
type InvoicePaymentFilter = "ALL" | "CASH" | "CREDIT";

// مفاتيح الأعمدة القابلة للفرز والتحكم في الظهور داخل سجل فواتير الصندوق
type InvoiceSortKey =
  | "createdAt"
  | "type"
  | "paymentMode"
  | "customerName"
  | "performedByName"
  | "itemsCount"
  | "totalAmount";

// تعريف أعمدة جدول الفواتير للتحكم في الإظهار والإخفاء (مع قفل العمودين الأساسيين)
const INVOICE_COLUMNS: readonly TableColumnDef<InvoiceSortKey>[] = [
  { id: "createdAt", label: "رقم الفاتورة والتاريخ", locked: true },
  { id: "type", label: "نوع الفاتورة" },
  { id: "paymentMode", label: "طريقة الدفع" },
  { id: "customerName", label: "العميل", locked: true },
  { id: "performedByName", label: "المنفّذ / الوردية" },
  { id: "itemsCount", label: "الأصناف" },
  { id: "totalAmount", label: "الصافي النهائي" },
];

// أعمدة التصدير إلى Excel / CSV مرتبطة بمعرّفات الأعمدة لتصدير الحقول الظاهرة فقط
const INVOICE_EXPORT_COLUMNS: readonly TableExportColumn<
  InvoiceEntity,
  InvoiceSortKey
>[] = [
  { columnId: "createdAt", header: "رقم الفاتورة", getValue: (inv) => inv.id },
  {
    columnId: "createdAt",
    header: "التاريخ والوقت",
    getValue: (inv) => inv.createdAt.slice(0, 16).replace("T", " "),
  },
  {
    columnId: "type",
    header: "نوع الفاتورة",
    getValue: (inv) => (inv.type === "SALE" ? "فاتورة بيع" : "فاتورة مرتجع"),
  },
  {
    columnId: "paymentMode",
    header: "طريقة الدفع",
    getValue: (inv) => (inv.paymentMode === "CASH" ? "نقدي" : "آجل"),
  },
  {
    columnId: "customerName",
    header: "العميل",
    getValue: (inv) => inv.customerName || "عميل نقدي",
  },
  {
    columnId: "performedByName",
    header: "منفّذ الفاتورة",
    getValue: (inv) => inv.performedByName || "غير موثّق",
  },
  {
    columnId: "performedByName",
    header: "الوردية المرتبطة",
    getValue: (inv) => inv.shiftId || "—",
  },
  {
    columnId: "itemsCount",
    header: "عدد الأصناف",
    getValue: (inv) => inv.items.length,
  },
  {
    columnId: "totalAmount",
    header: "الإجمالي الفرعي",
    getValue: (inv) => inv.subtotal.toFixed(2),
  },
  {
    columnId: "totalAmount",
    header: "نسبة الخصم (%)",
    getValue: (inv) => inv.discountPercent,
  },
  {
    columnId: "totalAmount",
    header: "الصافي النهائي (ر.س)",
    getValue: (inv) =>
      `${inv.type === "RETURN" ? "-" : ""}${inv.totalAmount.toFixed(2)}`,
  },
];

// خيارات فلتر نوع الفاتورة الممرّرة إلى المكوّن الموحّد FilterPills
const TYPE_FILTER_OPTIONS: readonly FilterPillOption<InvoiceTypeFilter>[] = [
  { id: "ALL", label: "الكل", tone: "slate" },
  { id: "SALE", label: "مبيعات", tone: "emerald" },
  { id: "RETURN", label: "مرتجعات", tone: "rose" },
];

// خيارات فلتر طريقة الدفع الممرّرة إلى المكوّن الموحّد FilterPills
const PAYMENT_FILTER_OPTIONS: readonly FilterPillOption<InvoicePaymentFilter>[] =
  [
    { id: "ALL", label: "كل طرق الدفع", tone: "slate" },
    { id: "CASH", label: "نقدي", tone: "sky" },
    { id: "CREDIT", label: "آجل (ذمم)", tone: "amber" },
  ];

// دوال استخراج قيم الأعمدة للفرز (مُعرّفة خارج المكوّن للحفاظ على ثبات المرجع)
const INVOICE_SORT_ACCESSORS: SortAccessors<InvoiceEntity, InvoiceSortKey> = {
  createdAt: (inv) => new Date(inv.createdAt),
  type: (inv) => (inv.type === "SALE" ? "فاتورة بيع" : "فاتورة مرتجع"),
  paymentMode: (inv) => (inv.paymentMode === "CASH" ? "نقدي" : "آجل"),
  customerName: (inv) => inv.customerName || "عميل نقدي",
  performedByName: (inv) => inv.performedByName || null,
  itemsCount: (inv) => inv.items.length,
  totalAmount: (inv) =>
    inv.type === "RETURN" ? -inv.totalAmount : inv.totalAmount,
};

// الترتيب الافتراضي للسجل (الأحدث أولاً) والاتجاه الابتدائي لكل عمود عند النقر الأول
const DEFAULT_INVOICE_SORT: SortState<InvoiceSortKey> = {
  key: "createdAt",
  direction: "desc",
};

const INVOICE_DEFAULT_DIRECTIONS: Partial<
  Record<InvoiceSortKey, SortDirection>
> = {
  createdAt: "desc",
  type: "asc",
  paymentMode: "asc",
  customerName: "asc",
  performedByName: "asc",
  itemsCount: "desc",
  totalAmount: "desc",
};

/**
 * تبويب سجل فواتير المبيعات والمرتجعات داخل الصندوق والمالية
 * مصمم كجدول كامل العرض بصفوف قابلة للتوسيع على نواة الجداول الموحّدة
 * (فلاتر التواريخ السريعة، فرز الأعمدة، إظهار/إخفاء الأعمدة، وتصدير المعروض)
 */
export const InvoicesHistoryTab: React.FC<Props> = ({
  invoices,
  onReturnInvoiceLoaded,
}) => {
  const storeInvoices = usePosStore((s) => s.invoices);
  const setLastPrintedInvoice = usePosStore((s) => s.setLastPrintedInvoice);
  const loadInvoiceForReturn = usePosStore((s) => s.loadInvoiceForReturn);

  // التحقق من صلاحية المستخدم الحالي لإجراء مرتجعات المبيعات (القيمة الافتراضية الآمنة: false)
  const canProcessReturn = usePosStore(
    (s) => s.currentUser?.permissions.canProcessReturn ?? false,
  );

  const resolvedInvoices = invoices ?? storeInvoices;

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<InvoiceTypeFilter>("ALL");
  const [paymentFilter, setPaymentFilter] =
    useState<InvoicePaymentFilter>("ALL");
  // حالة نطاق التواريخ الموحّدة (الأزرار السريعة + النطاق اليدوي من/إلى)
  const [dateRange, setDateRange] =
    useState<DateRangeValue>(DEFAULT_DATE_RANGE);
  // تتبع الصفوف الموسّعة لعرض تفاصيل الفاتورة وأصنافها داخل الجدول
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // إدارة إظهار وإخفاء الأعمدة مع حفظ مستقل عن نافذة نقطة البيع في localStorage
  const columnsState = useTableColumns(
    "finance_invoices_history",
    INVOICE_COLUMNS,
  );

  // إحصائيات الملخص العلوي لكامل سجل الفواتير
  const archiveStats = useMemo(() => {
    let salesCount = 0;
    let salesTotal = 0;
    let returnsCount = 0;
    let returnsTotal = 0;

    resolvedInvoices.forEach((inv) => {
      if (inv.type === "SALE") {
        salesCount += 1;
        salesTotal += inv.totalAmount;
      } else {
        returnsCount += 1;
        returnsTotal += inv.totalAmount;
      }
    });

    return {
      salesCount,
      salesTotal,
      returnsCount,
      returnsTotal,
      netTotal: salesTotal - returnsTotal,
    };
  }, [resolvedInvoices]);

  // فلترة الفواتير حسب نوع الفاتورة وطريقة الدفع ونطاق التواريخ ونص البحث
  const matchedInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return resolvedInvoices.filter((inv) => {
      if (typeFilter !== "ALL" && inv.type !== typeFilter) return false;
      if (paymentFilter !== "ALL" && inv.paymentMode !== paymentFilter)
        return false;
      if (!matchesDateRange(inv.createdAt, dateRange)) return false;

      if (!q) return true;

      const matchesId = inv.id.toLowerCase().includes(q);
      const matchesCustomer = (inv.customerName || "")
        .toLowerCase()
        .includes(q);
      const matchesPerformer = (inv.performedByName || "")
        .toLowerCase()
        .includes(q);
      const matchesShift = (inv.shiftId || "").toLowerCase().includes(q);
      const matchesDrug = inv.items.some(
        (item) =>
          item.product.name.toLowerCase().includes(q) ||
          item.product.barcode.includes(q),
      );

      return (
        matchesId ||
        matchesCustomer ||
        matchesPerformer ||
        matchesShift ||
        matchesDrug
      );
    });
  }, [resolvedInvoices, searchQuery, typeFilter, paymentFilter, dateRange]);

  // تطبيق الفرز التفاعلي بالأعمدة على الفواتير المطابقة (يُستخدم أيضاً لترتيب ملف التصدير)
  const {
    sortedItems: filteredInvoices,
    sortState,
    toggleSort,
    getSortDirection,
  } = useTableSort(matchedInvoices, {
    accessors: INVOICE_SORT_ACCESSORS,
    defaultSort: DEFAULT_INVOICE_SORT,
    defaultDirections: INVOICE_DEFAULT_DIRECTIONS,
  });

  // التحميل التدريجي للفواتير (50 فاتورة في الدفعة) مع إعادة ضبط تلقائية عند تغيّر الفلاتر أو الفرز
  const pagination = useTablePagination(filteredInvoices, {
    pageSize: 50,
    resetDeps: [
      searchQuery,
      typeFilter,
      paymentFilter,
      dateRange.from,
      dateRange.to,
      sortState?.key,
      sortState?.direction,
    ],
  });

  // صافي إجمالي الفواتير المطابقة (المبيعات مطروحاً منها المرتجعات)
  const filteredNetTotal = useMemo(
    () =>
      filteredInvoices.reduce(
        (sum, inv) =>
          sum + (inv.type === "RETURN" ? -inv.totalAmount : inv.totalAmount),
        0,
      ),
    [filteredInvoices],
  );

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    typeFilter !== "ALL" ||
    paymentFilter !== "ALL" ||
    isDateRangeActive(dateRange);

  const handleResetFilters = () => {
    setSearchQuery("");
    setTypeFilter("ALL");
    setPaymentFilter("ALL");
    setDateRange(DEFAULT_DATE_RANGE);
  };

  // فحص وتبديل توسيع الصفوف الظاهرة حالياً في الجدول
  const allExpanded =
    pagination.visibleItems.length > 0 &&
    pagination.visibleItems.every((inv) => Boolean(expandedIds[inv.id]));

  const toggleExpand = (invoiceId: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [invoiceId]: !prev[invoiceId],
    }));
  };

  const handleToggleExpandAll = () => {
    if (allExpanded) {
      setExpandedIds({});
      return;
    }
    const next: Record<string, boolean> = {};
    pagination.visibleItems.forEach((inv) => {
      next[inv.id] = true;
    });
    setExpandedIds(next);
  };

  const handleReprint = (invoice: InvoiceEntity) => {
    setLastPrintedInvoice(invoice);
  };

  const handleReturnInvoice = (invoice: InvoiceEntity) => {
    // منع استرداد الفاتورة إلى شاشة المرتجع إذا كان المستخدم لا يمتلك الصلاحية
    if (!canProcessReturn) return;

    const ok = loadInvoiceForReturn(invoice.id);
    if (ok) {
      onReturnInvoiceLoaded?.();
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* الترويسة وبطاقات الملخص */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" /> سجل فواتير
            المبيعات والمرتجعات
          </h3>
          <p className="text-slate-400 text-[11px] mt-0.5">
            أرشيف تفصيلي لكافة الفواتير الصادرة مع التوثيق الرقابي للأصناف
            والمنفّذ والوردية وإمكانية الطباعة والاسترداد.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-slate-400">إجمالي الفواتير</div>
            <div className="font-mono font-bold text-white text-sm">
              {resolvedInvoices.length}
            </div>
          </div>

          <div className="bg-emerald-950/30 border border-emerald-800/70 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-emerald-300/80">
              المبيعات ({archiveStats.salesCount})
            </div>
            <div className="font-mono font-extrabold text-emerald-400 text-sm">
              +{archiveStats.salesTotal.toFixed(2)} ر.س
            </div>
          </div>

          <div className="bg-rose-950/35 border border-rose-800/70 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-rose-300/80">
              المرتجعات ({archiveStats.returnsCount})
            </div>
            <div className="font-mono font-extrabold text-rose-400 text-sm">
              -{archiveStats.returnsTotal.toFixed(2)} ر.س
            </div>
          </div>

          <div className="bg-sky-950/35 border border-sky-800/70 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-sky-300/80">صافي الفواتير</div>
            <div
              className={`font-mono font-extrabold text-sm ${
                archiveStats.netTotal < 0 ? "text-rose-400" : "text-sky-400"
              }`}
            >
              {archiveStats.netTotal.toFixed(2)} ر.س
            </div>
          </div>
        </div>
      </div>

      {/* الهيكل الموحّد للجدول (framed=false للحفاظ على البطاقة الخارجية الحالية) */}
      <DataTableShell
        framed={false}
        totalCount={resolvedInvoices.length}
        filteredCount={filteredInvoices.length}
        searchQuery={searchQuery}
        onResetFilters={hasActiveFilters ? handleResetFilters : undefined}
        stickyHeader
        emptyState={{
          icon: FileText,
          title: "لا توجد فواتير مسجلة في النظام حتى الآن",
          description:
            "ستظهر هنا كافة فواتير المبيعات والمرتجعات فور إصدارها من نقطة البيع.",
        }}
        noResultsState={{
          description:
            "لا توجد فواتير مطابقة لمعايير البحث أو الفلاتر الحالية.",
        }}
        toolbar={
          resolvedInvoices.length > 0 ? (
            <DataTableToolbar
              accent="emerald"
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="ابحث برقم الفاتورة (INV-...)، العميل، الموظف المنفّذ، الوردية، أو الدواء..."
              filters={
                <>
                  <FilterPills
                    variant="segmented"
                    options={TYPE_FILTER_OPTIONS}
                    value={typeFilter}
                    onChange={setTypeFilter}
                    ariaLabel="تصفية حسب نوع الفاتورة"
                  />
                  <FilterPills
                    variant="segmented"
                    options={PAYMENT_FILTER_OPTIONS}
                    value={paymentFilter}
                    onChange={setPaymentFilter}
                    ariaLabel="تصفية حسب طريقة الدفع"
                  />
                </>
              }
              secondaryFilters={
                <DateRangeFilter
                  value={dateRange}
                  onChange={setDateRange}
                  accent="emerald"
                />
              }
              secondaryActions={
                <>
                  <ColumnVisibilityMenu
                    columnsState={columnsState}
                    accent="emerald"
                  />

                  {pagination.visibleItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleToggleExpandAll}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-[11px] inline-flex items-center gap-1.5 transition"
                    >
                      <ChevronsUpDown className="w-3.5 h-3.5 text-emerald-400" />
                      {allExpanded ? "طي كل الفواتير" : "توسيع كل الفواتير"}
                    </button>
                  )}

                  <TableExportButton
                    items={filteredInvoices}
                    columns={INVOICE_EXPORT_COLUMNS}
                    isColumnVisible={columnsState.isVisible}
                    fileNamePrefix="Finance_Invoices_History"
                    itemLabel="فاتورة"
                  />
                </>
              }
              hasActiveFilters={hasActiveFilters}
              onResetFilters={handleResetFilters}
              visibleCount={pagination.visibleCount}
              filteredCount={filteredInvoices.length}
              totalCount={resolvedInvoices.length}
              itemLabel="فاتورة"
              metaExtra={
                <span className="font-mono text-slate-400">
                  صافي المطابق:{" "}
                  <b
                    className={
                      filteredNetTotal < 0
                        ? "text-rose-400"
                        : "text-emerald-400"
                    }
                  >
                    {filteredNetTotal.toFixed(2)} ر.س
                  </b>
                  <span className="text-slate-500 font-sans mr-2 hidden md:inline">
                    • اضغط على أي صف لعرض أصناف الفاتورة وتفاصيلها
                  </span>
                </span>
              }
            />
          ) : undefined
        }
        header={
          <tr>
            {columnsState.isVisible("createdAt") && (
              <SortableTh
                direction={getSortDirection("createdAt")}
                onSort={() => toggleSort("createdAt")}
                accent="emerald"
              >
                رقم الفاتورة والتاريخ
              </SortableTh>
            )}
            {columnsState.isVisible("type") && (
              <SortableTh
                direction={getSortDirection("type")}
                onSort={() => toggleSort("type")}
                align="center"
                accent="emerald"
              >
                النوع
              </SortableTh>
            )}
            {columnsState.isVisible("paymentMode") && (
              <SortableTh
                direction={getSortDirection("paymentMode")}
                onSort={() => toggleSort("paymentMode")}
                align="center"
                accent="emerald"
              >
                الدفع
              </SortableTh>
            )}
            {columnsState.isVisible("customerName") && (
              <SortableTh
                direction={getSortDirection("customerName")}
                onSort={() => toggleSort("customerName")}
                accent="emerald"
              >
                العميل
              </SortableTh>
            )}
            {columnsState.isVisible("performedByName") && (
              <SortableTh
                direction={getSortDirection("performedByName")}
                onSort={() => toggleSort("performedByName")}
                accent="emerald"
              >
                المنفّذ / الوردية
              </SortableTh>
            )}
            {columnsState.isVisible("itemsCount") && (
              <SortableTh
                direction={getSortDirection("itemsCount")}
                onSort={() => toggleSort("itemsCount")}
                align="center"
                accent="emerald"
              >
                الأصناف
              </SortableTh>
            )}
            {columnsState.isVisible("totalAmount") && (
              <SortableTh
                direction={getSortDirection("totalAmount")}
                onSort={() => toggleSort("totalAmount")}
                align="center"
                accent="emerald"
              >
                الصافي النهائي
              </SortableTh>
            )}
            <th className="py-2.5 px-3 text-left">إجراءات</th>
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
            itemLabel="فاتورة"
            accent="emerald"
            showSummaryWhenComplete
          />
        }
      >
        {pagination.visibleItems.map((inv) => {
          const isExpanded = Boolean(expandedIds[inv.id]);
          const isSale = inv.type === "SALE";

          return (
            <React.Fragment key={inv.id}>
              <tr
                onClick={() => toggleExpand(inv.id)}
                className={`cursor-pointer transition ${
                  isExpanded
                    ? "bg-emerald-950/25"
                    : "bg-slate-950/40 hover:bg-slate-800/55"
                }`}
              >
                {columnsState.isVisible("createdAt") && (
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className="font-mono font-extrabold text-white">
                        {inv.id}
                      </span>
                    </div>
                    <div className="text-[10.5px] font-mono text-slate-500 mt-0.5 pr-5">
                      {new Date(inv.createdAt).toLocaleString("ar-SA", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  </td>
                )}

                {columnsState.isVisible("type") && (
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        isSale
                          ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                          : "bg-rose-950 text-rose-300 border-rose-800"
                      }`}
                    >
                      {isSale ? "فاتورة بيع" : "فاتورة مرتجع"}
                    </span>
                  </td>
                )}

                {columnsState.isVisible("paymentMode") && (
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 border ${
                        inv.paymentMode === "CASH"
                          ? "bg-sky-950 text-sky-300 border-sky-800"
                          : "bg-amber-950 text-amber-300 border-amber-800"
                      }`}
                    >
                      {inv.paymentMode === "CASH" ? (
                        <>
                          <Banknote className="w-3 h-3" /> نقدي
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-3 h-3" /> آجل
                        </>
                      )}
                    </span>
                  </td>
                )}

                {columnsState.isVisible("customerName") && (
                  <td className="py-3 px-3 font-bold text-slate-100">
                    <span className="inline-flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {inv.customerName || "عميل نقدي"}
                    </span>
                  </td>
                )}

                {columnsState.isVisible("performedByName") && (
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1 text-sky-400 font-semibold">
                      <UserCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>{inv.performedByName || "غير موثّق"}</span>
                    </div>
                    {inv.shiftId && (
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {inv.shiftId}
                      </div>
                    )}
                  </td>
                )}

                {columnsState.isVisible("itemsCount") && (
                  <td className="py-3 px-3 text-center font-mono font-bold text-slate-300">
                    {inv.items.length} صنف
                  </td>
                )}

                {columnsState.isVisible("totalAmount") && (
                  <td className="py-3 px-3 text-center">
                    <div
                      className={`font-mono font-extrabold text-sm ${
                        isSale ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {inv.totalAmount.toFixed(2)} ر.س
                    </div>
                    {inv.discountPercent > 0 && (
                      <div className="text-[10px] font-mono text-amber-400">
                        خصم {inv.discountPercent}%
                      </div>
                    )}
                  </td>
                )}

                <td className="py-3 px-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReprint(inv);
                      }}
                      title="معاينة وإعادة طباعة الفاتورة ولصاقات الجرعات"
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] inline-flex items-center gap-1 transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      طباعة
                    </button>

                    {/* يظهر زر الاسترداد للمرتجع فقط لمن يمتلك صلاحية canProcessReturn */}
                    {canProcessReturn && isSale && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReturnInvoice(inv);
                        }}
                        title="استرداد الفاتورة بالكامل لشاشة المرتجع"
                        className="p-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600 border border-amber-600/60 text-amber-300 hover:text-white transition"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <span
                      className={`px-2 py-1.5 rounded-lg border text-[10.5px] font-bold ${
                        isExpanded
                          ? "bg-emerald-950/70 border-emerald-700 text-emerald-200"
                          : "bg-slate-900 border-slate-700 text-slate-300"
                      }`}
                    >
                      {isExpanded ? "إخفاء" : "التفاصيل"}
                    </span>
                  </div>
                </td>
              </tr>

              {/* تفاصيل الفاتورة الموسّعة (التوثيق الرقابي + جدول الأدوية المصروفة + الملخص المالي) */}
              {isExpanded && (
                <tr className="bg-slate-950/90">
                  <td colSpan={columnsState.visibleCount + 1} className="p-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
                      {/* شريط التوثيق الرقابي للفاتورة */}
                      <div className="px-3.5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3 text-[11px]">
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="font-bold text-slate-200 flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-emerald-400" />
                            الأدوية المصروفة في الفاتورة ({inv.items.length})
                          </span>
                          <span className="inline-flex items-center gap-1 text-sky-400">
                            <UserCheck className="w-3.5 h-3.5" />
                            المنفّذ:{" "}
                            <b className="text-slate-100">
                              {inv.performedByName || "غير موثّق"}
                            </b>
                          </span>
                          <span className="inline-flex items-center gap-1 text-purple-400 font-mono">
                            <Lock className="w-3.5 h-3.5" />
                            الوردية:{" "}
                            <b className="text-slate-200">
                              {inv.shiftId || "—"}
                            </b>
                          </span>
                        </div>

                        <div className="font-mono text-slate-400 text-[10.5px]">
                          {new Date(inv.createdAt).toLocaleString("ar-SA")}
                        </div>
                      </div>

                      {/* جدول أصناف الفاتورة */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-[11px]">
                          <thead>
                            <tr className="border-b border-slate-800/80 text-slate-400 text-[10px]">
                              <th className="py-2 px-3">الدواء والباركود</th>
                              <th className="py-2 px-2 text-center">الوحدة</th>
                              <th className="py-2 px-2 text-center">
                                سعر الوحدة
                              </th>
                              <th className="py-2 px-2 text-center">الكمية</th>
                              <th className="py-2 px-3 text-left">
                                إجمالي السطر
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {inv.items.map((item) => (
                              <tr
                                key={item.cartKey}
                                className="hover:bg-slate-800/35"
                              >
                                <td className="py-2 px-3">
                                  <div className="font-bold text-slate-100">
                                    {item.product.name}
                                  </div>
                                  <div className="text-[9.5px] font-mono text-slate-500">
                                    {item.product.barcode}
                                  </div>
                                </td>
                                <td className="py-2 px-2 text-center text-slate-300">
                                  {item.unit === "pack"
                                    ? "علبة كاملة"
                                    : "شريط فرط"}
                                </td>
                                <td className="py-2 px-2 text-center font-mono text-slate-200">
                                  {item.unitPrice.toFixed(2)}
                                </td>
                                <td className="py-2 px-2 text-center font-mono font-bold text-white">
                                  {item.qty}
                                </td>
                                <td className="py-2 px-3 text-left font-mono font-bold text-emerald-400">
                                  {(item.unitPrice * item.qty).toFixed(2)} ر.س
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* الملخص المالي وأزرار الطباعة والاسترداد */}
                      <div className="px-3.5 py-2.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-4 flex-wrap font-mono text-[11px]">
                          <span className="text-slate-400">
                            الإجمالي الفرعي:{" "}
                            <b className="text-slate-200">
                              {inv.subtotal.toFixed(2)}
                            </b>
                          </span>
                          <span className="text-slate-400">
                            الخصم:{" "}
                            <b className="text-amber-300">
                              {inv.discountPercent}%
                            </b>
                          </span>
                          <span className="text-slate-300">
                            الصافي النهائي:{" "}
                            <b
                              className={`text-sm ${
                                isSale ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {inv.totalAmount.toFixed(2)} ر.س
                            </b>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleReprint(inv)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition"
                          >
                            <Printer className="w-3.5 h-3.5" /> معاينة وإعادة
                            طباعة الفاتورة ولصاقات الجرعات
                          </button>

                          {canProcessReturn && isSale && (
                            <button
                              type="button"
                              onClick={() => handleReturnInvoice(inv)}
                              className="bg-amber-600/20 hover:bg-amber-600 border border-amber-600/60 text-amber-300 hover:text-white font-bold px-3.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition"
                            >
                              <Undo2 className="w-3.5 h-3.5" /> استرداد الفاتورة
                              بالكامل لشاشة المرتجع
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </DataTableShell>
    </div>
  );
};
