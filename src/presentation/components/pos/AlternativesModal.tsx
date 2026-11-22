import React from "react";
import { ProductEntity } from "../../../domain/entities";
import { Layers, Check } from "lucide-react";

interface Props {
  targetProduct: ProductEntity | null;
  alternatives: ProductEntity[];
  onClose: () => void;
  onSelectAlternative: (product: ProductEntity, unit: "pack" | "strip") => void;
}

export const AlternativesModal: React.FC<Props> = ({
  targetProduct,
  alternatives,
  onClose,
  onSelectAlternative,
}) => {
  if (!targetProduct) return null;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 text-xs">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-xl p-5 shadow-2xl">
        <div className="flex justify-between items-center mb-3 pb-2.5 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-400" />
              البدائل العلمية المتطابقة لـ:{" "}
              <span className="text-sky-400">{targetProduct.name}</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              المادة الفعالة:{" "}
              <span className="font-mono text-slate-300">
                {targetProduct.scientificName}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-800 px-2.5 py-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {alternatives.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            لا توجد بدائل أخرى بنفس المادة الفعالة في المخزون حالياً.
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {alternatives.map((alt) => (
              <div
                key={alt.id}
                className="bg-slate-800/80 border border-slate-700/70 p-3 rounded-lg flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-white">{alt.name}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    الرصيد المتاح:{" "}
                    <b className="text-slate-200">{alt.stockPacks} علبة</b>
                    {alt.stockLooseStrips > 0 &&
                      ` و ${alt.stockLooseStrips} شريط`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-emerald-400 ml-2">
                    {alt.packPrice.toFixed(2)} ر.س
                  </span>
                  <button
                    onClick={() => {
                      onSelectAlternative(alt, "pack");
                      onClose();
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> علبة
                  </button>
                  <button
                    onClick={() => {
                      onSelectAlternative(alt, "strip");
                      onClose();
                    }}
                    className="bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold"
                  >
                    شريط
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
