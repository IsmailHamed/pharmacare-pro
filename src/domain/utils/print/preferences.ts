import { DEFAULT_PRINT_PREFERENCES, PrintPreferences } from "./types";

const PRINT_PREFS_STORAGE_KEY = "pharmacare_print_preferences_v1";

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
