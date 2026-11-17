import React from "react";
import { ProductEntity } from "../../../domain/entities";
import { usePosStore } from "../../../application/store/usePosStore";
import { Barcode, ClipboardCheck } from "lucide-react";

interface Props {
  product: ProductEntity;
  nearestDays: number;
  isDeadStock: boolean;
  onPrintBarcode: (product: ProductEntity) => void;
  onAdjustStock: (product: ProductEntity) => void;
}

export const InventoryItemCard: React.FC<Props> = ({
  product: p,
  nearestDays,
  isDeadStock,
  onPrintBarcode,
  onAdjustStock,
}) => {
  const canViewCost = usePosStore(
    (s) => s.currentUser?.permissions.canViewCostAndProfit ?? false,
  );
  const canAdjustStock = usePosStore(
    (s) => s.currentUser?.permissions.canAdjustStock ?? false,
  );

  const profitMarginPercent = (
    ((p.packPrice - p.weightedCostPrice) /
      Math.max(0.01, p.weightedCostPrice)) *
    100
  ).toFixed(0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between hover:border-slate-700 transition">
      <div>
        <div className="font-bold text-white text-sm flex items-center gap-2 flex-wrap">
          {p.name}
          <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            {p.barcode}
          </span>
          {p.stockPacks <= p.minLimit && (
            <span className="bg-sky-950 border border-sky-800 text-sky-300 text-[10px] px-2 py-0.5 rounded-full">
              نواقص (حد الطلب: {p.minLimit})
            </span>
          )}
          {nearestDays <= 30 && (
            <span className="bg-rose-950 border border-rose-700 text-rose-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
              ⚠️ صلاحية حرجة ({nearestDays} يوم)
            </span>
          )}
          {nearestDays > 30 && nearestDays <= 90 && (
            <span className="bg-orange-950 border border-orange-700 text-orange-300 text-[10px] px-2 py-0.5 rounded-full">
              صلاحية أقل من 90 يوماً ({nearestDays} يوم)
            </span>
          )}
          {nearestDays > 90 && nearestDays <= 180 && (
            <span className="bg-amber-950 border border-amber-700 text-amber-300 text-[10px] px-2 py-0.5 rounded-full">
              تنبيه 180 يوماً ({nearestDays} يوم)
            </span>
          )}
          {isDeadStock && (
            <span className="bg-purple-950 border border-purple-800 text-purple-300 text-[10px] px-2 py-0.5 rounded-full">
              راكد (يفضل تصريفه)
            </span>
          )}
          {p.isControlled && (
            <span className="bg-rose-950 border border-rose-800 text-rose-300 text-[10px] px-2 py-0.5 rounded-full">
              مراقب 🔒
            </span>
          )}
        </div>

        <div className="text-slate-400 mt-1.5">
          {canViewCost && (
            <>
              التكلفة المرجحة (بعد البونص):{" "}
              <b className="font-mono text-amber-400">
                {p.weightedCostPrice.toFixed(2)}
              </b>
              <span className="mx-2 text-slate-600">|</span>
            </>
          )}
          سعر البيع:{" "}
          <b className="font-mono text-emerald-400">{p.packPrice.toFixed(2)}</b>
          {canViewCost && (
            <>
              <span className="mx-2 text-slate-600">|</span>
              هامش الربح:{" "}
              <b className="font-mono text-sky-400">{profitMarginPercent}%</b>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {canAdjustStock && (
          <button
            onClick={() => onAdjustStock(p)}
            className="bg-slate-800 hover:bg-amber-600 text-slate-200 hover:text-white border border-slate-700 px-3 py-2 rounded-xl flex items-center gap-1.5 font-bold transition"
            title="تسوية الجرد الفعلي أو تسجيل كسر/إتلاف صلاحية"
          >
            <ClipboardCheck className="w-4 h-4 text-amber-400" />
            تسوية جرد / تالف
          </button>
        )}

        <button
          onClick={() => onPrintBarcode(p)}
          className="bg-slate-800 hover:bg-emerald-700 text-slate-200 hover:text-white border border-slate-700 px-3 py-2 rounded-xl flex items-center gap-1.5 font-bold transition"
          title="طباعة لصاقة باركود للعلبة أو الشريط الفرط"
        >
          <Barcode className="w-4 h-4 text-emerald-400" />
          لصاقة باركود
        </button>

        <div className="flex flex-col items-end gap-1.5">
          <div className="font-bold text-white bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
            الرصيد: {p.stockPacks} علبة{" "}
            {p.stockLooseStrips > 0 ? `و ${p.stockLooseStrips} شريط` : ""}
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {p.batches.map((b) => (
              <span
                key={b.id}
                className="text-[10px] bg-slate-950 border border-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono"
              >
                {b.batchNumber}: {b.expiryDate} ({b.qtyPacks}ع)
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
