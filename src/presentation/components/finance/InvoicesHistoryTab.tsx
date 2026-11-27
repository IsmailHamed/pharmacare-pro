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
  DEFAULT_INVOICE_SORT,
  INVOICE_COLUMNS,
  INVOICE_DEFAULT_DIRECTIONS,
  INVOICE_EXPORT_COLUMNS,
  INVOICE_SORT_ACCESSORS,
  InvoicePaymentFilter,
  InvoiceTypeFilter,
  PAYMENT_FILTER_OPTIONS,
  TYPE_FILTER_OPTIONS,
  computeInvoicesArchiveStats,
} from "./invoices/invoicesHistory.config";
import { InvoicesHistoryHeader } from "./invoices/InvoicesHistoryHeader";
import { InvoiceHistoryExpandedRow } from "./invoices/InvoiceHistoryExpandedRow";
import {
  Banknote,
  ChevronDown,
  ChevronLeft,
  ChevronsUpDown,
  CreditCard,
  FileText,
  Printer,
  Undo2,
  User,
  UserCheck,
} from "lucide-react";

interface Props {
  invoices?: InvoiceEntity[];
  // دالة اختيارية للانتقال إلى شاشة نقطة البيع بعد تحميل فاتورة للمرتجع
  onReturnInvoiceLoaded?: () => void;
}

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
  const archiveStats = useMemo(
    () => computeInvoicesArchiveStats(resolvedInvoices),
    [resolvedInvoices],
  );

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
      <InvoicesHistoryHeader
        totalInvoicesCount={resolvedInvoices.length}
        stats={archiveStats}
      />

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

              {/* تفاصيل الفاتورة الموسّعة */}
              {isExpanded && (
                <InvoiceHistoryExpandedRow
                  invoice={inv}
                  colSpan={columnsState.visibleCount + 1}
                  canProcessReturn={canProcessReturn}
                  onReprint={handleReprint}
                  onReturnInvoice={handleReturnInvoice}
                />
              )}
            </React.Fragment>
          );
        })}
      </DataTableShell>
    </div>
  );
};
