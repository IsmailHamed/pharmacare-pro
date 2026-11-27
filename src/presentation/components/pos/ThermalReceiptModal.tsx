import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { InvoiceEntity } from "../../../domain/entities/Invoice";
import { usePosStore } from "../../../application/store/usePosStore";
import { printThermalReceipt } from "../../../infrastructure/tauri/printer";
import {
  LABEL_SIZE_PRESETS,
  ReceiptPaperWidth,
  ThermalLabelConfig,
  ThermalLabelPresetId,
  ThermalReceiptConfig,
  buildDosageLabelsHtml,
  buildInvoiceReceiptHtml,
  generateBarcodePattern,
  loadPrintPreferences,
  printHtmlDocument,
  savePrintPreferences,
} from "../../../domain/utils/printTemplates";
import {
  Printer,
  X,
  Tag,
  Receipt,
  Zap,
  SlidersHorizontal,
  CheckSquare,
  Square,
} from "lucide-react";

interface Props {
  invoice: InvoiceEntity | null;
  onClose: () => void;
}

const DEFAULT_DOSAGE = "قرص واحد كل 8 ساعات بعد الأكل";

const QUICK_DOSAGE_PRESETS = [
  "قرص كل 8 ساعات بعد الأكل",
  "قرص كل 12 ساعة بعد الأكل",
  "قرص واحد يومياً مساءً",
  "عند اللزوم (كل 6 ساعات)",
];

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

  const invoiceBarcodePattern = useMemo(
    () => (invoice ? generateBarcodePattern(invoice.id) : []),
    [invoice],
  );

  const invoiceBarcodeWidth = useMemo(
    () => invoiceBarcodePattern.reduce((acc, w) => acc + w, 0),
    [invoiceBarcodePattern],
  );

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

  let barcodeX = 0;

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
        <div className="px-4 py-2.5 bg-slate-900/95 border-b border-slate-800 space-y-2.5">
          {activeTab === "RECEIPT" ? (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">عرض الرول:</span>
                  {([80, 58] as ReceiptPaperWidth[]).map((width) => (
                    <button
                      key={width}
                      type="button"
                      onClick={() =>
                        updateReceiptConfig({ paperWidthMm: width })
                      }
                      className={`px-2.5 py-1 rounded-lg font-mono font-bold text-[11px] border transition ${
                        receiptConfig.paperWidthMm === width
                          ? "bg-emerald-950/70 border-emerald-500 text-emerald-300"
                          : "bg-slate-950 border-slate-700 text-slate-400 hover:text-white"
                      }`}
                    >
                      {width}mm
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowQuickCustomize((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 transition ${
                    showQuickCustomize
                      ? "bg-sky-950/60 border-sky-500 text-sky-200"
                      : "bg-slate-950 border-slate-700 text-slate-300 hover:text-white"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  تخصيص القالب
                </button>
              </div>

              {showQuickCustomize && (
                <div className="pt-2 border-t border-slate-800 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">
                      حجم الخط ({Math.round(receiptConfig.fontScale * 100)}%)
                    </span>
                    <input
                      type="range"
                      min={0.85}
                      max={1.2}
                      step={0.05}
                      value={receiptConfig.fontScale}
                      onChange={(e) =>
                        updateReceiptConfig({
                          fontScale: Number(e.target.value),
                        })
                      }
                      className="w-40 accent-emerald-500 cursor-pointer"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-slate-300">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={receiptConfig.showPhone}
                        onChange={(e) =>
                          updateReceiptConfig({ showPhone: e.target.checked })
                        }
                        className="rounded accent-emerald-500"
                      />
                      العنوان والهاتف
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={receiptConfig.showCashierName}
                        onChange={(e) =>
                          updateReceiptConfig({
                            showCashierName: e.target.checked,
                          })
                        }
                        className="rounded accent-emerald-500"
                      />
                      اسم الصيدلي
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={receiptConfig.showBarcodeOnItems}
                        onChange={(e) =>
                          updateReceiptConfig({
                            showBarcodeOnItems: e.target.checked,
                          })
                        }
                        className="rounded accent-emerald-500"
                      />
                      باركود كل صنف
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={receiptConfig.showItemDiscount}
                        onChange={(e) =>
                          updateReceiptConfig({
                            showItemDiscount: e.target.checked,
                          })
                        }
                        className="rounded accent-emerald-500"
                      />
                      سطر الخصم
                    </label>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400">مقاس الملصق:</span>
                {(["58x40", "40x30", "50x25", "38x25"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectLabelPreset(key)}
                    className={`px-2 py-1 rounded-lg font-mono font-bold text-[10.5px] border transition ${
                      labelConfig.preset === key
                        ? "bg-sky-950/70 border-sky-500 text-sky-200"
                        : "bg-slate-950 border-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    {key}mm
                  </button>
                ))}
              </div>
              <span className="text-[10.5px] text-slate-400">
                اختر الأصناف التي تحتاج لصاقة جرعة فقط
              </span>
            </div>
          )}
        </div>

        {/* محتوى المعاينة */}
        <div className="p-5 bg-slate-950 flex-1 overflow-y-auto scrollbar-auto-hide flex flex-col items-center">
          {activeTab === "RECEIPT" ? (
            <div
              style={{
                width: `${receiptConfig.paperWidthMm}mm`,
                padding: `${receiptConfig.marginMm}mm`,
                fontSize: `${(8.2 * receiptConfig.fontScale).toFixed(2)}pt`,
              }}
              className="bg-white text-slate-950 rounded shadow-xl font-mono space-y-2 transition-all"
            >
              {receiptConfig.showPharmacyHeader && (
                <div className="text-center border-b border-dashed border-slate-400 pb-2">
                  <div className="font-extrabold text-[1.2em] font-sans">
                    {settings.pharmacyName}
                  </div>
                  {receiptConfig.showPhone && settings.address && (
                    <div className="text-[0.88em] font-sans text-slate-600">
                      {settings.address}
                    </div>
                  )}
                  {receiptConfig.showPhone && settings.phone && (
                    <div className="text-[0.88em]">هاتف: {settings.phone}</div>
                  )}
                  {settings.taxNumber && (
                    <div className="text-[0.88em]">
                      الرقم الضريبي: {settings.taxNumber}
                    </div>
                  )}
                </div>
              )}

              <div className="text-[0.9em] space-y-0.5 border-b border-dashed border-slate-400 pb-2 font-sans">
                <div className="flex justify-between gap-2">
                  <span>رقم الفاتورة:</span>
                  <b className="font-mono">{invoice.id}</b>
                </div>
                <div className="flex justify-between gap-2">
                  <span>التاريخ:</span>
                  <span className="font-mono">
                    {new Date(invoice.createdAt).toLocaleString("ar-SA")}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>العميل:</span>
                  <b>{invoice.customerName || "عميل نقدي"}</b>
                </div>
                {receiptConfig.showCashierName && currentUser?.name && (
                  <div className="flex justify-between gap-2">
                    <span>الصيدلي:</span>
                    <b>{currentUser.name}</b>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span>النوع / الدفع:</span>
                  <b>
                    {invoice.type === "SALE" ? "مبيعات" : "مرتجع"} (
                    {invoice.paymentMode === "CASH" ? "نقدي" : "آجل"})
                  </b>
                </div>
              </div>

              <div className="space-y-1.5 border-b border-dashed border-slate-400 pb-2">
                {invoice.items.map((item) => (
                  <div key={item.cartKey} className="text-[0.92em]">
                    <div className="font-bold font-sans">
                      {item.product.name} (
                      {item.unit === "pack" ? "علبة" : "شريط"})
                    </div>
                    {receiptConfig.showBarcodeOnItems &&
                      item.product.barcode && (
                        <div className="text-[0.82em] text-slate-500">
                          {item.product.barcode}
                        </div>
                      )}
                    <div className="flex justify-between">
                      <span>
                        {item.qty} × {item.unitPrice.toFixed(2)}
                      </span>
                      <b>{(item.qty * item.unitPrice).toFixed(2)}</b>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-[0.98em] font-sans">
                <div className="flex justify-between">
                  <span>الإجمالي قبل الخصم:</span>
                  <span className="font-mono">
                    {invoice.subtotal.toFixed(2)}
                  </span>
                </div>
                {receiptConfig.showItemDiscount &&
                  invoice.discountPercent > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>الخصم ({invoice.discountPercent}%):</span>
                      <span className="font-mono">
                        -
                        {(
                          (invoice.subtotal * invoice.discountPercent) /
                          100
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}
                <div className="flex justify-between font-extrabold text-[1.15em] border-t border-slate-400 pt-1">
                  <span>الصافي النهائي:</span>
                  <span className="font-mono">
                    {invoice.totalAmount.toFixed(2)} ر.س
                  </span>
                </div>
              </div>

              {/* باركود رقم الفاتورة لسهولة مسحه عند المرتجع */}
              <div className="pt-2 border-t border-dashed border-slate-400 text-center">
                <svg
                  viewBox={`0 0 ${invoiceBarcodeWidth} 36`}
                  className="w-4/5 h-7 mx-auto mb-1"
                  preserveAspectRatio="none"
                >
                  {invoiceBarcodePattern.map((width, idx) => {
                    const x = barcodeX;
                    barcodeX += width;
                    return idx % 2 === 0 ? (
                      <rect
                        key={idx}
                        x={x}
                        y={0}
                        width={width}
                        height={36}
                        fill="#000000"
                      />
                    ) : null;
                  })}
                </svg>
                <div className="font-mono text-[0.9em] tracking-widest font-bold">
                  *{invoice.id}*
                </div>
                {resolvedFooter && (
                  <div className="text-[0.82em] font-sans text-slate-600 mt-1">
                    {resolvedFooter}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full space-y-3">
              {invoice.items.map((item) => {
                const isSelected = selectedLabelKeys[item.cartKey] !== false;
                return (
                  <div
                    key={item.cartKey}
                    className={`rounded-xl border-2 p-3 space-y-2 transition ${
                      isSelected
                        ? "bg-white text-slate-950 border-sky-400 shadow-lg"
                        : "bg-slate-900/60 text-slate-400 border-slate-800 opacity-65"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-300/70 pb-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedLabelKeys((prev) => ({
                            ...prev,
                            [item.cartKey]: !isSelected,
                          }))
                        }
                        className="inline-flex items-center gap-1.5 font-bold text-[11px]"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-sky-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                        <span>{settings.pharmacyName}</span>
                      </button>
                      <span className="text-[10px] font-bold">
                        {invoice.customerName || "عميل نقدي"} •{" "}
                        <span className="font-mono">
                          {labelConfig.widthMm}×{labelConfig.heightMm}mm
                        </span>
                      </span>
                    </div>

                    <div className="font-extrabold text-xs flex items-center justify-between gap-2">
                      <span>{item.product.name}</span>
                      <span className="text-[10px] font-normal opacity-75">
                        ({item.unit === "pack" ? "علبة" : "شريط"})
                      </span>
                    </div>

                    <input
                      type="text"
                      disabled={!isSelected}
                      value={getDosageText(item.cartKey)}
                      onChange={(e) =>
                        setDosageMap((prev) => ({
                          ...prev,
                          [item.cartKey]: e.target.value,
                        }))
                      }
                      className="w-full bg-amber-50 border border-amber-300 rounded-lg p-1.5 text-slate-900 font-bold text-[11px] outline-none focus:border-sky-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700"
                    />

                    {/* اختصارات جرعات سريعة لتوفير الوقت */}
                    {isSelected && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {QUICK_DOSAGE_PRESETS.map((presetText) => (
                          <button
                            key={presetText}
                            type="button"
                            onClick={() =>
                              setDosageMap((prev) => ({
                                ...prev,
                                [item.cartKey]: presetText,
                              }))
                            }
                            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-sky-100 border border-slate-300 text-slate-700 text-[10px] font-bold transition"
                          >
                            {presetText}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
