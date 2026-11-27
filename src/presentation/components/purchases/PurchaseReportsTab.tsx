import React, { useMemo, useState } from "react";
import { PurchaseInvoiceEntity } from "../../../domain/entities";
import { usePosStore } from "../../../application/store/usePosStore";
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
import { SortableTh } from "../common/table/SortableTh";
import { DataTableToolbar } from "../common/table/DataTableToolbar";
import { DataTableShell } from "../common/table/DataTableShell";
import { TableLoadMoreFooter } from "../common/table/TableLoadMoreFooter";
import {
  DEFAULT_PURCHASE_SORT,
  PAYMENT_FILTER_OPTIONS,
  PURCHASE_COLUMNS,
  PURCHASE_DEFAULT_DIRECTIONS,
  PURCHASE_SORT_ACCESSORS,
  PaymentFilter,
  computePurchaseReportsSummary,
  exportPurchaseReportsToCsv,
  printPurchaseReportsA4,
} from "./reports/purchaseReports.config";
import { PurchaseReportsSummaryCards } from "./reports/PurchaseReportsSummaryCards";
import { PurchaseInvoiceExpandedRow } from "./reports/PurchaseInvoiceExpandedRow";
import {
  Banknote,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronsUpDown,
  ClipboardCheck,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Printer,
} from "lucide-react";

interface Props {
  purchaseInvoices: PurchaseInvoiceEntity[];
}

/**
 * تبويب تقارير وسجل فواتير الشراء والبونص بجدول كامل العرض
 * يعرض كافة تفاصيل الفواتير والبنود المشتراة والتكلفة المرجحة قبل/بعد البونص
 * باستخدام نواة الجداول الموحّدة (فلاتر التواريخ السريعة، فرز الأعمدة، إظهار/إخفاء الأعمدة، والتحميل التدريجي)
 */
