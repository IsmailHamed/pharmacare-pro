import { PurchaseInvoiceEntity } from "../../../../domain/entities";
import {
  CsvCellValue,
  exportRowsToCsv,
} from "../../../../domain/utils/csvExport";
import {
  escapePrintHtml,
  printHtmlDocument,
} from "../../../../domain/utils/printTemplates";
import { FilterPillOption } from "../../common/table/FilterPills";
import {
  SortAccessors,
  SortDirection,
  SortState,
} from "../../common/table/useTableSort";
import { TableColumnDef } from "../../common/table/useTableColumns";

export type PaymentFilter = "ALL" | "CASH" | "CREDIT";

// مفاتيح الأعمدة القابلة للفرز والتحكم في الظهور في جدول تقارير فواتير الشراء
export type PurchaseSortKey =
  | "createdAt"
  | "supplierInvoiceNumber"
  | "supplierName"
  | "paymentMode"
  | "itemsCount"
  | "totalBonusValue"
  | "totalAmount";

export interface PurchaseReportsSummary {
  invoicesCount: number;
  totalAmount: number;
  cashTotal: number;
  creditTotal: number;
  totalBonusValue: number;
  totalPurchasedPacks: number;
  totalBonusPacks: number;
  totalLinesCount: number;
}

// تعريف أعمدة الجدول للتحكم في الإظهار والإخفاء (مع قفل العمودين الأساسيين)
export const PURCHASE_COLUMNS: readonly TableColumnDef<PurchaseSortKey>[] = [
  { id: "createdAt", label: "رقم القيد والتاريخ", locked: true },
  { id: "supplierInvoiceNumber", label: "فاتورة المورد" },
  { id: "supplierName", label: "المستودع / المورد", locked: true },
  { id: "paymentMode", label: "طريقة الدفع" },
  { id: "itemsCount", label: "الأصناف والعلب" },
  { id: "totalBonusValue", label: "قيمة البونص" },
  { id: "totalAmount", label: "الإجمالي النهائي" },
];

// خيارات فلتر طريقة الدفع الممرّرة إلى المكوّن الموحّد FilterPills
export const PAYMENT_FILTER_OPTIONS: readonly FilterPillOption<PaymentFilter>[] =
  [
    { id: "ALL", label: "الكل", tone: "slate" },
    { id: "CASH", label: "نقدي", tone: "sky" },
    { id: "CREDIT", label: "آجل", tone: "amber" },
  ];

// دوال استخراج قيم الأعمدة للفرز (مُعرّفة خارج المكوّن للحفاظ على ثبات المرجع والأداء)
export const PURCHASE_SORT_ACCESSORS: SortAccessors<
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
export const DEFAULT_PURCHASE_SORT: SortState<PurchaseSortKey> = {
  key: "createdAt",
  direction: "desc",
};

export const PURCHASE_DEFAULT_DIRECTIONS: Partial<
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

// حساب إحصائيات الملخص المالي والمخزني للفواتير المطابقة (تشمل كامل النتائج المفلترة)
export const computePurchaseReportsSummary = (
  filteredInvoices: PurchaseInvoiceEntity[],
): PurchaseReportsSummary => {
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
};

// تصدير تفصيلي لملف CSV عبر الأداة الموحّدة بترميز عربي (UTF-8 BOM) يحترم أعمدة رأس الفاتورة الظاهرة + تفاصيل البنود
export const exportPurchaseReportsToCsv = (params: {
  filteredInvoices: PurchaseInvoiceEntity[];
  isColumnVisible: (id: PurchaseSortKey) => boolean;
}): void => {
  const { filteredInvoices, isColumnVisible } = params;
  if (filteredInvoices.length === 0) return;

  const showSupplierInv = isColumnVisible("supplierInvoiceNumber");
  const showPayment = isColumnVisible("paymentMode");
  const showTotalAmount = isColumnVisible("totalAmount");
  const showBonusValue = isColumnVisible("totalBonusValue");

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
};

// طباعة تقرير A4 منسّق يشمل جميع الفواتير المفلترة وبنودها
export const printPurchaseReportsA4 = (params: {
  filteredInvoices: PurchaseInvoiceEntity[];
  summary: PurchaseReportsSummary;
  supplierFilter: string;
  pharmacyName: string;
  pharmacyPhone?: string;
}): void => {
  const {
    filteredInvoices,
    summary,
    supplierFilter,
    pharmacyName,
    pharmacyPhone,
  } = params;
  if (filteredInvoices.length === 0) return;

  const today = new Date().toLocaleString("ar-SA");
  const invoicesHtml = filteredInvoices
    .map((inv) => {
      const itemsRows = inv.items
        .map(
          (item) => `
          <tr>
            <td>${escapePrintHtml(item.productName)}<div class="sub mono">${escapePrintHtml(item.barcode)}</div></td>
            <td class="mono">${escapePrintHtml(item.batchNumber)}</td>
            <td class="mono">${escapePrintHtml(item.expiryDate)}</td>
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
            <span class="bold">${escapePrintHtml(inv.supplierName)}</span>
            <span class="badge">${inv.paymentMode === "CASH" ? "نقدي" : "آجل"}</span>
            <div class="sub mono">القيد: ${escapePrintHtml(inv.id)} | فاتورة المورد: ${escapePrintHtml(inv.supplierInvoiceNumber || "—")}${inv.purchaseOrderId ? ` | أمر الشراء: ${escapePrintHtml(inv.purchaseOrderId)}` : ""}</div>
          </div>
          <div style="text-align:left;">
            <div class="mono bold">الإجمالي: ${inv.totalAmount.toFixed(2)} ر.س | البونص: ${inv.totalBonusValue.toFixed(2)} ر.س</div>
            <div class="sub mono">${escapePrintHtml(new Date(inv.createdAt).toLocaleString("ar-SA"))}</div>
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
  <title>تقرير فواتير الشراء - ${escapePrintHtml(pharmacyName)}</title>
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
      <div class="title">${escapePrintHtml(pharmacyName)}</div>
      <div class="sub">هاتف: <span class="mono">${escapePrintHtml(pharmacyPhone || "")}</span></div>
    </div>
    <div style="text-align:left;">
      <div class="bold" style="font-size:14px;">تقرير فواتير الشراء والبونص التفصيلي</div>
      <div class="sub">تاريخ الطباعة: <span class="mono">${escapePrintHtml(today)}</span></div>
      ${supplierFilter !== "ALL" ? `<div class="sub">المستودع: ${escapePrintHtml(supplierFilter)}</div>` : ""}
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

  printHtmlDocument(html);
};
