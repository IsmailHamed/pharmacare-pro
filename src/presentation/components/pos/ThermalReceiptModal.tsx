import React, { useCallback, useEffect, useRef, useState } from "react";
import { InvoiceEntity } from "../../../domain/entities/Invoice";
import { usePosStore } from "../../../application/store/usePosStore";
import { printThermalReceipt } from "../../../infrastructure/tauri/printer";
import {
  LABEL_SIZE_PRESETS,
  ThermalLabelConfig,
  ThermalLabelPresetId,
  ThermalReceiptConfig,
  buildDosageLabelsHtml,
  buildInvoiceReceiptHtml,
  loadPrintPreferences,
  printHtmlDocument,
  savePrintPreferences,
} from "../../../domain/utils/printTemplates";
import { ReceiptCustomizeBar } from "./receipt/ReceiptCustomizeBar";
import { ReceiptPreviewPane } from "./receipt/ReceiptPreviewPane";
import { DEFAULT_DOSAGE, DosageLabelsPane } from "./receipt/DosageLabelsPane";
import { Printer, Receipt, Tag, X, Zap } from "lucide-react";

interface Props {
  invoice: InvoiceEntity | null;
  onClose: () => void;
}

export const ThermalReceiptModal: React.FC<Props> = ({ invoice, onClose }) => {
  const { settings, currentUser, setNotification } = usePosStore();
  const [activeTab, setActiveTab] = useState<"RECEIPT" | "LABELS">("RECEIPT");
  const [dosageMap, setDosageMap] = useState<Record<string, string>>({});
  const [selectedLabelKeys, setSelectedLabelKeys] = useState<
    Record<string, boolean>
  >({});
  const [isPrinting, setIsPrinting] = useState(false);
  const [showQuickCustomize, setShowQuickCustomize] = useState(false);

  const [receiptConfig, setReceiptConfig] = useState<ThermalReceiptConfig>(
    () => loadPrintPreferences().receipt,
  );
  const [labelConfig, setLabelConfig] = useState<ThermalLabelConfig>(
    () => loadPrintPreferences().label,
  );

  // منع تكرار محاولة الطباعة الصامتة التلقائية لنفس الفاتورة
  const autoPrintedInvoiceIdRef = useRef<string | null>(null);

  // تهيئة إعدادات الطباعة وتحديد جميع الأصناف للجرعات عند فتح فاتورة جديدة
  useEffect(() => {
    if (!invoice) return;
    const savedPrefs = loadPrintPreferences();
    setReceiptConfig(savedPrefs.receipt);
    setLabelConfig(savedPrefs.label);
    setActiveTab("RECEIPT");
    setShowQuickCustomize(false);

    const initialSelection: Record<string, boolean> = {};
    invoice.items.forEach((item) => {
      initialSelection[item.cartKey] = true;
    });
    setSelectedLabelKeys(initialSelection);
  }, [invoice]);

  // إغلاق النافذة بزر Escape
  useEffect(() => {
    if (!invoice) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [invoice, onClose]);

  // تنفيذ الطباعة الصامتة التلقائية إذا أوقف المستخدم خيار "معاينة سريعة قبل الطباعة" من الإعدادات
  useEffect(() => {
    if (!invoice) return;
    if (autoPrintedInvoiceIdRef.current === invoice.id) return;

    const savedPrefs = loadPrintPreferences();
    if (savedPrefs.autoPreviewBeforePrint) return;

    autoPrintedInvoiceIdRef.current = invoice.id;
    let cancelled = false;

    void (async () => {
      setIsPrinting(true);
      const ok = await printThermalReceipt(invoice);
      if (cancelled) return;
      setIsPrinting(false);

      if (ok) {
        setNotification({
          type: "success",
          message: `تم إرسال الإيصال (${invoice.id}) بالطباعة الصامتة الفورية إلى الطابعة (${settings.thermalPrinterName}).`,
        });
        onClose();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [invoice, onClose, setNotification, settings.thermalPrinterName]);

  const updateReceiptConfig = (patch: Partial<ThermalReceiptConfig>) => {
    setReceiptConfig((prev) => {
      const next = { ...prev, ...patch };
      const allPrefs = loadPrintPreferences();
      savePrintPreferences({ ...allPrefs, receipt: next });
      return next;
    });
  };

  const handleSelectLabelPreset = (
    preset: Exclude<ThermalLabelPresetId, "custom">,
  ) => {
    const spec = LABEL_SIZE_PRESETS[preset];
    setLabelConfig((prev) => {
      const next: ThermalLabelConfig = {
        ...prev,
        preset,
        widthMm: spec.widthMm,
        heightMm: spec.heightMm,
      };
      const allPrefs = loadPrintPreferences();
      savePrintPreferences({ ...allPrefs, label: next });
      return next;
    });
  };

  const getDosageText = useCallback(
    (cartKey: string): string => dosageMap[cartKey] ?? DEFAULT_DOSAGE,
    [dosageMap],
  );

  if (!invoice) return null;

  // مصدر وحيد لنص تذييل الفاتورة من إعدادات هوية الصيدلية
  const resolvedFooter = settings.receiptFooter?.trim() || "";

  const selectedItemsForLabels = invoice.items.filter(
    (item) => selectedLabelKeys[item.cartKey] !== false,
  );

  // طباعة الإيصال بالمقاس المحدد (58mm أو 80mm) عبر قالب HTML معزول
  const handlePrintReceiptFormatted = () => {
    const html = buildInvoiceReceiptHtml({
      invoiceId: invoice.id,
      createdAt: invoice.createdAt,
      customerName: invoice.customerName || "عميل نقدي",
      typeLabel: invoice.type === "SALE" ? "مبيعات" : "مرتجع",
      paymentLabel: invoice.paymentMode === "CASH" ? "نقدي" : "آجل",
      pharmacyName: settings.pharmacyName,
      address: settings.address,
      phone: settings.phone,
      taxNumber: settings.taxNumber,
      cashierName: currentUser?.name,
      items: invoice.items.map((item) => ({
        name: item.product.name,
        unitLabel: item.unit === "pack" ? "علبة" : "شريط",
        barcode: item.product.barcode,
        qty: item.qty,
        unitPrice: item.unitPrice,
      })),
      subtotal: invoice.subtotal,
      discountPercent: invoice.discountPercent,
      totalAmount: invoice.totalAmount,
      footerText: resolvedFooter,
      config: receiptConfig,
    });
    printHtmlDocument(html);
  };

  // طباعة لصاقات الجرعات المحددة فقط بالمقاس الحراري المختار
  const handlePrintDosageLabels = () => {
    if (selectedItemsForLabels.length === 0) {
      setNotification({
        type: "warning",
        message: "حدد صنفاً واحداً على الأقل لطباعة لصاقة الجرعة.",
      });
      return;
    }

    const html = buildDosageLabelsHtml({
      pharmacyName: settings.pharmacyName,
      pharmacyPhone: settings.phone,
      customerName: invoice.customerName || "عميل نقدي",
      dateText: new Date(invoice.createdAt).toLocaleDateString("ar-SA"),
      items: selectedItemsForLabels.map((item) => ({
        productName: item.product.name,
        unitLabel: item.unit === "pack" ? "علبة" : "شريط",
        dosageText: getDosageText(item.cartKey),
        expiryDate: item.product.batches[0]?.expiryDate,
      })),
      config: labelConfig,
    });
    printHtmlDocument(html);
  };

  const handleSilentDirectPrint = async () => {
    setIsPrinting(true);
    const ok = await printThermalReceipt(invoice);
    setIsPrinting(false);

    if (ok) {
      setNotification({
        type: "success",
        message: `تم إرسال الإيصال (${invoice.id}) بالطباعة الصامتة الفورية إلى الطابعة (${settings.thermalPrinterName}).`,
      });
      onClose();
    } else {
      // الرجوع الآمن لطباعة القالب المعزول بمقاس 58mm/80mm بدلاً من طباعة كامل الشاشة
      handlePrintReceiptFormatted();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* شريط التبديل بين الفاتورة الحرارية ولصاقة الجرعات */}
        <div className="p-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between gap-2">
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab("RECEIPT")}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                activeTab === "RECEIPT"
                  ? "bg-emerald-600 text-white shadow"
                  : "bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              الإيصال الحراري ({receiptConfig.paperWidthMm}mm)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("LABELS")}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                activeTab === "LABELS"
                  ? "bg-sky-600 text-white shadow"
                  : "bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              لصاقات الجرعات ({selectedItemsForLabels.length}/
              {invoice.items.length})
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-900 p-1.5 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* شريط التخصيص السريع للمقاس قبل الطباعة الفعلية */}
        <ReceiptCustomizeBar
          activeTab={activeTab}
          receiptConfig={receiptConfig}
          labelConfig={labelConfig}
          showQuickCustomize={showQuickCustomize}
          onToggleQuickCustomize={() => setShowQuickCustomize((prev) => !prev)}
          onUpdateReceiptConfig={updateReceiptConfig}
          onSelectLabelPreset={handleSelectLabelPreset}
        />

        {/* محتوى المعاينة */}
        <div className="p-5 bg-slate-950 flex-1 overflow-y-auto scrollbar-auto-hide flex flex-col items-center">
          {activeTab === "RECEIPT" ? (
            <ReceiptPreviewPane
              invoice={invoice}
              receiptConfig={receiptConfig}
              pharmacyName={settings.pharmacyName}
              address={settings.address}
              phone={settings.phone}
              taxNumber={settings.taxNumber}
              cashierName={currentUser?.name}
              footerText={resolvedFooter}
            />
          ) : (
            <DosageLabelsPane
              invoice={invoice}
              pharmacyName={settings.pharmacyName}
              labelConfig={labelConfig}
              selectedLabelKeys={selectedLabelKeys}
              getDosageText={getDosageText}
              onToggleItemSelection={(cartKey, nextSelected) =>
                setSelectedLabelKeys((prev) => ({
                  ...prev,
                  [cartKey]: nextSelected,
                }))
              }
              onChangeDosage={(cartKey, text) =>
                setDosageMap((prev) => ({ ...prev, [cartKey]: text }))
              }
            />
          )}
        </div>

        {/* أزرار الطباعة الصامتة والمعزولة */}
        <div className="p-3.5 bg-slate-800 border-t border-slate-700 flex gap-2">
          {activeTab === "RECEIPT" ? (
            <button
              type="button"
              onClick={() => void handleSilentDirectPrint()}
              disabled={isPrinting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-lg transition"
            >
              <Zap className="w-4 h-4" />
              {isPrinting
                ? "جاري الإرسال للطابعة..."
                : `طباعة صامتة مباشرة (${settings.thermalPrinterName})`}
            </button>
          ) : (
            <button
              type="button"
              disabled={selectedItemsForLabels.length === 0}
              onClick={handlePrintDosageLabels}
              className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-lg transition"
            >
              <Printer className="w-4 h-4" />
              طباعة ({selectedItemsForLabels.length}) لصاقة جرعة (
              {labelConfig.widthMm}×{labelConfig.heightMm}mm)
            </button>
          )}

          <button
            type="button"
            onClick={
              activeTab === "RECEIPT"
                ? handlePrintReceiptFormatted
                : handlePrintDosageLabels
            }
            title={
              activeTab === "RECEIPT"
                ? `طباعة بالقالب المخصص (${receiptConfig.paperWidthMm}mm)`
                : "طباعة لصاقات الجرعات المحددة"
            }
            className="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl flex items-center gap-1 transition"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
