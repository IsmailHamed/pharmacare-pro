import React from "react";
import {
  ReceiptPaperWidth,
  ThermalLabelConfig,
  ThermalLabelPresetId,
  ThermalReceiptConfig,
} from "../../../../domain/utils/printTemplates";
import { SlidersHorizontal } from "lucide-react";

interface Props {
  activeTab: "RECEIPT" | "LABELS";
  receiptConfig: ThermalReceiptConfig;
  labelConfig: ThermalLabelConfig;
  showQuickCustomize: boolean;
  onToggleQuickCustomize: () => void;
  onUpdateReceiptConfig: (patch: Partial<ThermalReceiptConfig>) => void;
  onSelectLabelPreset: (
    preset: Exclude<ThermalLabelPresetId, "custom">,
  ) => void;
}

/**
 * شريط التخصيص السريع المثبّت أعلى المعاينة لتغيير مقاس الورق (58mm/80mm) أو مقاس الملصق وخيارات القالب
 */
export const ReceiptCustomizeBar: React.FC<Props> = ({
  activeTab,
  receiptConfig,
  labelConfig,
  showQuickCustomize,
  onToggleQuickCustomize,
  onUpdateReceiptConfig,
  onSelectLabelPreset,
}) => (
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
                onClick={() => onUpdateReceiptConfig({ paperWidthMm: width })}
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
            onClick={onToggleQuickCustomize}
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
                  onUpdateReceiptConfig({
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
                    onUpdateReceiptConfig({ showPhone: e.target.checked })
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
                    onUpdateReceiptConfig({
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
                    onUpdateReceiptConfig({
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
                    onUpdateReceiptConfig({
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
              onClick={() => onSelectLabelPreset(key)}
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
);
