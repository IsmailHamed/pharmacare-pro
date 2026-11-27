import React from "react";
import { InvoiceEntity } from "../../../../domain/entities/Invoice";
import { ThermalLabelConfig } from "../../../../domain/utils/printTemplates";
import { CheckSquare, Square } from "lucide-react";

export const DEFAULT_DOSAGE = "قرص واحد كل 8 ساعات بعد الأكل";

const QUICK_DOSAGE_PRESETS = [
  "قرص كل 8 ساعات بعد الأكل",
  "قرص كل 12 ساعة بعد الأكل",
  "قرص واحد يومياً مساءً",
  "عند اللزوم (كل 6 ساعات)",
];

interface Props {
  invoice: InvoiceEntity;
  pharmacyName: string;
  labelConfig: ThermalLabelConfig;
  selectedLabelKeys: Record<string, boolean>;
  getDosageText: (cartKey: string) => string;
  onToggleItemSelection: (cartKey: string, nextSelected: boolean) => void;
  onChangeDosage: (cartKey: string, text: string) => void;
}

/**
 * لوحة تحديد أصناف الفاتورة وتحرير لصاقات الجرعات مع اختصارات الجرعة السريعة
 */
export const DosageLabelsPane: React.FC<Props> = ({
  invoice,
  pharmacyName,
  labelConfig,
  selectedLabelKeys,
  getDosageText,
  onToggleItemSelection,
  onChangeDosage,
}) => (
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
              onClick={() => onToggleItemSelection(item.cartKey, !isSelected)}
              className="inline-flex items-center gap-1.5 font-bold text-[11px]"
            >
              {isSelected ? (
                <CheckSquare className="w-4 h-4 text-sky-600 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              <span>{pharmacyName}</span>
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
            onChange={(e) => onChangeDosage(item.cartKey, e.target.value)}
            className="w-full bg-amber-50 border border-amber-300 rounded-lg p-1.5 text-slate-900 font-bold text-[11px] outline-none focus:border-sky-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700"
          />

          {/* اختصارات جرعات سريعة لتوفير الوقت */}
          {isSelected && (
            <div className="flex items-center gap-1 flex-wrap">
              {QUICK_DOSAGE_PRESETS.map((presetText) => (
                <button
                  key={presetText}
                  type="button"
                  onClick={() => onChangeDosage(item.cartKey, presetText)}
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
);
