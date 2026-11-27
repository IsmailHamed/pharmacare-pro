import React, { useEffect, useMemo, useState } from "react";
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
import { DataTableToolbar } from "../common/table/DataTableToolbar";
import { TableEmptyState } from "../common/table/TableEmptyState";
import { TableLoadMoreFooter } from "../common/table/TableLoadMoreFooter";
import {
  FileText,
  X,
  Printer,
  Undo2,
  Eye,
  Calendar,
  User,
  UserCheck,
  Lock,
  CreditCard,
  Banknote,
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type InvoiceTypeFilter = "ALL" | "SALE" | "RETURN";
type InvoicePaymentFilter = "ALL" | "CASH" | "CREDIT";

// مفاتيح الحقول القابلة للإظهار والإخفاء في بطاقات الفواتير وملف التصدير
type InvoiceFieldKey =
  | "idAndDate"
  | "type"
  | "paymentMode"
  | "customerName"
  | "performedByName"
  | "itemsCount"
  | "totalAmount";

// تعريف حقول العرض والتحكم في الظهور (مع قفل رقم الفاتورة والتاريخ والعميل)
const INVOICE_FIELDS: readonly TableColumnDef<InvoiceFieldKey>[] = [
  { id: "idAndDate", label: "رقم الفاتورة والتاريخ", locked: true },
  { id: "type", label: "نوع الفاتورة" },
  { id: "paymentMode", label: "طريقة الدفع" },
  { id: "customerName", label: "العميل", locked: true },
  { id: "performedByName", label: "المنفّذ / الوردية" },
  { id: "itemsCount", label: "عدد الأصناف" },
  { id: "totalAmount", label: "الصافي النهائي" },
];

// أعمدة التصدير إلى Excel / CSV مرتبطة بمعرّفات الحقول لتصدير الظاهر فقط
const INVOICE_EXPORT_COLUMNS: readonly TableExportColumn<
  InvoiceEntity,
  InvoiceFieldKey
>[] = [
  { columnId: "idAndDate", header: "رقم الفاتورة", getValue: (inv) => inv.id },
  {
    columnId: "idAndDate",
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

export const InvoicesHistoryModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { invoices, setLastPrintedInvoice, loadInvoiceForReturn } =
    usePosStore();

  // التحقق من صلاحية المستخدم الحالي لإجراء مرتجعات المبيعات (القيمة الافتراضية الآمنة: false)
  const canProcessReturn = usePosStore(
    (s) => s.currentUser?.permissions.canProcessReturn ?? false,
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<InvoiceTypeFilter>("ALL");
  const [paymentFilter, setPaymentFilter] =
    useState<InvoicePaymentFilter>("ALL");
  // حالة نطاق التواريخ الموحّدة (الأزرار السريعة + النطاق اليدوي من/إلى)
  const [dateRange, setDateRange] =
    useState<DateRangeValue>(DEFAULT_DATE_RANGE);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceEntity | null>(
    null,
  );

  // إدارة إظهار وإخفاء الحقول مع حفظ تفضيلات المستخدم في localStorage
  const columnsState = useTableColumns("invoices_history", INVOICE_FIELDS);

  // إغلاق النافذة بزر Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // فلترة الفواتير حسب نوع الفاتورة وطريقة الدفع ونطاق التواريخ ونص البحث (رقم الفاتورة / العميل / المنفّذ / الوردية / الدواء)
  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (typeFilter !== "ALL" && inv.type !== typeFilter) return false;
      if (paymentFilter !== "ALL" && inv.paymentMode !== paymentFilter)
        return false;
      if (!matchesDateRange(inv.createdAt, dateRange)) return false;

      if (!q) return true;

      const matchesId = inv.id.toLowerCase().includes(q);
      const matchesCustomer = inv.customerName.toLowerCase().includes(q);
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
  }, [invoices, searchQuery, typeFilter, paymentFilter, dateRange]);

  // التحميل التدريجي للفواتير (50 فاتورة في الدفعة) لمنع بطء القائمة مع تراكم السجلات
  const pagination = useTablePagination(filteredInvoices, {
    pageSize: 50,
    resetDeps: [
      searchQuery,
      typeFilter,
      paymentFilter,
      dateRange.from,
      dateRange.to,
    ],
  });

  if (!isOpen) return null;

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    typeFilter !== "ALL" ||
    paymentFilter !== "ALL" ||
    isDateRangeActive(dateRange);

  // إعادة ضبط كافة فلاتر البحث والنوع والدفع والتاريخ بضغطة واحدة
  const handleResetFilters = () => {
    setSearchQuery("");
    setTypeFilter("ALL");
    setPaymentFilter("ALL");
    setDateRange(DEFAULT_DATE_RANGE);
  };

  const activeInvoice =
    (selectedInvoice &&
      filteredInvoices.find((inv) => inv.id === selectedInvoice.id)) ||
    filteredInvoices[0] ||
    null;

  const handleReprint = (invoice: InvoiceEntity) => {
    setLastPrintedInvoice(invoice);
    onClose();
  };

  const handleReturnInvoice = (invoice: InvoiceEntity) => {
    // منع استرداد الفاتورة إلى شاشة المرتجع إذا كان المستخدم لا يمتلك الصلاحية
    if (!canProcessReturn) return;

    const ok = loadInvoiceForReturn(invoice.id);
    if (ok) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* رأس النافذة */}
        <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-white text-sm">
              سجل الفواتير السابقة وإعادة الطباعة والاسترداد
            </h3>
            <span className="bg-slate-900 border border-slate-700 text-slate-300 font-mono text-[10px] px-2 py-0.5 rounded-full">
              إجمالي السجلات: {filteredInvoices.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="إغلاق (Esc)"
            className="text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-700 p-1.5 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* شريط البحث والفلترة الموحّد (DataTableToolbar + FilterPills + DateRangeFilter + التصدير والحقول) */}
        <div className="p-3 bg-slate-950 border-b border-slate-800 shrink-0">
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
                <TableExportButton
                  items={filteredInvoices}
                  columns={INVOICE_EXPORT_COLUMNS}
                  isColumnVisible={columnsState.isVisible}
                  fileNamePrefix="Invoices_History"
                  itemLabel="فاتورة"
                />
              </>
            }
            hasActiveFilters={hasActiveFilters}
            onResetFilters={handleResetFilters}
            visibleCount={pagination.visibleCount}
            filteredCount={filteredInvoices.length}
            totalCount={invoices.length}
            itemLabel="فاتورة"
          />
        </div>

        {/* القسم الرئيسي: قائمة الفواتير يميناً + تفاصيل الفاتورة المحددة يساراً (بدون تمرير مزدوج) */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* قائمة الفواتير */}
          <div className="w-7/12 border-l border-slate-800 min-h-0 overflow-y-auto p-3 space-y-2">
            {invoices.length === 0 ? (
              <TableEmptyState
                variant="empty"
                icon={FileText}
                title="لا توجد فواتير مسجلة في النظام حتى الآن"
                description="ستظهر هنا كافة فواتير المبيعات والمرتجعات فور إصدارها من نقطة البيع."
              />
            ) : filteredInvoices.length === 0 ? (
              <TableEmptyState
                variant="no-results"
                searchQuery={searchQuery}
                onResetFilters={handleResetFilters}
                description="لا توجد فواتير مطابقة لمعايير البحث أو الفلاتر الحالية."
              />
            ) : (
              <>
                {pagination.visibleItems.map((inv) => {
                  const isSelected = activeInvoice?.id === inv.id;
                  return (
                    <div
                      key={inv.id}
                      onClick={() => setSelectedInvoice(inv)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2 ${
                        isSelected
                          ? "bg-slate-800/90 border-emerald-500 shadow"
                          : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-extrabold text-white text-xs">
                            {inv.id}
                          </span>
                          {columnsState.isVisible("type") && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                inv.type === "SALE"
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                  : "bg-rose-950 text-rose-300 border border-rose-800"
                              }`}
                            >
                              {inv.type === "SALE"
                                ? "فاتورة بيع"
                                : "فاتورة مرتجع"}
                            </span>
                          )}
                          {columnsState.isVisible("paymentMode") && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                                inv.paymentMode === "CASH"
                                  ? "bg-sky-950 text-sky-300 border border-sky-800"
                                  : "bg-amber-950 text-amber-300 border border-amber-800"
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
                          )}
                        </div>

                        <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />{" "}
                            {inv.customerName || "عميل نقدي"}
                          </span>
                          {columnsState.isVisible("performedByName") &&
                            inv.performedByName && (
                              <span className="flex items-center gap-1 text-sky-400">
                                <UserCheck className="w-3 h-3" />
                                {inv.performedByName}
                              </span>
                            )}
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3" />
                            {new Date(inv.createdAt).toLocaleString("ar-SA")}
                          </span>
                          {columnsState.isVisible("itemsCount") && (
                            <span>({inv.items.length} أصناف)</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {columnsState.isVisible("totalAmount") && (
                          <div className="text-left">
                            <div className="text-[10px] text-slate-400">
                              الصافي
                            </div>
                            <div
                              className={`font-mono font-extrabold text-sm ${
                                inv.type === "RETURN"
                                  ? "text-rose-400"
                                  : "text-emerald-400"
                              }`}
                            >
                              {inv.totalAmount.toFixed(2)} ر.س
                            </div>
                          </div>
                        )}
                        <Eye className="w-4 h-4 text-slate-500" />
                      </div>
                    </div>
                  );
                })}

                {/* تذييل التحميل التدريجي الموحّد (50 فاتورة في الدفعة) */}
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
              </>
            )}
          </div>

          {/* لوحة تفاصيل الفاتورة المحددة: عناصر ثابتة في الأعلى والأسفل، والتمرير محصور في قائمة الأصناف فقط */}
          <div className="w-5/12 bg-slate-950 p-4 flex flex-col min-h-0 overflow-hidden">
            {activeInvoice ? (
              <div className="flex flex-col flex-1 min-h-0 gap-3">
                {/* ترويسة الفاتورة الثابتة */}
                <div className="border-b border-slate-800 pb-2.5 flex items-center justify-between gap-2 shrink-0">
                  <div>
                    <div className="text-slate-400 text-[11px]">
                      تفاصيل الفاتورة المحددة
                    </div>
                    <div className="font-mono font-extrabold text-base text-white mt-0.5">
                      {activeInvoice.id}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-slate-400 text-[11px]">العميل</div>
                    <div className="font-bold text-white">
                      {activeInvoice.customerName || "عميل نقدي"}
                    </div>
                  </div>
                </div>

                {/* بطاقة التوثيق الرقابي الثابتة: منفّذ الفاتورة ورقم الوردية */}
                <div className="grid grid-cols-2 gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-[11px] shrink-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <UserCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400">
                        منفّذ الفاتورة
                      </div>
                      <div className="font-bold text-slate-100 truncate">
                        {activeInvoice.performedByName || "غير موثّق"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0 border-r border-slate-800 pr-2">
                    <Lock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400">
                        الوردية المرتبطة
                      </div>
                      <div className="font-mono font-bold text-slate-200 truncate">
                        {activeInvoice.shiftId || "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* قائمة أصناف الفاتورة: المساحة المرنة الوحيدة القابلة للتمرير عند كثرة الأصناف */}
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="text-slate-400 font-bold text-[11px] mb-1.5 shrink-0">
                    الأدوية المصروفة في الفاتورة ({activeInvoice.items.length}):
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pl-1">
                    {activeInvoice.items.map((item) => (
                      <div
                        key={item.cartKey}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate">
                            {item.product.name}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            الوحدة:{" "}
                            <b className="text-slate-300">
                              {item.unit === "pack" ? "علبة كاملة" : "شريط فرط"}
                            </b>{" "}
                            | السعر: {item.unitPrice.toFixed(2)} × {item.qty}
                          </div>
                        </div>
                        <div className="font-mono font-bold text-emerald-400 shrink-0">
                          {(item.unitPrice * item.qty).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* الملخص المالي الثابت للفاتورة */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1.5 shrink-0">
                  <div className="flex justify-between text-slate-400">
                    <span>الإجمالي الفرعي:</span>
                    <span className="font-mono">
                      {activeInvoice.subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>نسبة الخصم:</span>
                    <span className="font-mono">
                      {activeInvoice.discountPercent}%
                    </span>
                  </div>
                  <div className="flex justify-between font-extrabold text-sm text-white pt-1.5 border-t border-slate-800">
                    <span>الصافي النهائي:</span>
                    <span
                      className={`font-mono ${
                        activeInvoice.type === "RETURN"
                          ? "text-rose-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {activeInvoice.totalAmount.toFixed(2)} ر.س
                    </span>
                  </div>
                </div>

                {/* أزرار إعادة الطباعة واسترداد الفاتورة الثابتة في الأسفل */}
                <div className="pt-2.5 border-t border-slate-800 space-y-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleReprint(activeInvoice)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
                  >
                    <Printer className="w-4 h-4" /> معاينة وإعادة طباعة الفاتورة
                    ولصاقات الجرعات
                  </button>

                  {/* يظهر زر الاسترداد للمرتجع فقط لمن يمتلك صلاحية canProcessReturn */}
                  {canProcessReturn && activeInvoice.type === "SALE" && (
                    <button
                      type="button"
                      onClick={() => handleReturnInvoice(activeInvoice)}
                      className="w-full bg-amber-600/20 hover:bg-amber-600 border border-amber-600/60 text-amber-300 hover:text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition"
                    >
                      <Undo2 className="w-4 h-4" /> استرداد هذه الفاتورة بالكامل
                      لشاشة المرتجع
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">
                اختر فاتورة من القائمة لعرض تفاصيلها
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
