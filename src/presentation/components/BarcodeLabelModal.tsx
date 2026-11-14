import React, { useMemo, useState } from "react";
import { ProductEntity } from "../../domain/entities";
import { Printer, X, Barcode } from "lucide-react";

interface Props {
  product: ProductEntity | null;
  onClose: () => void;
}

/**
 * مولد أنماط خطوط الباركود (Code-128 Style Bars) بصيغة SVG عالية الدقة للطابعات الحرارية
 */
const generateBarcodePattern = (code: string): number[] => {
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

export const BarcodeLabelModal: React.FC<Props> = ({ product, onClose }) => {
  const [unitType, setUnitType] = useState<"pack" | "strip">("pack");
  const [copies, setCopies] = useState<number>(1);

  const pattern = useMemo(
    () => (product ? generateBarcodePattern(product.barcode) : []),
    [product],
  );

  if (!product) return null;

  const displayPrice =
    unitType === "pack"
      ? product.packPrice
      : product.packPrice / Math.max(1, product.stripsPerPack);

  const displayBarcode =
    unitType === "pack" ? product.barcode : `${product.barcode}-S`;

  const totalUnitsWidth = pattern.reduce((acc, w) => acc + w, 0);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* رأس النافذة */}
        <div className="p-3.5 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Barcode className="w-4 h-4 text-emerald-400" />
            طباعة لصاقة باركود (38mm × 25mm)
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-900 p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* إعدادات اللصاقة */}
        <div className="p-4 space-y-3 border-b border-slate-800">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">نوع الوحدة</label>
              <select
                value={unitType}
                onChange={(e) =>
                  setUnitType(e.target.value as "pack" | "strip")
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none"
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
                عدد الملصقات المطلوب طباعتها
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
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono text-center outline-none"
              />
            </div>
          </div>
        </div>

        {/* معاينة الملصق الحراري */}
        <div className="p-5 bg-slate-950 flex flex-col items-center gap-3 max-h-72 overflow-y-auto">
          {Array.from({ length: copies }).map((_, idx) => {
            let currentX = 0;
            return (
              <div
                key={idx}
                className="bg-white text-slate-950 w-[220px] p-2.5 rounded border-2 border-slate-300 shadow flex flex-col items-center"
              >
                <div className="w-full flex justify-between items-center text-[9px] font-bold border-b border-slate-300 pb-0.5 mb-1">
                  <span>صيدلية فارماكير برو</span>
                  <span>{unitType === "pack" ? "علبة" : "شريط فرط"}</span>
                </div>

                <div className="font-extrabold text-[11px] text-center truncate w-full mb-1">
                  {product.name}
                </div>

                {/* رسم خطوط الباركود الليزرية SVG */}
                <svg
                  viewBox={`0 0 ${totalUnitsWidth} 36`}
                  className="w-full h-10"
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

                <div className="font-mono text-[10px] tracking-widest font-bold mt-0.5">
                  {displayBarcode}
                </div>

                <div className="w-full flex justify-between items-center mt-1 pt-1 border-t border-dashed border-slate-300 text-[10px]">
                  <span className="font-bold">
                    السعر: {displayPrice.toFixed(2)} ر.س
                  </span>
                  {product.batches[0] && (
                    <span className="font-mono text-[9px] text-slate-600">
                      EXP: {product.batches[0].expiryDate}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* أزرار الطباعة */}
        <div className="p-3.5 bg-slate-800 border-t border-slate-700 flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg"
          >
            <Printer className="w-4 h-4" /> طباعة ({copies}) لصاقة باركود
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
