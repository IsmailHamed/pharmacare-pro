import { buildBarcodeSvgMarkup } from "./barcodeSvg";
import { escapePrintHtml } from "./printRunner";
import { ThermalLabelRenderInput } from "./types";

/**
 * توليد مستند HTML معزول لطباعة الملصقات الحرارية بمقاس الملليمتر الدقيق
 */
export function buildThermalLabelHtml(input: ThermalLabelRenderInput): string {
  const {
    pharmacyName,
    productName,
    unitLabel,
    barcodeValue,
    barcodePatternSource,
    priceText,
    expiryDate,
    dosageText,
    copies,
    config,
  } = input;

  const safeCopies = Math.max(1, Math.min(50, Math.round(copies)));
  const widthMm = Math.max(20, Math.min(100, config.widthMm));
  const heightMm = Math.max(15, Math.min(80, config.heightMm));
  const marginMm = Math.max(0.5, Math.min(6, config.marginMm));
  const scale = Math.max(0.8, Math.min(1.3, config.fontScale));
  const barcodeHeightMm = Math.max(5.5, Math.min(12, heightMm * 0.28));

  const svgMarkup = buildBarcodeSvgMarkup(barcodePatternSource);

  const labelMarkup = `
    <div class="label-page">
      ${
        config.showPharmacyName
          ? `<div class="header-row">
              <span class="pharmacy">${escapePrintHtml(pharmacyName)}</span>
              <span class="unit">${escapePrintHtml(unitLabel)}</span>
            </div>`
          : ""
      }
      <div class="product-name">${escapePrintHtml(productName)}</div>
      <div class="barcode-wrap">${svgMarkup}</div>
      ${
        config.showBarcodeNumber
          ? `<div class="barcode-text">${escapePrintHtml(barcodeValue)}</div>`
          : ""
      }
      ${
        config.showDosageLine && dosageText?.trim()
          ? `<div class="dosage-line">${escapePrintHtml(dosageText.trim())}</div>`
          : ""
      }
      ${
        config.showPrice || (config.showExpiry && expiryDate)
          ? `<div class="footer-row">
              <span>${config.showPrice ? escapePrintHtml(priceText) : ""}</span>
              <span class="exp">${
                config.showExpiry && expiryDate
                  ? `EXP: ${escapePrintHtml(expiryDate)}`
                  : ""
              }</span>
            </div>`
          : ""
      }
    </div>
  `;

  const pagesHtml = Array.from({ length: safeCopies })
    .map(() => labelMarkup)
    .join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>طباعة ملصق باركود - ${escapePrintHtml(productName)}</title>
  <style>
    @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${widthMm}mm;
      background: #ffffff;
      color: #000000;
      font-family: "Tahoma", "Segoe UI", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label-page {
      width: ${widthMm}mm;
      height: ${heightMm}mm;
      padding: ${marginMm}mm;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      page-break-after: always;
      break-after: page;
    }
    .label-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .header-row {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: ${(6.5 * scale).toFixed(2)}pt;
      font-weight: 700;
      border-bottom: 0.3mm solid #444;
      padding-bottom: 0.4mm;
      gap: 1mm;
    }
    .pharmacy {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .unit { flex-shrink: 0; }
    .product-name {
      width: 100%;
      text-align: center;
      font-weight: 800;
      font-size: ${(7.8 * scale).toFixed(2)}pt;
      line-height: 1.15;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .barcode-wrap {
      width: 100%;
      height: ${barcodeHeightMm.toFixed(1)}mm;
      display: flex;
      align-items: center;
    }
    .barcode-svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    .barcode-text {
      font-family: "Consolas", monospace;
      font-size: ${(6.4 * scale).toFixed(2)}pt;
      font-weight: 700;
      letter-spacing: 0.3mm;
      line-height: 1;
    }
    .dosage-line {
      width: 100%;
      text-align: center;
      font-size: ${(6.2 * scale).toFixed(2)}pt;
      font-weight: 700;
      border: 0.25mm solid #555;
      border-radius: 0.8mm;
      padding: 0.4mm 1mm;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .footer-row {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: ${(6.6 * scale).toFixed(2)}pt;
      font-weight: 700;
      border-top: 0.25mm dashed #555;
      padding-top: 0.4mm;
      gap: 1mm;
    }
    .exp {
      font-family: "Consolas", monospace;
      font-size: ${(6 * scale).toFixed(2)}pt;
    }
  </style>
</head>
<body>${pagesHtml}</body>
</html>`;
}
