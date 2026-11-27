import React, { useMemo, useState } from "react";
import { PurchaseInvoiceEntity } from "../../../domain/entities";
import { CsvCellValue, exportRowsToCsv } from "../../../domain/utils/csvExport";
import { usePosStore } from "../../../application/store/usePosStore";
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
import { SortableTh } from "../common/table/SortableTh";
import { DataTableToolbar } from "../common/table/DataTableToolbar";
import { DataTableShell } from "../common/table/DataTableShell";
import { TableLoadMoreFooter } from "../common/table/TableLoadMoreFooter";
import {
  FileText,
  Printer,
  FileSpreadsheet,
  ChevronDown,
  ChevronLeft,
  ChevronsUpDown,
  Banknote,
  CreditCard,
  Gift,
  Package,
  Building2,
  ClipboardCheck,
} from "lucide-react";

interface Props {
  purchaseInvoices: PurchaseInvoiceEntity[];
}

type PaymentFilter = "ALL" | "CASH" | "CREDIT";

// مفاتيح الأعمدة القابلة للفرز والتحكم في الظهور في جدول تقارير فواتير الشراء
type PurchaseSortKey =
  | "createdAt"
  | "supplierInvoiceNumber"
  | "supplierName"
  | "paymentMode"
  | "itemsCount"
  | "totalBonusValue"
  | "totalAmount";

// تعريف أعمدة الجدول للتحكم في الإظهار والإخفاء (مع قفل العمودين الأساسيين)
const PURCHASE_COLUMNS: readonly TableColumnDef<PurchaseSortKey>[] = [
  { id: "createdAt", label: "رقم القيد والتاريخ", locked: true },
  { id: "supplierInvoiceNumber", label: "فاتورة المورد" },
  { id: "supplierName", label: "المستودع / المورد", locked: true },
  { id: "paymentMode", label: "طريقة الدفع" },
  { id: "itemsCount", label: "الأصناف والعلب" },
  { id: "totalBonusValue", label: "قيمة البونص" },
  { id: "totalAmount", label: "الإجمالي النهائي" },
];

// خيارات فلتر طريقة الدفع الممرّرة إلى المكوّن الموحّد FilterPills
const PAYMENT_FILTER_OPTIONS: readonly FilterPillOption<PaymentFilter>[] = [
  { id: "ALL", label: "الكل", tone: "slate" },
  { id: "CASH", label: "نقدي", tone: "sky" },
  { id: "CREDIT", label: "آجل", tone: "amber" },
];

// دوال استخراج قيم الأعمدة للفرز (مُعرّفة خارج المكوّن للحفاظ على ثبات المرجع والأداء)
const PURCHASE_SORT_ACCESSORS: SortAccessors<
  PurchaseInvoiceEntity,
  PurchaseSortKey
> = {
  createdAt: (inv) => new Date(inv.createdAt),
  supplierInvoiceNumber: (inv) => inv.supplierInvoiceNumber || null,
  supplierName: (inv) => inv.supplierName,
  paymentMode: (inv) => (inv.paymentMode === "CASH" ? "نقدي" : "آجل"),
  itemsCount: (inv) => inv.items.length,
  totalBonusValue: (inv) => inv.totalBonusValue,
  totalAmount: (inv) => inv.totalAmount,
};

// الترتيب الافتراضي للجدول (الأحدث أولاً) والاتجاه الابتدائي لكل عمود عند النقر الأول
const DEFAULT_PURCHASE_SORT: SortState<PurchaseSortKey> = {
  key: "createdAt",
  direction: "desc",
};

const PURCHASE_DEFAULT_DIRECTIONS: Partial<
  Record<PurchaseSortKey, SortDirection>
