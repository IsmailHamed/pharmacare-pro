import { buildBarcodeSvgMarkup } from "./barcodeSvg";
import { escapePrintHtml } from "./printRunner";
import { InvoiceReceiptRenderInput, ThermalReceiptConfig } from "./types";

/**
 * توليد فاتورة تجريبية لطباعة الاختبار من شاشة الإعدادات بمقاس 58mm أو 80mm
 */
export function buildSampleReceiptHtml(params: {
  pharmacyName: string;
  phone: string;
  cashierName: string;
  footerText?: string;
  config: ThermalReceiptConfig;
}): string {
  const { pharmacyName, phone, cashierName, footerText, config } = params;
  const widthMm = config.paperWidthMm;
  const marginMm = Math.max(1, Math.min(8, config.marginMm));
  const scale = Math.max(0.85, Math.min(1.25, config.fontScale));

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>اختبار قالب الفاتورة (${widthMm}mm)</title>
  <style>
    @page { size: ${widthMm}mm auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: ${widthMm}mm;
      padding: ${marginMm}mm;
      background: #fff;
      color: #000;
      font-family: "Tahoma", "Segoe UI", Arial, sans-serif;
      font-size: ${(8.5 * scale).toFixed(2)}pt;
      line-height: 1.4;
    }
    .center { text-align: center; }
    .mono { font-family: "Consolas", monospace; }
    .bold { font-weight: 700; }
    .sep { border-top: 0.3mm dashed #333; margin: 2mm 0; }
    .row { display: flex; justify-content: space-between; gap: 2mm; }
    .sub { font-size: ${(7.2 * scale).toFixed(2)}pt; color: #333; }
    table { width: 100%; border-collapse: collapse; margin: 1.5mm 0; }
    th, td { padding: 0.8mm 0; text-align: right; font-size: ${(7.6 * scale).toFixed(2)}pt; }
    th { border-bottom: 0.3mm solid #000; }
    .num { text-align: center; font-family: "Consolas", monospace; }
    .left { text-align: left; font-family: "Consolas", monospace; }
  </style>
</head>
<body>
  ${
    config.showPharmacyHeader
      ? `<div class="center bold" style="font-size:${(10.5 * scale).toFixed(2)}pt;">${escapePrintHtml(pharmacyName)}</div>`
      : ""
  }
  ${
    config.showPhone && phone
      ? `<div class="center sub mono">هاتف: ${escapePrintHtml(phone)}</div>`
      : ""
  }
  <div class="sep"></div>
  <div class="row sub">
    <span>رقم الفاتورة: <b class="mono">INV-TEST-001</b></span>
    <span class="mono">${new Date().toLocaleDateString("ar-SA")}</span>
  </div>
  ${
    config.showCashierName
      ? `<div class="sub">الصيدلي: ${escapePrintHtml(cashierName)}</div>`
      : ""
  }
  <div class="sep"></div>
  <table>
    <thead>
      <tr>
        <th>الصنف</th>
        <th class="num">الكمية</th>
        <th class="left">الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          Panadol Extra 500mg
          ${config.showBarcodeOnItems ? `<div class="sub mono">628100000101</div>` : ""}
        </td>
        <td class="num">2</td>
        <td class="left">32.00</td>
      </tr>
      <tr>
        <td>
          Augmentin 1g
          ${config.showBarcodeOnItems ? `<div class="sub mono">628100000205</div>` : ""}
        </td>
        <td class="num">1</td>
        <td class="left">68.00</td>
      </tr>
    </tbody>
  </table>
  <div class="sep"></div>
  ${
    config.showItemDiscount
      ? `<div class="row sub"><span>الخصم (5%):</span><span class="mono">-5.00 ر.س</span></div>`
      : ""
  }
  <div class="row bold" style="font-size:${(9.8 * scale).toFixed(2)}pt;">
    <span>الصافي للدفع:</span>
    <span class="mono">95.00 ر.س</span>
  </div>
  ${
    footerText?.trim()
      ? `<div class="sep"></div><div class="center sub">${escapePrintHtml(footerText.trim())}</div>`
      : ""
  }
</body>
</html>`;
}

/**
 * توليد مستند HTML معزول لطباعة فاتورة نقطة البيع بالمقاس الدقيق (58mm أو 80mm) مع باركود المرتجع
 */
export function buildInvoiceReceiptHtml(
  input: InvoiceReceiptRenderInput,
): string {
  const { config } = input;
  const widthMm = config.paperWidthMm;
  const marginMm = Math.max(1, Math.min(8, config.marginMm));
  const scale = Math.max(0.85, Math.min(1.25, config.fontScale));
  const discountValue = (input.subtotal * input.discountPercent) / 100;
  const invoiceBarcodeSvg = buildBarcodeSvgMarkup(input.invoiceId);

  const itemsHtml = input.items
    .map(
      (item) => `
      <div class="item-row">
        <div class="item-name">${escapePrintHtml(item.name)} (${escapePrintHtml(item.unitLabel)})</div>
        ${
          config.showBarcodeOnItems && item.barcode
            ? `<div class="sub mono">${escapePrintHtml(item.barcode)}</div>`
            : ""
        }
        <div class="row mono">
          <span>${item.qty} × ${item.unitPrice.toFixed(2)}</span>
          <b>${(item.qty * item.unitPrice).toFixed(2)}</b>
        </div>
      </div>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>إيصال ${escapePrintHtml(input.invoiceId)}</title>
  <style>
    @page { size: ${widthMm}mm auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: ${widthMm}mm;
      padding: ${marginMm}mm;
      background: #ffffff;
      color: #000000;
      font-family: "Tahoma", "Segoe UI", Arial, sans-serif;
      font-size: ${(8.2 * scale).toFixed(2)}pt;
      line-height: 1.38;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .center { text-align: center; }
    .mono { font-family: "Consolas", monospace; }
    .bold { font-weight: 700; }
    .sub { font-size: ${(7 * scale).toFixed(2)}pt; color: #333; }
    .sep { border-top: 0.3mm dashed #444; margin: 2mm 0; }
    .row { display: flex; justify-content: space-between; align-items: baseline; gap: 2mm; }
    .item-row { margin-bottom: 1.5mm; }
    .item-name { font-weight: 700; font-size: ${(7.8 * scale).toFixed(2)}pt; }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-weight: 800;
      font-size: ${(9.6 * scale).toFixed(2)}pt;
      border-top: 0.35mm solid #000;
      padding-top: 1.2mm;
      margin-top: 1.2mm;
    }
    .barcode-box { margin-top: 1.5mm; text-align: center; }
    .barcode-svg { width: 85%; height: 7.5mm; margin: 0 auto; display: block; }
  </style>
</head>
<body>
  ${
    config.showPharmacyHeader
      ? `<div class="center bold" style="font-size:${(10.2 * scale).toFixed(2)}pt;">${escapePrintHtml(input.pharmacyName)}</div>`
      : ""
  }
  ${
    config.showPhone && input.address
      ? `<div class="center sub">${escapePrintHtml(input.address)}</div>`
      : ""
  }
  ${
    config.showPhone && input.phone
      ? `<div class="center sub mono">هاتف: ${escapePrintHtml(input.phone)}</div>`
      : ""
  }
  ${
    config.showPharmacyHeader && input.taxNumber
      ? `<div class="center sub mono">الرقم الضريبي: ${escapePrintHtml(input.taxNumber)}</div>`
      : ""
  }

  <div class="sep"></div>

  <div class="sub">
    <div class="row"><span>رقم الفاتورة:</span><b class="mono">${escapePrintHtml(input.invoiceId)}</b></div>
    <div class="row"><span>التاريخ:</span><span class="mono">${escapePrintHtml(new Date(input.createdAt).toLocaleString("ar-SA"))}</span></div>
    <div class="row"><span>العميل:</span><b>${escapePrintHtml(input.customerName)}</b></div>
    ${
      config.showCashierName && input.cashierName
        ? `<div class="row"><span>الصيدلي:</span><b>${escapePrintHtml(input.cashierName)}</b></div>`
        : ""
    }
    <div class="row"><span>النوع / الدفع:</span><b>${escapePrintHtml(input.typeLabel)} (${escapePrintHtml(input.paymentLabel)})</b></div>
  </div>

  <div class="sep"></div>
  <div>${itemsHtml}</div>
  <div class="sep"></div>

  <div>
    <div class="row"><span>الإجمالي قبل الخصم:</span><span class="mono">${input.subtotal.toFixed(2)}</span></div>
    ${
      config.showItemDiscount && input.discountPercent > 0
        ? `<div class="row sub"><span>الخصم (${input.discountPercent}%):</span><span class="mono">-${discountValue.toFixed(2)}</span></div>`
        : ""
    }
    <div class="total-row">
      <span>الصافي النهائي:</span>
      <span class="mono">${input.totalAmount.toFixed(2)} ر.س</span>
    </div>
  </div>

  <div class="sep"></div>
  <div class="barcode-box">
    ${invoiceBarcodeSvg}
    <div class="mono bold" style="font-size:${(7.2 * scale).toFixed(2)}pt;letter-spacing:0.4mm;margin-top:0.6mm;">*${escapePrintHtml(input.invoiceId)}*</div>
    ${
      input.footerText?.trim()
        ? `<div class="sub" style="margin-top:1.2mm;">${escapePrintHtml(input.footerText.trim())}</div>`
        : ""
    }
  </div>
</body>
</html>`;
}
