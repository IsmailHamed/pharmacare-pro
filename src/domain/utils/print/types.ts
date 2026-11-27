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