> = {
  createdAt: "desc",
  supplierInvoiceNumber: "asc",
  supplierName: "asc",
  paymentMode: "asc",
  itemsCount: "desc",
  totalBonusValue: "desc",
  totalAmount: "desc",
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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

  // إحصائيات الملخص المالي والمخزني للفواتير المطابقة (تشمل كامل النتائج المفلترة وليس الدفعة الظاهرة فقط)
  const summary = useMemo(() => {
    let totalAmount = 0;
    let cashTotal = 0;
    let creditTotal = 0;
    let totalBonusValue = 0;
    let totalPurchasedPacks = 0;
    let totalBonusPacks = 0;
    let totalLinesCount = 0;

    filteredInvoices.forEach((inv) => {
      totalAmount += inv.totalAmount;
      totalBonusValue += inv.totalBonusValue;
      if (inv.paymentMode === "CASH") {
        cashTotal += inv.totalAmount;
      } else {
        creditTotal += inv.totalAmount;
      }
      totalLinesCount += inv.items.length;
      inv.items.forEach((item) => {
        totalPurchasedPacks += item.purchasedPacks;
        totalBonusPacks += item.bonusPacks;
      });
    });

    return {
      invoicesCount: filteredInvoices.length,
      totalAmount: Number(totalAmount.toFixed(2)),
      cashTotal: Number(cashTotal.toFixed(2)),
      creditTotal: Number(creditTotal.toFixed(2)),
      totalBonusValue: Number(totalBonusValue.toFixed(2)),
      totalPurchasedPacks,
      totalBonusPacks,
      totalLinesCount,
    };
  }, [filteredInvoices]);

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

  // تصدير تفصيلي لملف CSV عبر الأداة الموحّدة بترميز عربي (UTF-8 BOM) يحترم أعمدة رأس الفاتورة الظاهرة + تفاصيل البنود
  const handleExportCsv = () => {
    if (filteredInvoices.length === 0) return;

    const showSupplierInv = columnsState.isVisible("supplierInvoiceNumber");
    const showPayment = columnsState.isVisible("paymentMode");
    const showTotalAmount = columnsState.isVisible("totalAmount");
    const showBonusValue = columnsState.isVisible("totalBonusValue");

    const headers: string[] = [
      "رقم القيد الداخلي",
      "رقم أمر الشراء (PO)",
      "تاريخ ووقت الإدخال",
      "اسم المستودع / المورد",
    ];
    if (showSupplierInv) headers.push("رقم فاتورة المورد");
    if (showPayment) headers.push("طريقة الدفع");
    if (showTotalAmount) headers.push("إجمالي الفاتورة");
    if (showBonusValue) headers.push("إجمالي قيمة البونص");

    headers.push(
      "اسم الدواء",
      "الباركود",
      "رقم التشغيلة (Batch)",
      "تاريخ الصلاحية",
      "الكمية المشتراة (علبة)",
      "كمية البونص (علبة)",
      "سعر شراء العلبة",
      "الرصيد السابق (علبة)",
      "التكلفة المرجحة السابقة",
      "التكلفة المرجحة الجديدة",
      "سعر البيع الجديد",
      "إجمالي السطر",
    );

    const rows: CsvCellValue[][] = [];
    filteredInvoices.forEach((inv) => {
      const paymentLabel = inv.paymentMode === "CASH" ? "نقدي" : "آجل";
      const dateStr = inv.createdAt.slice(0, 16).replace("T", " ");

      const buildInvoicePrefix = (): CsvCellValue[] => {
        const prefix: CsvCellValue[] = [
          inv.id,
          inv.purchaseOrderId || "—",
          dateStr,
          inv.supplierName,
        ];
        if (showSupplierInv) prefix.push(inv.supplierInvoiceNumber || "—");
        if (showPayment) prefix.push(paymentLabel);
        if (showTotalAmount) prefix.push(inv.totalAmount.toFixed(2));
        if (showBonusValue) prefix.push(inv.totalBonusValue.toFixed(2));
        return prefix;
      };

      if (inv.items.length === 0) {
        rows.push([
          ...buildInvoicePrefix(),
          "—",
          "—",
          "—",
          "—",
          0,
          0,
          "0.00",
          0,
          "0.00",
          "0.00",
          "0.00",
          "0.00",
        ]);
        return;
      }

      inv.items.forEach((item) => {
        rows.push([
          ...buildInvoicePrefix(),
          item.productName,
          item.barcode,
          item.batchNumber,
          item.expiryDate,
          item.purchasedPacks,
          item.bonusPacks,
          item.purchasePricePerPack.toFixed(2),
          item.previousStockPacks,
          item.previousWeightedCost.toFixed(2),
          item.newWeightedCost.toFixed(2),
          item.newPackSalePrice > 0
            ? item.newPackSalePrice.toFixed(2)
            : "بدون تغيير",
          item.lineTotal.toFixed(2),
        ]);
      });
    });

    const datePart = new Date().toISOString().slice(0, 10);
    exportRowsToCsv({
      fileName: `Purchase_Invoices_Report_${datePart}.csv`,
      headers,
      rows,
    });

    setNotification({
      type: "success",
      message: `تم تصدير تقرير فواتير الشراء (${filteredInvoices.length} فاتورة) بنجاح.`,
    });
  };

  // طباعة تقرير A4 منسّق يشمل جميع الفواتير المفلترة وبنودها
  const handlePrintReport = () => {
    if (filteredInvoices.length === 0) return;

    const today = new Date().toLocaleString("ar-SA");
    const invoicesHtml = filteredInvoices
      .map((inv) => {
        const itemsRows = inv.items
          .map(
            (item) => `
          <tr>
            <td>${escapeHtml(item.productName)}<div class="sub mono">${escapeHtml(item.barcode)}</div></td>
            <td class="mono">${escapeHtml(item.batchNumber)}</td>
            <td class="mono">${escapeHtml(item.expiryDate)}</td>
            <td class="mono center">${item.purchasedPacks}</td>
            <td class="mono center">${item.bonusPacks}</td>
            <td class="mono center">${item.purchasePricePerPack.toFixed(2)}</td>
            <td class="mono center">${item.previousWeightedCost.toFixed(2)} ← ${item.newWeightedCost.toFixed(2)}</td>
            <td class="mono bold center">${item.lineTotal.toFixed(2)}</td>
          </tr>`,
          )
          .join("");

        return `
      <div class="inv-block">
        <div class="inv-head">
          <div>
            <span class="bold">${escapeHtml(inv.supplierName)}</span>
            <span class="badge">${inv.paymentMode === "CASH" ? "نقدي" : "آجل"}</span>
            <div class="sub mono">القيد: ${escapeHtml(inv.id)} | فاتورة المورد: ${escapeHtml(inv.supplierInvoiceNumber || "—")}${inv.purchaseOrderId ? ` | أمر الشراء: ${escapeHtml(inv.purchaseOrderId)}` : ""}</div>
          </div>
          <div style="text-align:left;">
            <div class="mono bold">الإجمالي: ${inv.totalAmount.toFixed(2)} ر.س | البونص: ${inv.totalBonusValue.toFixed(2)} ر.س</div>
            <div class="sub mono">${escapeHtml(new Date(inv.createdAt).toLocaleString("ar-SA"))}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>الصنف والباركود</th>
              <th>التشغيلة</th>
              <th>الصلاحية</th>
              <th class="center">المشترى</th>
              <th class="center">البونص</th>
              <th class="center">سعر العلبة</th>
              <th class="center">التكلفة (قبل ← بعد)</th>
              <th class="center">إجمالي السطر</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
      </div>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>تقرير فواتير الشراء - ${escapeHtml(settings.pharmacyName)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { font-family: "Tahoma", "Segoe UI", Arial, sans-serif; font-size: 11px; color: #111; margin: 0; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 12px; }
    .title { font-size: 17px; font-weight: 800; }
    .mono { font-family: "Consolas", monospace; }
    .bold { font-weight: 700; }
    .center { text-align: center; }
    .sub { font-size: 10px; color: #555; margin-top: 2px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
    .box { border: 1px solid #bbb; border-radius: 6px; padding: 7px 9px; }
    .box-label { font-size: 10px; color: #555; }
    .box-val { font-size: 14px; font-weight: 800; margin-top: 2px; }
    .inv-block { border: 1px solid #bbb; border-radius: 6px; margin-bottom: 12px; page-break-inside: avoid; overflow: hidden; }
    .inv-head { background: #f3f4f6; padding: 7px 10px; display: flex; justify-content: space-between; border-bottom: 1px solid #ccc; }
    .badge { display: inline-block; border: 1px solid #888; border-radius: 99px; padding: 1px 6px; font-size: 10px; margin-right: 6px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-top: 1px solid #ddd; padding: 5px 6px; text-align: right; }
    th { background: #fafafa; font-size: 10px; color: #444; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${escapeHtml(settings.pharmacyName)}</div>
      <div class="sub">هاتف: <span class="mono">${escapeHtml(settings.phone)}</span></div>
    </div>
    <div style="text-align:left;">
      <div class="bold" style="font-size:14px;">تقرير فواتير الشراء والبونص التفصيلي</div>
      <div class="sub">تاريخ الطباعة: <span class="mono">${escapeHtml(today)}</span></div>
      ${supplierFilter !== "ALL" ? `<div class="sub">المستودع: ${escapeHtml(supplierFilter)}</div>` : ""}
    </div>
  </div>
  <div class="summary">
    <div class="box"><div class="box-label">عدد الفواتير</div><div class="box-val mono">${summary.invoicesCount}</div></div>
    <div class="box"><div class="box-label">إجمالي المشتريات</div><div class="box-val mono">${summary.totalAmount.toFixed(2)} ر.س</div></div>
    <div class="box"><div class="box-label">نقدي / آجل</div><div class="box-val mono" style="font-size:11px;">${summary.cashTotal.toFixed(2)} / ${summary.creditTotal.toFixed(2)}</div></div>
    <div class="box"><div class="box-label">قيمة البونص المجاني</div><div class="box-val mono">${summary.totalBonusValue.toFixed(2)} ر.س</div></div>
  </div>
  ${invoicesHtml}
</body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc && iframe.contentWindow) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.contentWindow.focus();
      window.setTimeout(() => {
        iframe.contentWindow?.print();
        window.setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 100);
    } else {
      document.body.removeChild(iframe);
      window.print();
    }
  };

  return (
    <div className="space-y-4">
      {/* شريط المؤشرات الملخصة (KPIs) للفواتير المفلترة */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>عدد فواتير الشراء</span>
            <FileText className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="font-mono font-extrabold text-lg text-white mt-1">
            {summary.invoicesCount}
            <span className="text-[11px] font-sans font-normal text-slate-400 mr-1.5">
              ({summary.totalLinesCount} بند)
            </span>
          </div>
          <div className="text-[10.5px] text-slate-500 font-mono mt-0.5">
            العلب: {summary.totalPurchasedPacks} مشتراة +{" "}
            <span className="text-emerald-400">
              {summary.totalBonusPacks} بونص
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>إجمالي المشتريات</span>
            <Package className="w-4 h-4 text-sky-400" />
          </div>
          <div className="font-mono font-extrabold text-lg text-white mt-1">
            {summary.totalAmount.toFixed(2)}{" "}
            <span className="text-xs font-sans text-slate-400">ر.س</span>
          </div>
          <div className="text-[10.5px] text-slate-500 mt-0.5">
            مجموع صافي فواتير الشراء المطابقة
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>توزيع الدفع (نقدي / آجل)</span>
            <CreditCard className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-1.5 space-y-1 font-mono text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-sky-300 font-sans">نقدي:</span>
              <b className="text-sky-400">{summary.cashTotal.toFixed(2)} ر.س</b>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-amber-300 font-sans">آجل (ذمم):</span>
              <b className="text-amber-400">
                {summary.creditTotal.toFixed(2)} ر.س
              </b>
            </div>
          </div>
        </div>

        <div className="bg-emerald-950/25 border border-emerald-800/60 rounded-2xl p-3.5">
          <div className="text-[11px] text-emerald-300/90 flex items-center justify-between">
            <span>إجمالي قيمة البونص المجاني</span>
            <Gift className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-mono font-extrabold text-lg text-emerald-400 mt-1">
            +{summary.totalBonusValue.toFixed(2)}{" "}
            <span className="text-xs font-sans text-emerald-300/80">ر.س</span>
          </div>
          <div className="text-[10.5px] text-emerald-300/70 font-mono mt-0.5">
            إجمالي الوفر الناتج عن البونص ({summary.totalBonusPacks} علبة)
          </div>
        </div>
      </div>

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

              {/* جدول بنود الفاتورة التفصيلي بكافة المعلومات المحاسبية والمخزنية */}
              {isExpanded && (
                <tr className="bg-slate-950/90">
                  <td colSpan={columnsState.visibleCount + 1} className="p-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
                      <div className="px-3 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                        <span className="font-bold text-slate-200 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-indigo-400" />
                          تفاصيل بنود فاتورة الشراء ({inv.id}) — المستودع:{" "}
                          {inv.supplierName}
                        </span>
                        <span className="font-mono text-slate-400 text-[10.5px]">
                          الفرع: {inv.branchId} • فاتورة المورد:{" "}
                          {inv.supplierInvoiceNumber || "غير مدخلة"}
                          {inv.purchaseOrderId && (
                            <span className="text-amber-300 mr-2">
                              • أمر الشراء: {inv.purchaseOrderId}
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-[11px]">
                          <thead>
                            <tr className="border-b border-slate-800/80 text-slate-400 text-[10px]">
                              <th className="py-2 px-3">الصنف والباركود</th>
                              <th className="py-2 px-2">التشغيلة والصلاحية</th>
                              <th className="py-2 px-2 text-center">المشترى</th>
                              <th className="py-2 px-2 text-center">+ بونص</th>
                              <th className="py-2 px-2 text-center">
                                سعر الشراء
                              </th>
                              <th className="py-2 px-2 text-center">
                                الرصيد والتكلفة السابقة
                              </th>
                              <th className="py-2 px-2 text-center">
                                التكلفة المرجحة الجديدة
                              </th>
                              <th className="py-2 px-2 text-center">
                                سعر البيع الجديد
                              </th>
                              <th className="py-2 px-3 text-left">
                                إجمالي السطر
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {inv.items.map((item) => (
                              <tr
                                key={item.id}
                                className="hover:bg-slate-800/35"
                              >
                                <td className="py-2 px-3">
                                  <div className="font-bold text-slate-100">
                                    {item.productName}
                                  </div>
                                  <div className="text-[9.5px] font-mono text-slate-500">
                                    {item.barcode}
                                  </div>
                                </td>

                                <td className="py-2 px-2 font-mono">
                                  <div className="text-slate-200 font-bold">
                                    {item.batchNumber}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {item.expiryDate}
                                  </div>
                                </td>

                                <td className="py-2 px-2 text-center font-mono font-bold text-white">
                                  {item.purchasedPacks} علبة
                                </td>

                                <td className="py-2 px-2 text-center font-mono font-bold text-emerald-400">
                                  {item.bonusPacks > 0
                                    ? `+${item.bonusPacks}`
                                    : "0"}
                                </td>

                                <td className="py-2 px-2 text-center font-mono text-slate-200">
                                  {item.purchasePricePerPack.toFixed(2)}
                                </td>

                                <td className="py-2 px-2 text-center font-mono text-slate-400">
                                  <div>{item.previousStockPacks} علبة</div>
                                  <div className="text-[10px]">
                                    {item.previousWeightedCost.toFixed(2)} ر.س
                                  </div>
                                </td>

                                <td className="py-2 px-2 text-center font-mono font-bold text-amber-400">
                                  {item.newWeightedCost.toFixed(2)} ر.س
                                </td>

                                <td className="py-2 px-2 text-center font-mono text-sky-300">
                                  {item.newPackSalePrice > 0
                                    ? `${item.newPackSalePrice.toFixed(2)} ر.س`
                                    : "بدون تغيير"}
                                </td>

                                <td className="py-2 px-3 text-left font-mono font-extrabold text-white">
                                  {item.lineTotal.toFixed(2)} ر.س
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
