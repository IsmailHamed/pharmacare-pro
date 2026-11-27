import React, { useMemo, useState } from "react";
import { usePosStore } from "../../../application/store/usePosStore";
import {
  DEFAULT_PRINT_PREFERENCES,
  LABEL_SIZE_PRESETS,
  PrintPreferences,
  ReceiptPaperWidth,
  ThermalLabelPresetId,
  buildSampleReceiptHtml,
  buildThermalLabelHtml,
  generateBarcodePattern,
  loadPrintPreferences,
  printHtmlDocument,
  savePrintPreferences,
} from "../../../domain/utils/printTemplates";
import { Printer, Barcode, Receipt, Save, RotateCcw, Eye } from "lucide-react";

interface Props {
  onGoToIdentity?: () => void;
}

export const PrintTemplatesSection: React.FC<Props> = ({ onGoToIdentity }) => {
  const { settings, currentUser, setNotification } = usePosStore();
  const canManage =
    currentUser?.permissions.canManageSettingsAndBackup ?? false;

  const [prefs, setPrefs] = useState<PrintPreferences>(() =>
    loadPrintPreferences(),
  );

  const sampleBarcode = "628100000501";
  const samplePattern = useMemo(
    () => generateBarcodePattern(sampleBarcode),
    [],
  );
  const samplePatternWidth = useMemo(
    () => samplePattern.reduce((acc, w) => acc + w, 0),
    [samplePattern],
  );

  const pharmacyName = settings.pharmacyName?.trim() || "صيدلية فارماكير برو";
  const pharmacyPhone = settings.phone?.trim() || "";
  const cashierName = currentUser?.name || "الصيدلي المناوب";
  const receiptFooter = settings.receiptFooter?.trim() || "";

  const handleSave = () => {
    if (!canManage) return;
    savePrintPreferences(prefs);
    setNotification({
      type: "success",
      message: "تم حفظ قوالب ومقاسات الطباعة الحرارية بنجاح.",
    });
  };

  const handleResetDefaults = () => {
    if (!canManage) return;
    setPrefs(DEFAULT_PRINT_PREFERENCES);
    savePrintPreferences(DEFAULT_PRINT_PREFERENCES);
    setNotification({
      type: "info",
      message: "تمت استعادة الإعدادات الافتراضية لقوالب الطباعة.",
    });
  };

  const handleSelectLabelPreset = (preset: ThermalLabelPresetId) => {
    if (!canManage) return;
    if (preset === "custom") {
      setPrefs((prev) => ({ ...prev, label: { ...prev.label, preset } }));
      return;
    }
    const spec = LABEL_SIZE_PRESETS[preset];
    setPrefs((prev) => ({
      ...prev,
      label: {
        ...prev.label,
        preset,
        widthMm: spec.widthMm,
        heightMm: spec.heightMm,
      },
    }));
  };

  const handleTestPrintLabel = () => {
    const html = buildThermalLabelHtml({
      pharmacyName,
      productName: "Panadol Extra 500mg",
      unitLabel: "علبة",
      barcodeValue: sampleBarcode,
      barcodePatternSource: sampleBarcode,
      priceText: "السعر: 16.00 ر.س",
      expiryDate: "2028-06",
      dosageText: "قرصان عند اللزوم كل 6 ساعات",
      copies: 1,
      config: prefs.label,
    });
    printHtmlDocument(html);
  };

  const handleTestPrintReceipt = () => {
    const html = buildSampleReceiptHtml({
      pharmacyName,
      phone: pharmacyPhone,
      cashierName,
      footerText: receiptFooter,
      config: prefs.receipt,
    });
    printHtmlDocument(html);
  };

  let currentX = 0;

  return (
    <div className="space-y-5">
      {/* شريط التحكم العلوي وخيار المعاينة التلقائية */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            disabled={!canManage}
            checked={prefs.autoPreviewBeforePrint}
            onChange={(e) =>
              setPrefs((prev) => ({
                ...prev,
                autoPreviewBeforePrint: e.target.checked,
              }))
            }
            className="rounded accent-sky-500 w-4 h-4"
          />
          <div>
            <div className="font-bold text-white flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-sky-400" />
              إظهار معاينة سريعة قبل الطباعة الفعلية
            </div>
            <div className="text-[11px] text-slate-400">
              يمنع هدر الورق والملصقات عند تبديل مقاس الرول أو مراجعة الفاتورة
              قبل الإرسال للطابعة.
            </div>
          </div>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canManage}
            onClick={handleResetDefaults}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-300 font-bold inline-flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            الافتراضي
          </button>
          <button
            type="button"
            disabled={!canManage}
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold inline-flex items-center gap-1.5 shadow transition"
          >
            <Save className="w-4 h-4" />
            حفظ قوالب الطباعة
          </button>
        </div>
      </div>

      {/* بطاقتا تخصيص ومعاينة الملصق الحراري وفاتورة نقطة البيع */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* 1. قالب الملصق الحراري */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Barcode className="w-4 h-4 text-emerald-400" />
              قالب الملصق الحراري الافتراضي
            </h3>
            <button
              type="button"
              onClick={handleTestPrintLabel}
              className="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-700 border border-emerald-700/70 text-emerald-300 hover:text-white font-bold text-[11px] inline-flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              طباعة ملصق تجريبي
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(
              Object.keys(LABEL_SIZE_PRESETS) as Exclude<
                ThermalLabelPresetId,
                "custom"
              >[]
            ).map((key) => {
              const spec = LABEL_SIZE_PRESETS[key];
              const active = prefs.label.preset === key;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!canManage}
                  onClick={() => handleSelectLabelPreset(key)}
                  className={`px-3 py-2 rounded-xl border text-right font-bold text-[11px] transition disabled:opacity-50 ${
                    active
                      ? "bg-emerald-950/60 border-emerald-500 text-emerald-200"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  {spec.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">
                العرض (مم)
              </label>
              <input
                type="number"
                disabled={!canManage}
                min={20}
                max={100}
                value={prefs.label.widthMm}
                onChange={(e) =>
                  setPrefs((prev) => ({
                    ...prev,
                    label: {
                      ...prev.label,
                      preset: "custom",
                      widthMm: Math.max(
                        20,
                        Math.min(100, Number(e.target.value) || 38),
                      ),
                    },
                  }))
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-center font-mono text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">
                الارتفاع (مم)
              </label>
              <input
                type="number"
                disabled={!canManage}
                min={15}
                max={80}
                value={prefs.label.heightMm}
                onChange={(e) =>
                  setPrefs((prev) => ({
                    ...prev,
                    label: {
                      ...prev.label,
                      preset: "custom",
                      heightMm: Math.max(
                        15,
                        Math.min(80, Number(e.target.value) || 25),
                      ),
                    },
                  }))
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-center font-mono text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">
                حجم الخط ({Math.round(prefs.label.fontScale * 100)}%)
              </label>
              <input
                type="range"
                disabled={!canManage}
                min={0.85}
                max={1.25}
                step={0.05}
                value={prefs.label.fontScale}
                onChange={(e) =>
                  setPrefs((prev) => ({
                    ...prev,
                    label: {
                      ...prev.label,
                      fontScale: Number(e.target.value),
                    },
                  }))
                }
                className="w-full accent-emerald-500 mt-2 cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
            {[
              { key: "showPharmacyName", text: "إظهار اسم الصيدلية" },
              { key: "showPrice", text: "إظهار السعر" },
              { key: "showExpiry", text: "إظهار الصلاحية (EXP)" },
              { key: "showBarcodeNumber", text: "إظهار رقم الباركود" },
              { key: "showDosageLine", text: "إظهار سطر الجرعة افتراضياً" },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-2 cursor-pointer text-slate-300"
              >
                <input
                  type="checkbox"
                  disabled={!canManage}
                  checked={
                    prefs.label[item.key as keyof typeof prefs.label] as boolean
                  }
                  onChange={(e) =>
                    setPrefs((prev) => ({
                      ...prev,
                      label: { ...prev.label, [item.key]: e.target.checked },
                    }))
                  }
                  className="rounded accent-emerald-500"
                />
                {item.text}
              </label>
            ))}
          </div>

          {/* معاينة مصغرة للملصق */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center min-h-[160px]">
            <div className="text-[10px] text-slate-500 font-mono mb-2">
              معاينة الملصق ({prefs.label.widthMm} × {prefs.label.heightMm} مم)
            </div>
            <div
              style={{
                width: `${prefs.label.widthMm}mm`,
                height: `${prefs.label.heightMm}mm`,
                padding: `${prefs.label.marginMm}mm`,
                transform: "scale(1.35)",
              }}
              className="bg-white text-slate-950 rounded-sm border border-slate-400 shadow-lg overflow-hidden flex flex-col justify-between items-center my-4"
            >
              {prefs.label.showPharmacyName && (
                <div className="w-full flex justify-between text-[6.5pt] font-bold border-b border-slate-400 pb-[0.3mm]">
                  <span className="truncate">{pharmacyName}</span>
                  <span>علبة</span>
                </div>
              )}
              <div className="font-extrabold text-[7.6pt] truncate w-full text-center">
                Panadol Extra 500mg
              </div>
              <svg
                viewBox={`0 0 ${samplePatternWidth} 36`}
                className="w-full h-[7mm]"
                preserveAspectRatio="none"
              >
                {samplePattern.map((width, idx) => {
                  const x = currentX;
                  currentX += width;
                  return idx % 2 === 0 ? (
                    <rect
                      key={idx}
                      x={x}
                      y={0}
                      width={width}
                      height={36}
                      fill="#000"
                    />
                  ) : null;
                })}
              </svg>
              {prefs.label.showBarcodeNumber && (
                <div className="font-mono text-[6pt] font-bold leading-none">
                  {sampleBarcode}
                </div>
              )}
              {(prefs.label.showPrice || prefs.label.showExpiry) && (
                <div className="w-full flex justify-between text-[6.2pt] font-bold border-t border-dashed border-slate-400 pt-[0.3mm]">
                  <span>{prefs.label.showPrice ? "السعر: 16.00 ر.س" : ""}</span>
                  <span className="font-mono">
                    {prefs.label.showExpiry ? "EXP: 2028-06" : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. قالب فاتورة نقطة البيع (58mm / 80mm) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Receipt className="w-4 h-4 text-sky-400" />
              قالب فاتورة نقطة البيع الحرارية
            </h3>
            <button
              type="button"
              onClick={handleTestPrintReceipt}
              className="px-3 py-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-700 border border-sky-700/70 text-sky-300 hover:text-white font-bold text-[11px] inline-flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              طباعة فاتورة تجريبية
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {([80, 58] as ReceiptPaperWidth[]).map((width) => {
              const active = prefs.receipt.paperWidthMm === width;
              return (
                <button
                  key={width}
                  type="button"
                  disabled={!canManage}
                  onClick={() =>
                    setPrefs((prev) => ({
                      ...prev,
                      receipt: { ...prev.receipt, paperWidthMm: width },
                    }))
                  }
                  className={`px-3 py-2 rounded-xl border font-bold text-xs transition disabled:opacity-50 ${
                    active
                      ? "bg-sky-950/60 border-sky-500 text-sky-200"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  رول {width}mm ({width === 80 ? "قياسي عريض" : "مدمج صغير"})
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">
                الهامش الجانبي ({prefs.receipt.marginMm} مم)
              </label>
              <input
                type="range"
                disabled={!canManage}
                min={1}
                max={6}
                step={0.5}
                value={prefs.receipt.marginMm}
                onChange={(e) =>
                  setPrefs((prev) => ({
                    ...prev,
                    receipt: {
                      ...prev.receipt,
                      marginMm: Number(e.target.value),
                    },
                  }))
                }
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">
                حجم خط الفاتورة ({Math.round(prefs.receipt.fontScale * 100)}%)
              </label>
              <input
                type="range"
                disabled={!canManage}
                min={0.85}
                max={1.2}
                step={0.05}
                value={prefs.receipt.fontScale}
                onChange={(e) =>
                  setPrefs((prev) => ({
                    ...prev,
                    receipt: {
                      ...prev.receipt,
                      fontScale: Number(e.target.value),
                    },
                  }))
                }
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {[
              { key: "showPharmacyHeader", text: "ترويسة اسم الصيدلية" },
              { key: "showPhone", text: "رقم هاتف الصيدلية" },
              { key: "showCashierName", text: "اسم الصيدلي البائع" },
              { key: "showItemDiscount", text: "إظهار سطر الخصم" },
              { key: "showBarcodeOnItems", text: "إظهار الباركود أسفل الصنف" },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-2 cursor-pointer text-slate-300"
              >
                <input
                  type="checkbox"
                  disabled={!canManage}
                  checked={
                    prefs.receipt[
                      item.key as keyof typeof prefs.receipt
                    ] as boolean
                  }
                  onChange={(e) =>
                    setPrefs((prev) => ({
                      ...prev,
                      receipt: {
                        ...prev.receipt,
                        [item.key]: e.target.checked,
                      },
                    }))
                  }
                  className="rounded accent-sky-500"
                />
                {item.text}
              </label>
            ))}
          </div>

          {/* عرض نص تذييل الفاتورة الموحّد والمُدار من تبويب هوية الصيدلية */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="text-[10.5px] text-slate-400">
                تذييل الفاتورة الحالي (يُدار من «هوية الصيدلية»):
              </div>
              <div className="text-[11px] text-slate-200 truncate mt-0.5">
                {receiptFooter || "لا يوجد نص تذييل محدد حالياً"}
              </div>
            </div>
            {onGoToIdentity && (
              <button
                type="button"
                onClick={onGoToIdentity}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 font-bold text-[10.5px] shrink-0 transition"
              >
                تعديل من هوية الصيدلية
              </button>
            )}
          </div>

          {/* معاينة حية للفاتورة بمقاس 58mm أو 80mm */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col items-center">
            <div className="text-[10px] text-slate-500 font-mono mb-2">
              معاينة الفاتورة ({prefs.receipt.paperWidthMm}mm)
            </div>
            <div
              style={{
                width: `${prefs.receipt.paperWidthMm}mm`,
                padding: `${prefs.receipt.marginMm}mm`,
                fontSize: `${(8.2 * prefs.receipt.fontScale).toFixed(2)}pt`,
              }}
              className="bg-white text-slate-950 rounded-sm shadow-xl border border-slate-300 space-y-1.5 transition-all"
            >
              {prefs.receipt.showPharmacyHeader && (
                <div className="text-center font-extrabold text-[1.15em]">
                  {pharmacyName}
                </div>
              )}
              {prefs.receipt.showPhone && pharmacyPhone && (
                <div className="text-center font-mono text-[0.85em] text-slate-600">
                  هاتف: {pharmacyPhone}
                </div>
              )}
              <div className="border-t border-dashed border-slate-400 my-1" />
              <div className="flex justify-between text-[0.85em] text-slate-700">
                <span className="font-mono">INV-TEST-001</span>
                {prefs.receipt.showCashierName && <span>{cashierName}</span>}
              </div>
              <div className="border-t border-dashed border-slate-400 my-1" />
              <div className="space-y-1 text-[0.9em]">
                <div className="flex justify-between">
                  <div>
                    <div className="font-bold">Panadol Extra 500mg × 2</div>
                    {prefs.receipt.showBarcodeOnItems && (
                      <div className="font-mono text-[0.8em] text-slate-500">
                        628100000101
                      </div>
                    )}
                  </div>
                  <span className="font-mono font-bold">32.00</span>
                </div>
                <div className="flex justify-between">
                  <div>
                    <div className="font-bold">Augmentin 1g × 1</div>
                    {prefs.receipt.showBarcodeOnItems && (
                      <div className="font-mono text-[0.8em] text-slate-500">
                        628100000205
                      </div>
                    )}
                  </div>
                  <span className="font-mono font-bold">68.00</span>
                </div>
              </div>
              <div className="border-t border-dashed border-slate-400 my-1" />
              {prefs.receipt.showItemDiscount && (
                <div className="flex justify-between text-[0.85em] text-slate-600">
                  <span>الخصم (5%)</span>
                  <span className="font-mono">-5.00 ر.س</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-[1.08em]">
                <span>الصافي للدفع</span>
                <span className="font-mono">95.00 ر.س</span>
              </div>
              {receiptFooter && (
                <>
                  <div className="border-t border-dashed border-slate-400 my-1" />
                  <div className="text-center text-[0.82em] text-slate-600">
                    {receiptFooter}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
