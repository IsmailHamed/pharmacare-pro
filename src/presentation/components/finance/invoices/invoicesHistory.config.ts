import { InvoiceEntity } from "../../../../domain/entities/Invoice";
import { FilterPillOption } from "../../common/table/FilterPills";
import {
  SortAccessors,
  SortDirection,
  SortState,
} from "../../common/table/useTableSort";
import { TableColumnDef } from "../../common/table/useTableColumns";
import { TableExportColumn } from "../../common/table/TableExportButton";

export type InvoiceTypeFilter = "ALL" | "SALE" | "RETURN";
export type InvoicePaymentFilter = "ALL" | "CASH" | "CREDIT";

// مفاتيح الأعمدة القابلة للفرز والتحكم في الظهور داخل سجل فواتير الصندوق
export type InvoiceSortKey =
  | "createdAt"
  | "type"
  | "paymentMode"
  | "customerName"
  | "performedByName"
  | "itemsCount"
  | "totalAmount";

export interface InvoicesArchiveStats {
  salesCount: number;
  salesTotal: number;
  returnsCount: number;
  returnsTotal: number;
  netTotal: number;
}

// تعريف أعمدة جدول الفواتير للتحكم في الإظهار والإخفاء (مع قفل العمودين الأساسيين)
export const INVOICE_COLUMNS: readonly TableColumnDef<InvoiceSortKey>[] = [
  { id: "createdAt", label: "رقم الفاتورة والتاريخ", locked: true },
  { id: "type", label: "نوع الفاتورة" },
  { id: "paymentMode", label: "طريقة الدفع" },
  { id: "customerName", label: "العميل", locked: true },
  { id: "performedByName", label: "المنفّذ / الوردية" },
  { id: "itemsCount", label: "الأصناف" },
  { id: "totalAmount", label: "الصافي النهائي" },
];

// أعمدة التصدير إلى Excel / CSV مرتبطة بمعرّفات الأعمدة لتصدير الحقول الظاهرة فقط
export const INVOICE_EXPORT_COLUMNS: readonly TableExportColumn<
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
export const TYPE_FILTER_OPTIONS: readonly FilterPillOption<InvoiceTypeFilter>[] =
  [
    { id: "ALL", label: "الكل", tone: "slate" },
    { id: "SALE", label: "مبيعات", tone: "emerald" },
    { id: "RETURN", label: "مرتجعات", tone: "rose" },
  ];

// خيارات فلتر طريقة الدفع الممرّرة إلى المكوّن الموحّد FilterPills
export const PAYMENT_FILTER_OPTIONS: readonly FilterPillOption<InvoicePaymentFilter>[] =
  [
    { id: "ALL", label: "كل طرق الدفع", tone: "slate" },
    { id: "CASH", label: "نقدي", tone: "sky" },
    { id: "CREDIT", label: "آجل (ذمم)", tone: "amber" },
  ];

// دوال استخراج قيم الأعمدة للفرز (مُعرّفة خارج المكوّن للحفاظ على ثبات المرجع)
export const INVOICE_SORT_ACCESSORS: SortAccessors<
  InvoiceEntity,
  InvoiceSortKey
> = {
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
export const DEFAULT_INVOICE_SORT: SortState<InvoiceSortKey> = {
  key: "createdAt",
  direction: "desc",
};

export const INVOICE_DEFAULT_DIRECTIONS: Partial<
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

// حساب إحصائيات الملخص العلوي لكامل سجل الفواتير
export const computeInvoicesArchiveStats = (
  invoices: InvoiceEntity[],
): InvoicesArchiveStats => {
  let salesCount = 0;
  let salesTotal = 0;
  let returnsCount = 0;
  let returnsTotal = 0;

  invoices.forEach((inv) => {
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
};
