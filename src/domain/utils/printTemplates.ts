export * from "./print";
export type ThermalLabelPresetId =
  | "38x25"
  | "40x30"
  | "50x25"
  | "58x40"
  | "custom";

export type ReceiptPaperWidth = 58 | 80;

export interface ThermalLabelConfig {
  preset: ThermalLabelPresetId;
  widthMm: number;
  heightMm: number;
  marginMm: number;
  fontScale: number; // 0.85 إلى 1.25
  showPharmacyName: boolean;
  showPrice: boolean;
  showExpiry: boolean;
  showDosageLine: boolean;
  showBarcodeNumber: boolean;
}

export interface ThermalReceiptConfig {
  paperWidthMm: ReceiptPaperWidth;
  marginMm: number;
  fontScale: number;
  showPharmacyHeader: boolean;
  showPhone: boolean;
  showCashierName: boolean;
  showItemDiscount: boolean;
  showBarcodeOnItems: boolean;
}

export interface PrintPreferences {
  label: ThermalLabelConfig;
  receipt: ThermalReceiptConfig;
  autoPreviewBeforePrint: boolean;
}

export const LABEL_SIZE_PRESETS: Record<
  Exclude<ThermalLabelPresetId, "custom">,
  { label: string; widthMm: number; heightMm: number }
> = {
  "38x25": { label: "ملصق صغير (38 × 25 مم)", widthMm: 38, heightMm: 25 },
  "40x30": { label: "ملصق قياسي (40 × 30 مم)", widthMm: 40, heightMm: 30 },
  "50x25": { label: "ملصق عريض (50 × 25 مم)", widthMm: 50, heightMm: 25 },
  "58x40": { label: "ملصق جرعات كبير (58 × 40 مم)", widthMm: 58, heightMm: 40 },
};

export const DEFAULT_PRINT_PREFERENCES: PrintPreferences = {
  label: {
    preset: "38x25",
    widthMm: 38,
    heightMm: 25,
    marginMm: 1.5,
    fontScale: 1,
    showPharmacyName: true,
    showPrice: true,
    showExpiry: true,
    showDosageLine: false,
    showBarcodeNumber: true,
  },
  receipt: {
    paperWidthMm: 80,
    marginMm: 3,
    fontScale: 1,
    showPharmacyHeader: true,
    showPhone: true,
    showCashierName: true,
    showItemDiscount: true,
    showBarcodeOnItems: false,
  },
  autoPreviewBeforePrint: true,
};

const PRINT_PREFS_STORAGE_KEY = "pharmacare_print_preferences_v1";

export const escapePrintHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function loadPrintPreferences(): PrintPreferences {
  try {
    const raw = window.localStorage.getItem(PRINT_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PRINT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<PrintPreferences>;
    return {
      label: { ...DEFAULT_PRINT_PREFERENCES.label, ...(parsed.label || {}) },
      receipt: {
        paperWidthMm:
          parsed.receipt?.paperWidthMm ??
          DEFAULT_PRINT_PREFERENCES.receipt.paperWidthMm,
        marginMm:
          parsed.receipt?.marginMm ??
          DEFAULT_PRINT_PREFERENCES.receipt.marginMm,
        fontScale:
          parsed.receipt?.fontScale ??
          DEFAULT_PRINT_PREFERENCES.receipt.fontScale,
        showPharmacyHeader:
          parsed.receipt?.showPharmacyHeader ??
          DEFAULT_PRINT_PREFERENCES.receipt.showPharmacyHeader,
        showPhone:
          parsed.receipt?.showPhone ??
          DEFAULT_PRINT_PREFERENCES.receipt.showPhone,
        showCashierName:
          parsed.receipt?.showCashierName ??
          DEFAULT_PRINT_PREFERENCES.receipt.showCashierName,
        showItemDiscount:
          parsed.receipt?.showItemDiscount ??
          DEFAULT_PRINT_PREFERENCES.receipt.showItemDiscount,
        showBarcodeOnItems:
          parsed.receipt?.showBarcodeOnItems ??
          DEFAULT_PRINT_PREFERENCES.receipt.showBarcodeOnItems,
      },
      autoPreviewBeforePrint:
        parsed.autoPreviewBeforePrint ??
        DEFAULT_PRINT_PREFERENCES.autoPreviewBeforePrint,
    };
  } catch {
    return DEFAULT_PRINT_PREFERENCES;
  }
}

export function savePrintPreferences(prefs: PrintPreferences): void {
  try {
    window.localStorage.setItem(PRINT_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // تجاهل أخطاء التخزين في الوضع المقيد
  }
}

/**
 * مولد أنماط خطوط الباركود (Code-128 Style Bars) بصيغة SVG عالية الدقة للطابعات الحرارية
 */
export const generateBarcodePattern = (code: string): number[] => {
  const clean = code.trim() || "628100000000";
  const bars: number[] = [2, 1, 1, 2, 1, 2]; // Start Guard
  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    bars.push(((charCode >> 0) & 1) + 1);
    bars.push(((charCode >> 1) & 1) + 1);
    bars.push(((charCode >> 2) & 1) + 1);
    bars.push(((charCode >> 3) & 1) + 1);
  }
  bars.push(2, 1, 2, 1, 1, 2); // Stop Guard
  return bars;
};

export const buildBarcodeSvgMarkup = (code: string): string => {
  const pattern = generateBarcodePattern(code);
  const totalWidth = pattern.reduce((acc, w) => acc + w, 0);
  let currentX = 0;
  const rects: string[] = [];

  pattern.forEach((width, index) => {
    const x = currentX;
    currentX += width;
    if (index % 2 === 0) {
      rects.push(
        `<rect x="${x}" y="0" width="${width}" height="36" fill="#000000" />`,
      );
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} 36" preserveAspectRatio="none" class="barcode-svg">${rects.join("")}</svg>`;
};

export interface ThermalLabelRenderInput {
  pharmacyName: string;
  productName: string;
  unitLabel: string;
  barcodeValue: string;
  barcodePatternSource: string;
  priceText: string;
  expiryDate?: string;
  dosageText?: string;
  copies: number;
  config: ThermalLabelConfig;
}

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

export interface ReceiptPrintItemInput {
  name: string;
  unitLabel: string;
  barcode?: string;
  qty: number;
  unitPrice: number;
}

export interface InvoiceReceiptRenderInput {
  invoiceId: string;
  createdAt: string;
  customerName: string;
  typeLabel: string;
  paymentLabel: string;
  pharmacyName: string;
  address?: string;
  phone?: string;
  taxNumber?: string;
  cashierName?: string;
  items: ReceiptPrintItemInput[];
  subtotal: number;
  discountPercent: number;
  totalAmount: number;
  footerText?: string;
  config: ThermalReceiptConfig;
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

export interface DosageLabelItemInput {
  productName: string;
  unitLabel: string;
  dosageText: string;
  expiryDate?: string;
}

export interface DosageLabelsRenderInput {
  pharmacyName: string;
  pharmacyPhone?: string;
  customerName: string;
  dateText: string;
  items: DosageLabelItemInput[];
  config: ThermalLabelConfig;
}

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

/**
 * طباعة وثيقة HTML جاهزة عبر iframe مخفي يحترم قاعدة @page بالمقاس الدقيق بالملليمتر
 */
export function printHtmlDocument(html: string): void {
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
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 120);
  } else {
    document.body.removeChild(iframe);
    window.print();
  }
}
