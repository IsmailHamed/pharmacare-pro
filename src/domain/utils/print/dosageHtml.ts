import { escapePrintHtml } from "./printRunner";
import { DosageLabelsRenderInput } from "./types";

/**
 * توليد مستند HTML معزول لطباعة لصاقات الجرعات الحرارية بمقاس الملليمتر الدقيق دون صفحات فارغة
 */
export function buildDosageLabelsHtml(input: DosageLabelsRenderInput): string {
  const { config } = input;
  const widthMm = Math.max(30, Math.min(100, config.widthMm));
  const heightMm = Math.max(20, Math.min(80, config.heightMm));
  const marginMm = Math.max(1, Math.min(6, config.marginMm));
  const scale = Math.max(0.85, Math.min(1.25, config.fontScale));

  const pagesHtml = input.items
    .map(
      (item) => `
      <div class="dosage-page">
        <div class="top-row">
          <span class="pharmacy">${escapePrintHtml(input.pharmacyName)}</span>
          <span class="date mono">${escapePrintHtml(input.dateText)}</span>
        </div>
        <div class="patient-row">
          <span>المريض: <b>${escapePrintHtml(input.customerName)}</b></span>
          ${
            config.showExpiry && item.expiryDate
              ? `<span class="mono">EXP: ${escapePrintHtml(item.expiryDate)}</span>`
              : ""
          }
        </div>
        <div class="drug-name">${escapePrintHtml(item.productName)} <span class="unit">(${escapePrintHtml(item.unitLabel)})</span></div>
        <div class="dosage-box">${escapePrintHtml(item.dosageText)}</div>
        ${
          input.pharmacyPhone
            ? `<div class="bottom-row mono">هاتف الصيدلية: ${escapePrintHtml(input.pharmacyPhone)}</div>`
            : ""
        }
      </div>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>طباعة لصاقات الجرعات</title>
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
    .dosage-page {
      width: ${widthMm}mm;
      height: ${heightMm}mm;
      padding: ${marginMm}mm;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.8mm;
      page-break-after: always;
      break-after: page;
    }
    .dosage-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .mono { font-family: "Consolas", monospace; }
    .top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: ${(6.4 * scale).toFixed(2)}pt;
      font-weight: 700;
      border-bottom: 0.3mm solid #333;
      padding-bottom: 0.4mm;
      gap: 1mm;
    }
    .pharmacy { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .date { flex-shrink: 0; font-size: ${(5.8 * scale).toFixed(2)}pt; }
    .patient-row {
      display: flex;
      justify-content: space-between;
      font-size: ${(6 * scale).toFixed(2)}pt;
      gap: 1mm;
    }
    .drug-name {
      font-weight: 800;
      font-size: ${(7.6 * scale).toFixed(2)}pt;
      line-height: 1.15;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .unit { font-weight: 600; font-size: ${(6.2 * scale).toFixed(2)}pt; }
    .dosage-box {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      border: 0.3mm solid #222;
      border-radius: 1mm;
      padding: 0.8mm 1.2mm;
      font-weight: 700;
      font-size: ${(7.2 * scale).toFixed(2)}pt;
      line-height: 1.25;
      word-break: break-word;
    }
    .bottom-row {
      text-align: center;
      font-size: ${(5.6 * scale).toFixed(2)}pt;
      color: #333;
    }
  </style>
</head>
<body>${pagesHtml}</body>
</html>`;
}