export const PurchaseReportsTab: React.FC<Props> = ({ purchaseInvoices }) => {
  const settings = usePosStore((s) => s.settings);
  const suppliers = usePosStore((s) => s.suppliers);
  const setNotification = usePosStore((s) => s.setNotification);

  const [searchQuery, setSearchQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("ALL");
  // حالة نطاق التواريخ الموحّدة (تدعم الأزرار السريعة + النطاق اليدوي من/إلى)
  const [dateRange, setDateRange] =
    useState<DateRangeValue>(DEFAULT_DATE_RANGE);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // إدارة إظهار وإخفاء الأعمدة مع حفظ تفضيلات المستخدم في localStorage
  const columnsState = useTableColumns("purchase_reports", PURCHASE_COLUMNS);

  // تجميع قائمة المستودعات من الفواتير المسجلة + دليل المستودعات
  const availableSuppliers = useMemo(() => {
    const names = new Set<string>();
    purchaseInvoices.forEach((inv) => {
      if (inv.supplierName.trim()) names.add(inv.supplierName.trim());
    });
    suppliers.forEach((sup) => {
      if (sup.name.trim()) names.add(sup.name.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, "ar"));
  }, [purchaseInvoices, suppliers]);

  // تصفية الفواتير حسب المستودع، طريقة الدفع، نطاق التواريخ الموحّد، وعبارة البحث
  const matchedInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return purchaseInvoices.filter((inv) => {
      if (
        supplierFilter !== "ALL" &&
        inv.supplierName.trim() !== supplierFilter
      ) {
        return false;
      }

      if (paymentFilter !== "ALL" && inv.paymentMode !== paymentFilter) {
        return false;
      }

      if (!matchesDateRange(inv.createdAt, dateRange)) return false;

      if (!q) return true;

      const matchesHeader =
        inv.id.toLowerCase().includes(q) ||
        (inv.supplierInvoiceNumber || "").toLowerCase().includes(q) ||
        (inv.purchaseOrderId || "").toLowerCase().includes(q) ||
        inv.supplierName.toLowerCase().includes(q);

      if (matchesHeader) return true;

      return inv.items.some(
        (item) =>
          item.productName.toLowerCase().includes(q) ||
          item.barcode.toLowerCase().includes(q) ||
          item.batchNumber.toLowerCase().includes(q),
      );
    });
  }, [purchaseInvoices, searchQuery, supplierFilter, paymentFilter, dateRange]);

  // تطبيق الفرز التفاعلي بالأعمدة على الفواتير المطابقة (يُستخدم أيضاً لترتيب التصدير والطباعة)
  const {
    sortedItems: filteredInvoices,
    sortState,
    toggleSort,
    getSortDirection,
  } = useTableSort(matchedInvoices, {
    accessors: PURCHASE_SORT_ACCESSORS,
    defaultSort: DEFAULT_PURCHASE_SORT,
    defaultDirections: PURCHASE_DEFAULT_DIRECTIONS,
  });

  // التحميل التدريجي للصفوف (50 فاتورة في الدفعة) مع إعادة ضبط تلقائية عند تغيّر الفلاتر أو الفرز
  const pagination = useTablePagination(filteredInvoices, {
    pageSize: 50,
    resetDeps: [
      searchQuery,
      supplierFilter,
      paymentFilter,
      dateRange.from,
      dateRange.to,
      sortState?.key,
      sortState?.direction,
    ],
  });

  const summary = useMemo(
    () => computePurchaseReportsSummary(filteredInvoices),
    [filteredInvoices],
  );

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    supplierFilter !== "ALL" ||
    paymentFilter !== "ALL" ||
    isDateRangeActive(dateRange);

  const handleResetFilters = () => {
    setSearchQuery("");
    setSupplierFilter("ALL");
    setPaymentFilter("ALL");
    setDateRange(DEFAULT_DATE_RANGE);
  };

  // فحص حالة التوسيع بناءً على الصفوف الظاهرة حالياً في الجدول
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

  const handleExportCsv = () => {
    if (filteredInvoices.length === 0) return;
    exportPurchaseReportsToCsv({
      filteredInvoices,
      isColumnVisible: columnsState.isVisible,
    });
    setNotification({
      type: "success",
      message: `تم تصدير تقرير فواتير الشراء (${filteredInvoices.length} فاتورة) بنجاح.`,
    });
  };

  const handlePrintReport = () => {
    printPurchaseReportsA4({
      filteredInvoices,
      summary,
      supplierFilter,
      pharmacyName: settings.pharmacyName,
      pharmacyPhone: settings.phone,
    });
  };

  return (
    <div className="space-y-4">
      {/* شريط المؤشرات الملخصة (KPIs) للفواتير المفلترة */}
      <PurchaseReportsSummaryCards summary={summary} />

      {/* الحاوية الموحّدة للجدول والفلاتر والتصفح التدريجي */}
      <DataTableShell
        totalCount={purchaseInvoices.length}
        filteredCount={filteredInvoices.length}
        searchQuery={searchQuery}
        onResetFilters={handleResetFilters}
        stickyHeader
        emptyState={{
          icon: FileText,
          title: "لا توجد فواتير مشتريات مسجلة في النظام حتى الآن",
          description:
            "عند اعتماد أي فاتورة شراء من تبويب «إدخال فاتورة شراء وبونص» ستظهر هنا بكامل تفاصيلها وبنودها.",
        }}
        noResultsState={{
          description:
            "لا توجد فواتير مشتريات مطابقة لخيارات البحث أو الفلترة الحالية.",
        }}
        toolbar={
          <DataTableToolbar
            accent="indigo"
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="ابحث برقم القيد، فاتورة المورد، أمر الشراء (PO)، المستودع، اسم/باركود الدواء، أو رقم التشغيلة..."
            filters={
              <>
                {/* فلتر المستودع */}
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={supplierFilter}
                    onChange={(e) => setSupplierFilter(e.target.value)}
                    className="bg-transparent text-slate-200 outline-none text-xs"
                  >
                    <option value="ALL" className="bg-slate-900">
                      كل المستودعات ({availableSuppliers.length})
                    </option>
                    {availableSuppliers.map((sup) => (
                      <option key={sup} value={sup} className="bg-slate-900">
                        {sup}
                      </option>
                    ))}
                  </select>
                </div>

                {/* فلتر طريقة الدفع الموحّد */}
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
              /* فلتر نطاق التواريخ السريع والمخصص الموحّد */
              <DateRangeFilter
                value={dateRange}
                onChange={setDateRange}
                accent="indigo"
              />
            }
            hasActiveFilters={hasActiveFilters}
            onResetFilters={handleResetFilters}
            secondaryActions={
              <>
                {pagination.visibleItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleExpandAll}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-[11px] inline-flex items-center gap-1.5 transition"
                  >
                    <ChevronsUpDown className="w-3.5 h-3.5 text-indigo-400" />
                    {allExpanded ? "طي كل الأصناف" : "توسيع كل الأصناف"}
                  </button>
                )}
                <ColumnVisibilityMenu
                  columnsState={columnsState}
                  accent="indigo"
                />
                <button
                  type="button"
                  disabled={filteredInvoices.length === 0}
                  onClick={handleExportCsv}
                  className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold text-[11px] inline-flex items-center gap-1.5 transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> تصدير Excel / CSV
                </button>

                <button
                  type="button"
                  disabled={filteredInvoices.length === 0}
                  onClick={handlePrintReport}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-200 font-bold text-[11px] inline-flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5" /> طباعة التقرير
                </button>
              </>
            }
            visibleCount={pagination.visibleCount}
            filteredCount={filteredInvoices.length}
            totalCount={purchaseInvoices.length}
            itemLabel="فاتورة"
            metaExtra={
              <span className="text-[10.5px] text-slate-500 hidden sm:inline">
                اضغط على أي رأس عمود للفرز، أو على صف الفاتورة لعرض بنودها
              </span>
            }
          />
        }
        header={
          <tr>
            {columnsState.isVisible("createdAt") && (
              <SortableTh
                direction={getSortDirection("createdAt")}
                onSort={() => toggleSort("createdAt")}
                accent="indigo"
              >
                رقم القيد والتاريخ
              </SortableTh>
            )}
            {columnsState.isVisible("supplierInvoiceNumber") && (
              <SortableTh
                direction={getSortDirection("supplierInvoiceNumber")}
                onSort={() => toggleSort("supplierInvoiceNumber")}
                accent="indigo"
              >
                فاتورة المورد
              </SortableTh>
            )}
            {columnsState.isVisible("supplierName") && (
              <SortableTh
                direction={getSortDirection("supplierName")}
                onSort={() => toggleSort("supplierName")}
                accent="indigo"
              >
                المستودع / المورد
              </SortableTh>
            )}
            {columnsState.isVisible("paymentMode") && (
              <SortableTh
                direction={getSortDirection("paymentMode")}
                onSort={() => toggleSort("paymentMode")}
                align="center"
                accent="indigo"
              >
                طريقة الدفع
              </SortableTh>
            )}
            {columnsState.isVisible("itemsCount") && (
              <SortableTh
                direction={getSortDirection("itemsCount")}
                onSort={() => toggleSort("itemsCount")}
                align="center"
                accent="indigo"
              >
                الأصناف والعلب
              </SortableTh>
            )}
            {columnsState.isVisible("totalBonusValue") && (
              <SortableTh
                direction={getSortDirection("totalBonusValue")}
                onSort={() => toggleSort("totalBonusValue")}
                align="center"
                accent="indigo"
              >
                قيمة البونص
              </SortableTh>
            )}
            {columnsState.isVisible("totalAmount") && (
              <SortableTh
                direction={getSortDirection("totalAmount")}
                onSort={() => toggleSort("totalAmount")}
                align="center"
                accent="indigo"
              >
                الإجمالي النهائي
              </SortableTh>
            )}
            <th className="py-2.5 px-3 text-left">التفاصيل</th>
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
            accent="indigo"
            showSummaryWhenComplete
          />
        }
      >
        {/* جدول تقارير فواتير الشراء الكامل بالصفوف الظاهرة حالياً */}
        {pagination.visibleItems.map((inv) => {
          const isExpanded = Boolean(expandedIds[inv.id]);
          const invoicePurchasedPacks = inv.items.reduce(
            (s, it) => s + it.purchasedPacks,
            0,
          );
          const invoiceBonusPacks = inv.items.reduce(
            (s, it) => s + it.bonusPacks,
            0,
          );

          return (
            <React.Fragment key={inv.id}>
              <tr
                onClick={() => toggleExpand(inv.id)}
                className={`cursor-pointer transition ${
                  isExpanded
                    ? "bg-indigo-950/30"
                    : "bg-slate-950/40 hover:bg-slate-800/55"
                }`}
              >
                {columnsState.isVisible("createdAt") && (
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      ) : (
                        <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className="font-mono font-bold text-indigo-300">
                        {inv.id}
                      </span>
                      {inv.purchaseOrderId && (
                        <span className="inline-flex items-center gap-1 text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/70 text-amber-300">
                          <ClipboardCheck className="w-2.5 h-2.5" />
                          {inv.purchaseOrderId}
                        </span>
                      )}
                    </div>
                    <div className="text-[10.5px] font-mono text-slate-500 mt-0.5 pr-5">
                      {new Date(inv.createdAt).toLocaleString("ar-SA", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  </td>
                )}

                {columnsState.isVisible("supplierInvoiceNumber") && (
                  <td className="py-3 px-3 font-mono text-slate-200 font-bold">
                    {inv.supplierInvoiceNumber || "—"}
                  </td>
                )}

                {columnsState.isVisible("supplierName") && (
                  <td className="py-3 px-3 font-bold text-white">
                    {inv.supplierName}
                  </td>
                )}

                {columnsState.isVisible("paymentMode") && (
                  <td className="py-3 px-3 text-center">
                    {inv.paymentMode === "CASH" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-950 border border-sky-800 text-sky-300">
                        <Banknote className="w-3 h-3" /> نقدي
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-amber-300">
                        <CreditCard className="w-3 h-3" /> آجل
                      </span>
                    )}
                  </td>
                )}

                {columnsState.isVisible("itemsCount") && (
                  <td className="py-3 px-3 text-center">
                    <div className="font-mono font-bold text-slate-200">
                      {inv.items.length} صنف
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {invoicePurchasedPacks} علبة
                      {invoiceBonusPacks > 0 && (
                        <span className="text-emerald-400 mr-1">
                          (+{invoiceBonusPacks} بونص)
                        </span>
                      )}
                    </div>
                  </td>
                )}

                {columnsState.isVisible("totalBonusValue") && (
                  <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400">
                    {inv.totalBonusValue > 0
                      ? `+${inv.totalBonusValue.toFixed(2)} ر.س`
                      : "0.00"}
                  </td>
                )}

                {columnsState.isVisible("totalAmount") && (
                  <td className="py-3 px-3 text-center font-mono font-extrabold text-sm text-white">
                    {inv.totalAmount.toFixed(2)} ر.س
                  </td>
                )}

                <td className="py-3 px-3 text-left">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10.5px] font-bold ${
                      isExpanded
                        ? "bg-indigo-950/70 border-indigo-700 text-indigo-200"
                        : "bg-slate-900 border-slate-700 text-slate-300"
                    }`}
                  >
                    {isExpanded ? "إخفاء البنود" : "عرض كل البنود"}
                  </span>
                </td>
              </tr>

              {/* جدول بنود الفاتورة التفصيلي */}
              {isExpanded && (
                <PurchaseInvoiceExpandedRow
                  invoice={inv}
                  colSpan={columnsState.visibleCount + 1}
                />
              )}
            </React.Fragment>
          );
        })}
      </DataTableShell>
    </div>
  );
};
