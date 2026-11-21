import React, { useMemo, useState } from "react";
import { PurchaseInvoiceEntity } from "../../../domain/entities";
import { usePosStore } from "../../../application/store/usePosStore";
import {
  FileText,
  Search,
  Printer,
  FileSpreadsheet,
  ChevronDown,
  ChevronLeft,
  ChevronsUpDown,
  ArrowUpDown,
  Banknote,
  CreditCard,
  Gift,
  Package,
  Calendar,
  RotateCcw,
  Building2,
} from "lucide-react";

interface Props {
  purchaseInvoices: PurchaseInvoiceEntity[];
}

type PaymentFilter = "ALL" | "CASH" | "CREDIT";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const csvCell = (value: string | number): string =>
  `"${String(value).replace(/"/g, '""')}"`;

/**
 * تبويب تقارير وسجل فواتير الشراء والبونص بجدول كامل العرض
 * يعرض كافة تفاصيل الفواتير والبنود المشتراة والتكلفة المرجحة قبل/بعد البونص
 */
export const PurchaseReportsTab: React.FC<Props> = ({ purchaseInvoices }) => {
  const settings = usePosStore((s) => s.settings);
  const suppliers = usePosStore((s) => s.suppliers);
  const setNotification = usePosStore((s) => s.setNotification);

  const [searchQuery, setSearchQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

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

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const matched = purchaseInvoices.filter((inv) => {
      if (
        supplierFilter !== "ALL" &&
        inv.supplierName.trim() !== supplierFilter
      ) {
        return false;
      }

      if (paymentFilter !== "ALL" && inv.paymentMode !== paymentFilter) {
        return false;
      }

      const invoiceDate = inv.createdAt.slice(0, 10);
      if (fromDate && invoiceDate < fromDate) return false;
      if (toDate && invoiceDate > toDate) return false;

      if (!q) return true;

      const matchesHeader =
        inv.id.toLowerCase().includes(q) ||
        (inv.supplierInvoiceNumber || "").toLowerCase().includes(q) ||
        inv.supplierName.toLowerCase().includes(q);

      if (matchesHeader) return true;

      return inv.items.some(
        (item) =>
          item.productName.toLowerCase().includes(q) ||
          item.barcode.toLowerCase().includes(q) ||
          item.batchNumber.toLowerCase().includes(q),
      );
    });

    return matched.sort((a, b) =>
      newestFirst
        ? b.createdAt.localeCompare(a.createdAt)
        : a.createdAt.localeCompare(b.createdAt),
    );
  }, [
    purchaseInvoices,
    searchQuery,
    supplierFilter,
    paymentFilter,
    fromDate,
    toDate,
    newestFirst,
  ]);

  // إحصائيات الملخص المالي والمخزني للفواتير المطابقة
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
    Boolean(fromDate) ||
    Boolean(toDate);

  const handleResetFilters = () => {
    setSearchQuery("");
    setSupplierFilter("ALL");
    setPaymentFilter("ALL");
    setFromDate("");
    setToDate("");
  };

  const allExpanded =
    filteredInvoices.length > 0 &&
    filteredInvoices.every((inv) => Boolean(expandedIds[inv.id]));

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
    filteredInvoices.forEach((inv) => {
      next[inv.id] = true;
    });
    setExpandedIds(next);
  };

  // تصدير تفصيلي لملف CSV متوافق مع Excel بترميز عربي (UTF-8 BOM) يشمل كافة حقول الفواتير والبنود
  const handleExportCsv = () => {
    if (filteredInvoices.length === 0) return;

    const headers = [
      "رقم القيد الداخلي",
      "تاريخ ووقت الإدخال",
      "اسم المستودع / المورد",
      "رقم فاتورة المورد",
      "طريقة الدفع",
      "إجمالي الفاتورة",
      "إجمالي قيمة البونص",
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
    ];

    const rows: string[] = [];
    filteredInvoices.forEach((inv) => {
      const paymentLabel = inv.paymentMode === "CASH" ? "نقدي" : "آجل";
      const dateStr = inv.createdAt.slice(0, 16).replace("T", " ");

      if (inv.items.length === 0) {
        rows.push(
          [
            csvCell(inv.id),
            csvCell(dateStr),
            csvCell(inv.supplierName),
            csvCell(inv.supplierInvoiceNumber || "—"),
            csvCell(paymentLabel),
            inv.totalAmount.toFixed(2),
            inv.totalBonusValue.toFixed(2),
            csvCell("—"),
            csvCell("—"),
            csvCell("—"),
            csvCell("—"),
            0,
            0,
            "0.00",
            0,
            "0.00",
            "0.00",
            "0.00",
            "0.00",
          ].join(","),
        );
        return;
      }

      inv.items.forEach((item) => {
        rows.push(
          [
            csvCell(inv.id),
            csvCell(dateStr),
            csvCell(inv.supplierName),
            csvCell(inv.supplierInvoiceNumber || "—"),
            csvCell(paymentLabel),
            inv.totalAmount.toFixed(2),
            inv.totalBonusValue.toFixed(2),
            csvCell(item.productName),
            csvCell(item.barcode),
            csvCell(item.batchNumber),
            csvCell(item.expiryDate),
            item.purchasedPacks,
            item.bonusPacks,
            item.purchasePricePerPack.toFixed(2),
            item.previousStockPacks,
            item.previousWeightedCost.toFixed(2),
            item.newWeightedCost.toFixed(2),
            item.newPackSalePrice > 0
              ? item.newPackSalePrice.toFixed(2)
              : csvCell("بدون تغيير"),
            item.lineTotal.toFixed(2),
          ].join(","),
        );
      });
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const datePart = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `Purchase_Invoices_Report_${datePart}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

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
            <div class="sub mono">القيد: ${escapeHtml(inv.id)} | فاتورة المورد: ${escapeHtml(inv.supplierInvoiceNumber || "—")}</div>
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

      {/* الحاوية الرئيسية للجدول والفلاتر */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5">
        {/* صف البحث والفلترة */}
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم القيد، فاتورة المورد، المستودع، اسم/باركود الدواء، أو رقم التشغيلة..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pr-9 pl-3 py-2 text-white outline-none"
            />
          </div>

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

          {/* فلتر طريقة الدفع */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(
              [
                { id: "ALL", label: "الكل" },
                { id: "CASH", label: "نقدي" },
                { id: "CREDIT", label: "آجل" },
              ] as const
            ).map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setPaymentFilter(pill.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  paymentFilter === pill.id
                    ? pill.id === "CASH"
                      ? "bg-sky-600 text-white"
                      : pill.id === "CREDIT"
                        ? "bg-amber-600 text-white"
                        : "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* صف نطاق التاريخ + أدوات التوسيع والتصدير والطباعة */}
        <div className="flex items-center justify-between gap-2.5 flex-wrap border-t border-slate-800/80 pt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px]">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">من:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-transparent text-white font-mono outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px]">
              <span className="text-slate-400">إلى:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-transparent text-white font-mono outline-none"
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white font-bold text-[11px] inline-flex items-center gap-1 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> إعادة ضبط الفلاتر
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {filteredInvoices.length > 0 && (
              <button
                type="button"
                onClick={handleToggleExpandAll}
                className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-[11px] inline-flex items-center gap-1.5 transition"
              >
                <ChevronsUpDown className="w-3.5 h-3.5 text-indigo-400" />
                {allExpanded ? "طي كل الأصناف" : "توسيع كل الأصناف"}
              </button>
            )}

            <button
              type="button"
              onClick={() => setNewestFirst((prev) => !prev)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-[11px] inline-flex items-center gap-1.5 transition"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-sky-400" />
              {newestFirst ? "الأحدث أولاً" : "الأقدم أولاً"}
            </button>

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
          </div>
        </div>

        {/* جدول تقارير فواتير الشراء الكامل */}
        {purchaseInvoices.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-500 text-center gap-2">
            <FileText className="w-10 h-10 text-slate-700 stroke-1" />
            <p className="font-bold text-slate-400">
              لا توجد فواتير مشتريات مسجلة في النظام حتى الآن
            </p>
            <p className="text-[11px]">
              عند اعتماد أي فاتورة شراء من تبويب «إدخال فاتورة شراء وبونص» ستظهر
              هنا بكامل تفاصيلها وبنودها.
            </p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="py-14 text-center text-slate-500">
            لا توجد فواتير مشتريات مطابقة لخيارات البحث أو الفلترة الحالية.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">رقم القيد والتاريخ</th>
                  <th className="py-2.5 px-3">فاتورة المورد</th>
                  <th className="py-2.5 px-3">المستودع / المورد</th>
                  <th className="py-2.5 px-3 text-center">طريقة الدفع</th>
                  <th className="py-2.5 px-3 text-center">الأصناف والعلب</th>
                  <th className="py-2.5 px-3 text-center">قيمة البونص</th>
                  <th className="py-2.5 px-3 text-center">الإجمالي النهائي</th>
                  <th className="py-2.5 px-3 text-left">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredInvoices.map((inv) => {
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
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            ) : (
                              <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <span className="font-mono font-bold text-indigo-300">
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

                        <td className="py-3 px-3 font-mono text-slate-200 font-bold">
                          {inv.supplierInvoiceNumber || "—"}
                        </td>

                        <td className="py-3 px-3 font-bold text-white">
                          {inv.supplierName}
                        </td>

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

                        <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400">
                          {inv.totalBonusValue > 0
                            ? `+${inv.totalBonusValue.toFixed(2)} ر.س`
                            : "0.00"}
                        </td>

                        <td className="py-3 px-3 text-center font-mono font-extrabold text-sm text-white">
                          {inv.totalAmount.toFixed(2)} ر.س
                        </td>

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
                          <td colSpan={8} className="p-3">
                            <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
                              <div className="px-3 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                                  <Package className="w-3.5 h-3.5 text-indigo-400" />
                                  تفاصيل بنود فاتورة الشراء ({inv.id}) —
                                  المستودع: {inv.supplierName}
                                </span>
                                <span className="font-mono text-slate-400 text-[10.5px]">
                                  الفرع: {inv.branchId} • فاتورة المورد:{" "}
                                  {inv.supplierInvoiceNumber || "غير مدخلة"}
                                </span>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-right text-[11px]">
                                  <thead>
                                    <tr className="border-b border-slate-800/80 text-slate-400 text-[10px]">
                                      <th className="py-2 px-3">
                                        الصنف والباركود
                                      </th>
                                      <th className="py-2 px-2">
                                        التشغيلة والصلاحية
                                      </th>
                                      <th className="py-2 px-2 text-center">
                                        المشترى
                                      </th>
                                      <th className="py-2 px-2 text-center">
                                        + بونص
                                      </th>
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
                                          <div>
                                            {item.previousStockPacks} علبة
                                          </div>
                                          <div className="text-[10px]">
                                            {item.previousWeightedCost.toFixed(
                                              2,
                                            )}{" "}
                                            ر.س
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
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
