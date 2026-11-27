import React, { useEffect, useMemo, useRef, useState } from "react";
import { ProductEntity } from "../../domain/entities";
import { usePosStore } from "../../application/store/usePosStore";
import {
  LABEL_SIZE_PRESETS,
  ThermalLabelConfig,
  ThermalLabelPresetId,
  buildThermalLabelHtml,
  generateBarcodePattern,
  loadPrintPreferences,
  printHtmlDocument,
  savePrintPreferences,
} from "../../domain/utils/printTemplates";
import {
  Printer,
  X,
  Barcode,
  AlertTriangle,
  ZoomIn,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";

interface Props {
  product: ProductEntity | null;
  onClose: () => void;
}

const MM_TO_PX = 3.7795275591;

export const BarcodeLabelModal: React.FC<Props> = ({ product, onClose }) => {
  const settings = usePosStore((s) => s.settings);

  const [unitType, setUnitType] = useState<"pack" | "strip">("pack");
  const [copies, setCopies] = useState<number>(1);
  const [selectedBatchIdx, setSelectedBatchIdx] = useState<number>(0);
  const [dosageText, setDosageText] = useState<string>("");
  const [zoom, setZoom] = useState<number>(1.5);
  const [labelConfig, setLabelConfig] = useState<ThermalLabelConfig>(
    () => loadPrintPreferences().label,
  );
  const [isOverflowing, setIsOverflowing] = useState<boolean>(false);

  const previewLabelRef = useRef<HTMLDivElement>(null);

  // إعادة تحميل آخر إعدادات ملصق محفوظة وضبط القيم الافتراضية عند فتح نافذة لصنف جديد
  useEffect(() => {
    if (!product) return;
    setLabelConfig(loadPrintPreferences().label);
    setUnitType("pack");
    setCopies(1);
    setSelectedBatchIdx(0);
    setDosageText("");
  }, [product]);

  // إغلاق النافذة بزر Escape
  useEffect(() => {
    if (!product) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [product, onClose]);

  const updateLabelConfig = (patch: Partial<ThermalLabelConfig>) => {
    setLabelConfig((prev) => {
      const next = { ...prev, ...patch };
      const allPrefs = loadPrintPreferences();
      savePrintPreferences({ ...allPrefs, label: next });
      return next;
    });
  };

  const handleSelectPreset = (preset: ThermalLabelPresetId) => {
    if (preset === "custom") {
      updateLabelConfig({ preset: "custom" });
      return;
    }
    const presetSpec = LABEL_SIZE_PRESETS[preset];
    updateLabelConfig({
      preset,
      widthMm: presetSpec.widthMm,
      heightMm: presetSpec.heightMm,
    });
  };

  const pattern = useMemo(
    () => (product ? generateBarcodePattern(product.barcode) : []),
    [product],
  );

  // فحص تلقائي لتجاوز محتوى الملصق لارتفاع الرول الفعلي لتفادي هدر الملصقات
  useEffect(() => {
    if (!product) return;
    const el = previewLabelRef.current;
    if (!el) return;
    const checkOverflow = () => {
      setIsOverflowing(
        el.scrollHeight > el.clientHeight + 2 ||
          el.scrollWidth > el.clientWidth + 2,
      );
    };
    const rafId = window.requestAnimationFrame(checkOverflow);
    return () => window.cancelAnimationFrame(rafId);
  }, [product, labelConfig, unitType, selectedBatchIdx, dosageText, zoom]);

  if (!product) return null;

  const displayPrice =
    unitType === "pack"
      ? product.packPrice
      : product.packPrice / Math.max(1, product.stripsPerPack);

  const displayBarcode =
    unitType === "pack" ? product.barcode : `${product.barcode}-S`;

  const selectedBatch =
    product.batches[selectedBatchIdx] ?? product.batches[0] ?? null;

  const totalUnitsWidth = pattern.reduce((acc, w) => acc + w, 0);
  const pharmacyName = settings.pharmacyName?.trim() || "صيدلية فارماكير برو";
  const unitLabel = unitType === "pack" ? "علبة" : "شريط فرط";
  const priceText = `السعر: ${displayPrice.toFixed(2)} ر.س`;

  const safeWidthMm = Math.max(20, Math.min(100, labelConfig.widthMm));
  const safeHeightMm = Math.max(15, Math.min(80, labelConfig.heightMm));
  const safeMarginMm = Math.max(0.5, Math.min(6, labelConfig.marginMm));
  const safeScale = Math.max(0.8, Math.min(1.3, labelConfig.fontScale));
  const barcodeHeightMm = Math.max(5.5, Math.min(12, safeHeightMm * 0.28));

  const scaledPreviewWidthPx = Math.round(safeWidthMm * MM_TO_PX * zoom);
  const scaledPreviewHeightPx = Math.round(safeHeightMm * MM_TO_PX * zoom);

  const handlePrintLabels = () => {
    const html = buildThermalLabelHtml({
      pharmacyName,
      productName: product.name,
      unitLabel,
      barcodeValue: displayBarcode,
      barcodePatternSource: product.barcode,
      priceText,
      expiryDate: selectedBatch?.expiryDate,
      dosageText,
      copies,
      config: labelConfig,
    });
    printHtmlDocument(html);
  };

  let currentX = 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* رأس النافذة */}
        <div className="p-3.5 bg-slate-800 border-b border-slate-700 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Barcode className="w-4 h-4 text-emerald-400" />
              معاينة وطباعة لصاقة باركود ({safeWidthMm}mm × {safeHeightMm}mm)
            </h3>
            <p className="text-[10.5px] text-slate-400 mt-0.5">
              الطابعة الحرارية:{" "}
              <span className="font-mono text-sky-300">
                {settings.thermalPrinterName || "الطابعة الافتراضية"}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-900 p-1.5 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* جسم النافذة المقسوم: إعدادات التخصيص + المعاينة الحية */}
        <div className="grid grid-cols-1 md:grid-cols-12 overflow-y-auto scrollbar-auto-hide">
          {/* العمود الأيمن: إعدادات الملصق والمقاس */}
          <div className="md:col-span-6 p-4 space-y-3.5 border-b md:border-b-0 md:border-l border-slate-800">
            {/* الوحدة وعدد النسخ */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">نوع الوحدة</label>
                <select
                  value={unitType}
                  onChange={(e) =>
                    setUnitType(e.target.value as "pack" | "strip")
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-emerald-500"
                >
                  <option value="pack">
                    علبة كاملة ({product.packPrice.toFixed(2)})
                  </option>
                  {product.stripsPerPack > 1 && (
                    <option value="strip">
                      شريط فرط (
                      {(product.packPrice / product.stripsPerPack).toFixed(2)})
                    </option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">
                  عدد الملصقات
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={copies}
                  onChange={(e) =>
                    setCopies(
                      Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                    )
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono text-center outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* اختيار التشغيلة (تاريخ الصلاحية) في حال تعدد الدفعات */}
            {product.batches.length > 1 && (
              <div>
                <label className="block text-slate-400 mb-1">
                  تاريخ الصلاحية المعروض على الملصق
                </label>
                <select
                  value={selectedBatchIdx}
                  onChange={(e) => setSelectedBatchIdx(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono outline-none focus:border-emerald-500"
                >
                  {product.batches.map((b, idx) => (
                    <option key={idx} value={idx}>
                      EXP: {b.expiryDate} (دفعة #{idx + 1})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* اختيار مقاس الملصق الحراري */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-bold flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
                  مقاس الملصق الحراري (مم)
                </label>
                <button
                  type="button"
                  onClick={() => handleSelectPreset("38x25")}
                  className="text-[10.5px] text-slate-400 hover:text-white inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> افتراضي
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {(
                  Object.keys(LABEL_SIZE_PRESETS) as Exclude<
                    ThermalLabelPresetId,
                    "custom"
                  >[]
                ).map((presetKey) => {
                  const spec = LABEL_SIZE_PRESETS[presetKey];
                  const active = labelConfig.preset === presetKey;
                  return (
                    <button
                      key={presetKey}
                      type="button"
                      onClick={() => handleSelectPreset(presetKey)}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold text-right transition ${
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

              {/* ضبط دقيق للعرض والارتفاع والخط */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    العرض (مم)
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={100}
                    value={labelConfig.widthMm}
                    onChange={(e) =>
                      updateLabelConfig({
                        preset: "custom",
                        widthMm: Math.max(
                          20,
                          Math.min(100, Number(e.target.value) || 38),
                        ),
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-center font-mono text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    الارتفاع (مم)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={80}
                    value={labelConfig.heightMm}
                    onChange={(e) =>
                      updateLabelConfig({
                        preset: "custom",
                        heightMm: Math.max(
                          15,
                          Math.min(80, Number(e.target.value) || 25),
                        ),
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-center font-mono text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    حجم الخط ({Math.round(safeScale * 100)}%)
                  </label>
                  <input
                    type="range"
                    min={0.85}
                    max={1.25}
                    step={0.05}
                    value={labelConfig.fontScale}
                    onChange={(e) =>
                      updateLabelConfig({ fontScale: Number(e.target.value) })
                    }
                    className="w-full accent-emerald-500 mt-1.5 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* حقول الظهور وسطر الجرعة الاختياري */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="text-[11px] font-bold text-slate-300">
                العناصر الظاهرة على الملصق
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={labelConfig.showPharmacyName}
                    onChange={(e) =>
                      updateLabelConfig({ showPharmacyName: e.target.checked })
                    }
                    className="rounded accent-emerald-500"
                  />
                  اسم الصيدلية والوحدة
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={labelConfig.showPrice}
                    onChange={(e) =>
                      updateLabelConfig({ showPrice: e.target.checked })
                    }
                    className="rounded accent-emerald-500"
                  />
                  السعر
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={labelConfig.showExpiry}
                    onChange={(e) =>
                      updateLabelConfig({ showExpiry: e.target.checked })
                    }
                    className="rounded accent-emerald-500"
                  />
                  تاريخ الصلاحية (EXP)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={labelConfig.showBarcodeNumber}
                    onChange={(e) =>
                      updateLabelConfig({ showBarcodeNumber: e.target.checked })
                    }
                    className="rounded accent-emerald-500"
                  />
                  رقم الباركود النصي
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 col-span-2">
                  <input
                    type="checkbox"
                    checked={labelConfig.showDosageLine}
                    onChange={(e) =>
                      updateLabelConfig({ showDosageLine: e.target.checked })
                    }
                    className="rounded accent-emerald-500"
                  />
                  إضافة سطر تعليمات الجرعة (يناسب مقاس 40×30 أو 58×40)
                </label>
              </div>

              {labelConfig.showDosageLine && (
                <input
                  type="text"
                  value={dosageText}
                  onChange={(e) => setDosageText(e.target.value)}
                  placeholder="مثال: حبة كل 8 ساعات بعد الأكل لمدة 5 أيام"
                  className="w-full bg-slate-800 border border-emerald-700/70 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-emerald-400"
                />
              )}
            </div>
          </div>

          {/* العمود الأيسر: المعاينة الحية بالمقاس الدقيق */}
          <div className="md:col-span-6 p-4 bg-slate-950 flex flex-col items-center justify-between gap-3">
            <div className="w-full flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <ZoomIn className="w-3.5 h-3.5 text-emerald-400" />
                معاينة حية ({safeWidthMm} × {safeHeightMm} مم)
              </span>
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg">
                {[1, 1.5, 2].map((factor) => (
                  <button
                    key={factor}
                    type="button"
                    onClick={() => setZoom(factor)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                      zoom === factor
                        ? "bg-emerald-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {Math.round(factor * 100)}%
                  </button>
                ))}
              </div>
            </div>

            {/* مساحة عرض الملصق بالمقاس الفعلي المضروب بمعامل التكبير */}
            <div className="flex-1 w-full flex flex-col items-center justify-center py-4 min-h-[190px] overflow-auto scrollbar-auto-hide">
              <div
                style={{
                  width: `${scaledPreviewWidthPx}px`,
                  height: `${scaledPreviewHeightPx}px`,
                }}
                className="relative shrink-0"
              >
                <div
                  ref={previewLabelRef}
                  style={{
                    width: `${safeWidthMm}mm`,
                    height: `${safeHeightMm}mm`,
                    padding: `${safeMarginMm}mm`,
                    transform: `scale(${zoom})`,
                    transformOrigin: "top right",
                  }}
                  className="bg-white text-slate-950 rounded-sm border border-slate-400 shadow-[0_8px_28px_rgba(0,0,0,0.45)] overflow-hidden flex flex-col justify-between items-center"
                >
                  {labelConfig.showPharmacyName && (
                    <div
                      style={{ fontSize: `${(6.5 * safeScale).toFixed(2)}pt` }}
                      className="w-full flex justify-between items-center font-bold border-b border-slate-400 pb-[0.4mm] gap-1"
                    >
                      <span className="truncate">{pharmacyName}</span>
                      <span className="shrink-0">{unitLabel}</span>
                    </div>
                  )}

                  <div
                    style={{ fontSize: `${(7.8 * safeScale).toFixed(2)}pt` }}
                    className="font-extrabold text-center truncate w-full leading-tight"
                  >
                    {product.name}
                  </div>

                  {/* رسم خطوط الباركود الليزرية SVG */}
                  <div
                    style={{ height: `${barcodeHeightMm.toFixed(1)}mm` }}
                    className="w-full flex items-center"
                  >
                    <svg
                      viewBox={`0 0 ${totalUnitsWidth} 36`}
                      className="w-full h-full block"
                      preserveAspectRatio="none"
                    >
                      {pattern.map((width, barIndex) => {
                        const x = currentX;
                        currentX += width;
                        const isBlackBar = barIndex % 2 === 0;
                        return isBlackBar ? (
                          <rect
                            key={barIndex}
                            x={x}
                            y={0}
                            width={width}
                            height={36}
                            fill="#000000"
                          />
                        ) : null;
                      })}
                    </svg>
                  </div>

                  {labelConfig.showBarcodeNumber && (
                    <div
                      style={{ fontSize: `${(6.4 * safeScale).toFixed(2)}pt` }}
                      className="font-mono tracking-wider font-bold leading-none"
                    >
                      {displayBarcode}
                    </div>
                  )}

                  {labelConfig.showDosageLine && dosageText.trim() && (
                    <div
                      style={{ fontSize: `${(6.2 * safeScale).toFixed(2)}pt` }}
                      className="w-full text-center font-bold border border-slate-500 rounded-sm px-1 truncate"
                    >
                      {dosageText.trim()}
                    </div>
                  )}

                  {(labelConfig.showPrice ||
                    (labelConfig.showExpiry && selectedBatch)) && (
                    <div
                      style={{ fontSize: `${(6.6 * safeScale).toFixed(2)}pt` }}
                      className="w-full flex justify-between items-center pt-[0.4mm] border-t border-dashed border-slate-400 font-bold gap-1"
                    >
                      <span>{labelConfig.showPrice ? priceText : ""}</span>
                      {labelConfig.showExpiry && selectedBatch && (
                        <span
                          style={{
                            fontSize: `${(6 * safeScale).toFixed(2)}pt`,
                          }}
                          className="font-mono text-slate-700 shrink-0"
                        >
                          EXP: {selectedBatch.expiryDate}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {copies > 1 && (
                <div className="mt-3 text-[10.5px] text-slate-400 font-mono">
                  سيتم طباعة <b className="text-emerald-400">{copies}</b> ملصق
                  متتابع دون فواصل فارغة
                </div>
              )}
            </div>

            {/* تحذير فوري في حال تجاوز المحتوى حدود الملصق */}
            {isOverflowing ? (
              <div className="w-full bg-amber-950/50 border border-amber-700/80 rounded-xl px-3 py-2 flex items-center gap-2 text-amber-200 text-[11px]">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  المحتوى يتجاوز ارتفاع الملصق الحالي — صغّر حجم الخط أو اختر
                  مقاساً أكبر (مثل 40×30) لتفادي قص الملصق.
                </span>
              </div>
            ) : (
              <div className="w-full bg-emerald-950/25 border border-emerald-800/50 rounded-xl px-3 py-1.5 text-center text-emerald-300/90 text-[10.5px]">
                الأبعاد متناسقة وجاهزة للطباعة الحرارية بدقة 1:1
              </div>
            )}
          </div>
        </div>

        {/* أزرار الطباعة */}
        <div className="p-3.5 bg-slate-800 border-t border-slate-700 flex gap-2">
          <button
            type="button"
            onClick={handlePrintLabels}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
          >
            <Printer className="w-4 h-4" /> طباعة ({copies}) لصاقة باركود (
            {safeWidthMm}×{safeHeightMm}mm)
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
