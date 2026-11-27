import React from "react";
import { CartItemEntity } from "../../../../domain/entities";
import { parseLasaDisplay } from "../../../../domain/utils/lasaFormatter";
import { AlertTriangle } from "lucide-react";

interface Props {
  item: CartItemEntity;
  isActiveForKeyboard: boolean;
  cartLasaRiskGroups: Set<string>;
  onToggleUnit: (key: string) => void;
  onUpdateQty: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
}

/**
 * بطاقة الصنف الفردي داخل سلة نقطة البيع مع تمييز LASA وتبديل الوحدة والتحكم بالكمية
 */
export const CartItemRow: React.FC<Props> = ({
  item,
  isActiveForKeyboard,
  cartLasaRiskGroups,
  onToggleUnit,
  onUpdateQty,
  onRemove,
}) => {
  const canSplitToStrips = item.product.stripsPerPack > 1;
  const lasa = parseLasaDisplay(item.product.name, item.product.category);
  const isLasaRisk =
    lasa.lasaGroupKey.length >= 3 && cartLasaRiskGroups.has(lasa.lasaGroupKey);

  return (
    <div
      className={`rounded-lg p-2.5 flex items-center justify-between gap-2 text-xs transition ${
        isActiveForKeyboard
          ? "bg-slate-800 border-2 border-sky-500/70 shadow-[0_0_12px_rgba(14,165,233,0.12)]"
          : isLasaRisk
            ? "bg-amber-950/20 border border-amber-600/70"
            : "bg-slate-800/80 border border-slate-700/70"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
          <span className="text-[12.5px] tracking-tight">{lasa.baseName}</span>

          {/* شارات العيار الدوائي البارزة (LASA) */}
          {lasa.strengths.map((strength) => (
            <span
              key={strength.text}
              dir="ltr"
              className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[11px] font-black font-mono tracking-wide ${strength.badgeClass}`}
            >
              {strength.text}
            </span>
          ))}

          {/* الصفات الفارقة الحرجة (XR / Forte / Extra / أطفال...) */}
          {lasa.modifiers.map((mod) => (
            <span
              key={mod}
              className="inline-flex items-center px-1.5 py-0.2 rounded border bg-yellow-500/15 text-yellow-200 border-yellow-400/70 text-[10px] font-extrabold"
            >
              {mod}
            </span>
          ))}

          {/* الشكل الصيدلاني */}
          {lasa.dosageForm && (
            <span
              className={`inline-flex items-center px-1.5 py-0.2 rounded border text-[10px] ${lasa.dosageForm.badgeClass}`}
            >
              {lasa.dosageForm.label}
            </span>
          )}

          <button
            type="button"
            disabled={!canSplitToStrips}
            onClick={() => onToggleUnit(item.cartKey)}
            title={
              canSplitToStrips
                ? "اضغط أو استخدم زر Tab للتبديل بين علبة وشريط"
                : "هذا الصنف يُباع كعلبة كاملة فقط"
            }
            className={`text-[10px] px-1.5 py-0.5 rounded transition ${
              item.unit === "pack"
                ? "bg-blue-950 text-blue-300 border border-blue-800/70"
                : "bg-indigo-950 text-indigo-300 border border-indigo-700/80"
            } ${
              canSplitToStrips
                ? "hover:brightness-125 cursor-pointer"
                : "cursor-default"
            }`}
          >
            {item.unit === "pack" ? "علبة" : "شريط"}
          </button>

          {item.isControlled && (
            <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800 px-1.5 rounded">
              🔒 موثق
            </span>
          )}

          {isLasaRisk && (
            <span
              title="تحذير LASA: يوجد عياران أو شكلان متشابهان لنفس الدواء في هذه السلة"
              className="inline-flex items-center gap-0.5 bg-amber-950 text-amber-300 border border-amber-600/80 text-[9px] font-extrabold px-1.5 py-0.2 rounded"
            >
              <AlertTriangle className="w-2.5 h-2.5" />
              LASA
            </span>
          )}

          {isActiveForKeyboard && (
            <span className="text-[9px] bg-sky-950 text-sky-300 border border-sky-700/80 px-1.5 py-0.2 rounded-full">
              نشط
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          {item.unitPrice.toFixed(2)} للوحدة
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center bg-slate-900 border border-slate-700 rounded">
          <button
            type="button"
            onClick={() => onUpdateQty(item.cartKey, -1)}
            className="px-2 py-0.5 hover:bg-slate-800"
          >
            −
          </button>
          <span className="px-2.5 font-mono font-bold">{item.qty}</span>
          <button
            type="button"
            onClick={() => onUpdateQty(item.cartKey, 1)}
            className="px-2 py-0.5 hover:bg-slate-800"
          >
            +
          </button>
        </div>
        <span className="font-mono font-bold text-emerald-400 w-16 text-left">
          {(item.unitPrice * item.qty).toFixed(2)}
        </span>
        <button
          type="button"
          onClick={() => onRemove(item.cartKey)}
          className="text-slate-500 hover:text-rose-400 px-1"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
