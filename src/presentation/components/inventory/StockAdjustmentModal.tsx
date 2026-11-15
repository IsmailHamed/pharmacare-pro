import React, { useEffect, useState } from "react";
import { ProductEntity } from "../../../domain/entities";
import { usePosStore } from "../../../application/store/usePosStore";
import {
  ClipboardCheck,
  X,
  AlertTriangle,
  Flame,
  Scale,
  Trash2,
} from "lucide-react";

interface Props {
  product: ProductEntity | null;
  onClose: () => void;
}

type AdjustmentReasonType = "STOCKTAKING" | "DAMAGED" | "EXPIRED" | "SHORTAGE";

export const StockAdjustmentModal: React.FC<Props> = ({ product, onClose }) => {
  const { adjustProductStock } = usePosStore();

  const [actualPacks, setActualPacks] = useState<string>("0");
  const [actualLooseStrips, setActualLooseStrips] = useState<string>("0");
  const [targetBatchId, setTargetBatchId] = useState<string>("AUTO_FIFO");
  const [reason, setReason] = useState<AdjustmentReasonType>("STOCKTAKING");
  const [notes, setNotes] = useState<string>("");
  const [recordLossInFinance, setRecordLossInFinance] = useState<boolean>(true);

  useEffect(() => {
    if (!product) return;
    setActualPacks(String(product.stockPacks));
    setActualLooseStrips(String(product.stockLooseStrips));
    setTargetBatchId("AUTO_FIFO");
    setReason("STOCKTAKING");
    setNotes("");
    setRecordLossInFinance(true);
  }, [product]);

  if (!product) return null;

  const stripsPerPack = Math.max(1, product.stripsPerPack);
  const parsedActualPacks = Math.max(0, Math.floor(Number(actualPacks) || 0));
  const parsedActualStrips = Math.max(
    0,
    Math.min(stripsPerPack - 1, Math.floor(Number(actualLooseStrips) || 0)),
  );

  const oldTotalStrips =
    product.stockPacks * stripsPerPack + product.stockLooseStrips;
  const newTotalStrips = parsedActualPacks * stripsPerPack + parsedActualStrips;
  const diffStrips = newTotalStrips - oldTotalStrips;
  const diffPacks = parsedActualPacks - product.stockPacks;

  const stripCost = product.weightedCostPrice / stripsPerPack;
  const financialImpact = Number((diffStrips * stripCost).toFixed(2));

  // إعدام تشغيلة منتهية الصلاحية بالكامل بضغطة زر
  const handleDestroySelectedBatch = () => {
    if (targetBatchId === "AUTO_FIFO") return;
    const batch = product.batches.find((b) => b.id === targetBatchId);
    if (!batch) return;

    const remainingPacks = Math.max(0, product.stockPacks - batch.qtyPacks);
    setActualPacks(String(remainingPacks));
    setReason("EXPIRED");
    setRecordLossInFinance(true);
    setNotes(
      `إتلاف كامل الدفعة (${batch.batchNumber}) المنتهية الصلاحية (${batch.expiryDate}) بجميع علبها (${batch.qtyPacks} علبة)`,
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await adjustProductStock({
      productId: product.id,
      actualPacks: parsedActualPacks,
      actualLooseStrips: parsedActualStrips,
      targetBatchId,
      reason,
      notes,
      recordLossInFinance,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-xs">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
      >
        {/* رأس النافذة */}
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-amber-400" />
            تسوية الجرد الفعلي ومعالجة التوالف والكسور
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-900 p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* بطاقة معلومات الدواء والرصيد الدفتري الحالي */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <div className="font-extrabold text-white text-sm">
                {product.name}
              </div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                {product.scientificName} | التكلفة المرجحة:{" "}
                <b className="font-mono text-amber-400">
                  {product.weightedCostPrice.toFixed(2)} ر.س
                </b>
              </div>
            </div>
            <div className="text-left bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
              <div className="text-[10px] text-slate-400">
                الرصيد الدفتري بالنظام
              </div>
              <div className="font-mono font-bold text-emerald-400 text-xs">
                {product.stockPacks} علبة{" "}
                {product.stockLooseStrips > 0
                  ? `+ ${product.stockLooseStrips} شريط`
                  : ""}
              </div>
            </div>
          </div>

          {/* اختيار الدفعة المستهدفة أو التوزيع التلقائي */}
          <div className="space-y-1.5">
            <label className="block text-slate-400">
              الدفعة المتأثرة بالتسوية (Batch)
            </label>
            <div className="flex items-center gap-2">
              <select
                value={targetBatchId}
                onChange={(e) => setTargetBatchId(e.target.value)}
                className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono outline-none focus:border-amber-500 truncate"
              >
                <option value="AUTO_FIFO">
                  تلقائي حسب الأقدم صلاحية (AUTO_FIFO)
                </option>
                {product.batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    دفعة {b.batchNumber} — صلاحية: {b.expiryDate} (الرصيد:{" "}
                    {b.qtyPacks} علبة)
                  </option>
                ))}
              </select>

              {targetBatchId !== "AUTO_FIFO" && (
                <button
                  type="button"
                  onClick={handleDestroySelectedBatch}
                  className="bg-rose-950 hover:bg-rose-800 border border-rose-700 text-rose-200 px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap transition shadow-md"
                  title="خصم كامل كمية هذه الدفعة من الرصيد بسبب تلف أو انتهاء صلاحية"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>
                    إعدام الدفعة (
                    {product.batches.find((b) => b.id === targetBatchId)
                      ?.qtyPacks || 0}{" "}
                    علبة)
                  </span>
                </button>
              )}
            </div>
          </div>
          {/* إدخال الرصيد الفعلي الجديد */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                الرصيد الفعلي للعلب على الرف *
              </label>
              <input
                type="number"
                min={0}
                required
                value={actualPacks}
                onChange={(e) => setActualPacks(e.target.value)}
                className="w-full bg-slate-800 border border-amber-600/70 rounded-lg p-2.5 text-white font-mono font-bold text-sm text-center outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                الرصيد الفعلي للأشرطة الفرط (0 -{" "}
                {Math.max(0, stripsPerPack - 1)})
              </label>
              <input
                type="number"
                min={0}
                max={Math.max(0, stripsPerPack - 1)}
                disabled={stripsPerPack <= 1}
                value={actualLooseStrips}
                onChange={(e) => setActualLooseStrips(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white font-mono font-bold text-sm text-center outline-none disabled:opacity-40"
              />
            </div>
          </div>

          {/* سبب التسوية والملاحظات */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">
                سبب التسوية المخزنية *
              </label>
              <select
                value={reason}
                onChange={(e) =>
                  setReason(e.target.value as AdjustmentReasonType)
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none"
              >
                <option value="STOCKTAKING">فارق جرد فعلي دوري</option>
                <option value="DAMAGED">تالف وكسر مخزني</option>
                <option value="EXPIRED">إعدام صلاحية منتهية</option>
                <option value="SHORTAGE">عجز مخزني غير مبرر</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">
                بيان وملاحظات التسوية
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: كسر عبوة على الرف..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none"
              />
            </div>
          </div>

          {/* خيار تقييد الخسارة مالياً عند وجود نقص */}
          {diffStrips < 0 && (
            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-950/30 border border-rose-800/60 text-rose-200 cursor-pointer font-bold">
              <input
                type="checkbox"
                checked={recordLossInFinance}
                onChange={(e) => setRecordLossInFinance(e.target.checked)}
                className="rounded accent-rose-500"
              />
              تقييد قيمة التالف/العجز ({Math.abs(financialImpact).toFixed(2)}{" "}
              ر.س) كخسارة مخزنية في قائمة الدخل المالية
            </label>
          )}

          {/* معاينة الأثر المحاسبي والمخزني للتسوية */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              financialImpact < 0
                ? "bg-rose-950/40 border-rose-800 text-rose-200"
                : financialImpact > 0
                  ? "bg-emerald-950/40 border-emerald-800 text-emerald-200"
                  : "bg-slate-950 border-slate-800 text-slate-400"
            }`}
          >
            <div className="flex items-center gap-2">
              {financialImpact < 0 ? (
                <Flame className="w-4 h-4 text-rose-400" />
              ) : financialImpact > 0 ? (
                <Scale className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-slate-500" />
              )}
              <div>
                <div className="font-bold">
                  صافي الفارق:{" "}
                  <span className="font-mono">
                    {diffPacks > 0 ? `+${diffPacks}` : diffPacks} علبة (إجمالي{" "}
                    {diffStrips > 0 ? `+${diffStrips}` : diffStrips} شريط)
                  </span>
                </div>
                <div className="text-[10px] opacity-80">
                  محسوب على أساس التكلفة المرجحة (
                  {product.weightedCostPrice.toFixed(2)} ر.س/علبة)
                </div>
              </div>
            </div>

            <div className="text-left">
              <div className="text-[10px]">الأثر المالي بالتكلفة</div>
              <div className="font-mono font-extrabold text-sm">
                {financialImpact > 0
                  ? `+${financialImpact.toFixed(2)}`
                  : financialImpact.toFixed(2)}{" "}
                ر.س
              </div>
            </div>
          </div>
        </div>

        {/* أزرار الاعتماد */}
        <div className="p-4 bg-slate-800 border-t border-slate-700 flex gap-2">
          <button
            type="submit"
            disabled={diffStrips === 0}
            className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
          >
            <ClipboardCheck className="w-4 h-4" /> اعتماد تسوية الجرد وتحديث
            الرصيد
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
};
