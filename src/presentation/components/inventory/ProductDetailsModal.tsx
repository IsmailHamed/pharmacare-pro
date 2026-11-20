import React, { useEffect, useMemo } from "react";
import { ProductEntity } from "../../../domain/entities";
import { usePosStore } from "../../../application/store/usePosStore";
import {
  X,
  Package,
  Barcode,
  ClipboardCheck,
  AlertTriangle,
  Flame,
  Clock,
  CheckCircle2,
  Layers,
  ShieldAlert,
  Trash2,
  ArchiveRestore,
} from "lucide-react";

interface Props {
  product: ProductEntity | null;
  isDeadStock?: boolean;
  isChildModalOpen?: boolean;
  onClose: () => void;
  onPrintBarcode: (product: ProductEntity) => void;
  onAdjustStock: (product: ProductEntity, batchId?: string) => void;
}

const getBatchRemainingDays = (expiryDate: string): number => {
  const expMs = new Date(expiryDate).getTime();
  if (Number.isNaN(expMs)) return 9999;
  return Math.ceil((expMs - Date.now()) / (1000 * 60 * 60 * 24));
};

/**
 * نافذة بطاقة تفاصيل الدواء والتشغيلات (FEFO)
 * تُفتح عند النقر على صف الدواء في جدول المخزون لتوحيد العرض والإجراءات دون ازدحام الصفوف
 */
export const ProductDetailsModal: React.FC<Props> = ({
  product,
  isDeadStock = false,
  isChildModalOpen = false,
  onClose,
  onPrintBarcode,
  onAdjustStock,
}) => {
  const canViewCost = usePosStore(
    (s) => s.currentUser?.permissions.canViewCostAndProfit ?? false,
  );
  const canAdjustStock = usePosStore(
    (s) => s.currentUser?.permissions.canAdjustStock ?? false,
  );

  // إغلاق النافذة بزر Escape فقط في حال عدم وجود نافذة فرعية مفتوحة فوقها
  useEffect(() => {
    if (!product || isChildModalOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [product, isChildModalOpen, onClose]);

  const sortedBatches = useMemo(() => {
    if (!product) return [];
    return [...(product.batches || [])].sort((a, b) =>
      a.expiryDate.localeCompare(b.expiryDate),
    );
  }, [product]);

  if (!product) return null;

  const stripsPerPack = Math.max(1, product.stripsPerPack);
  const stripPrice = Number((product.packPrice / stripsPerPack).toFixed(2));
  const profitMarginPercent = (
    ((product.packPrice - product.weightedCostPrice) /
      Math.max(0.01, product.weightedCostPrice)) *
    100
  ).toFixed(0);
  const totalStockValueAtCost = Number(
    (
      (product.stockPacks + product.stockLooseStrips / stripsPerPack) *
      product.weightedCostPrice
    ).toFixed(2),
  );

  const isLowStock = product.stockPacks <= product.minLimit;
  const activeBatchDays = sortedBatches
    .filter((b) => b.qtyPacks > 0)
    .map((b) => getBatchRemainingDays(b.expiryDate));
  const nearestDays =
    activeBatchDays.length > 0 ? Math.min(...activeBatchDays) : 9999;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40 p-4 text-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
        {/* رأس النافذة: هوية الدواء والشارات التحذيرية */}
        <div className="p-4 bg-slate-800/90 border-b border-slate-700 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Package className="w-4 h-4 text-amber-400 shrink-0" />
              <h3 className="font-extrabold text-white text-sm">
                {product.name}
              </h3>
              <span className="font-mono text-[10.5px] bg-slate-950 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-md">
                {product.barcode}
              </span>
              <span className="text-[10px] bg-slate-900 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                {product.category || "عام"}
              </span>
            </div>

            <div className="text-slate-400 text-[11px]">
              المادة الفعالة:{" "}
              <b className="text-slate-200">{product.scientificName}</b>
            </div>

            {/* شارات الحالة السريعة */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {product.isControlled && (
                <span className="inline-flex items-center gap-1 bg-rose-950 border border-rose-700 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <ShieldAlert className="w-3 h-3" /> دواء مراقب / نفسي
                </span>
              )}
              {isLowStock && (
                <span className="inline-flex items-center gap-1 bg-sky-950 border border-sky-700 text-sky-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" /> نواقص (حد الطلب:{" "}
                  {product.minLimit})
                </span>
              )}
              {nearestDays <= 0 && (
                <span className="inline-flex items-center gap-1 bg-rose-950 border border-rose-600 text-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <Flame className="w-3 h-3 text-rose-400" /> تشغيلة منتهية
                  الصلاحية
                </span>
              )}
              {nearestDays > 0 && nearestDays <= 30 && (
                <span className="inline-flex items-center gap-1 bg-rose-950 border border-rose-700 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <Flame className="w-3 h-3" /> صلاحية حرجة ({nearestDays} يوم)
                </span>
              )}
              {nearestDays > 30 && nearestDays <= 90 && (
                <span className="inline-flex items-center gap-1 bg-orange-950 border border-orange-700 text-orange-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" /> صلاحية قريبة ({nearestDays} يوم)
                </span>
              )}
              {isDeadStock && (
                <span className="inline-flex items-center gap-1 bg-purple-950 border border-purple-700 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <ArchiveRestore className="w-3 h-3" /> راكد (لم يُبع آخر 60
                  يوماً)
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="إغلاق (Esc)"
            className="text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-700 p-1.5 rounded-lg transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* جسم النافذة القابل للتمرير */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* بطاقات الملخص المالي والمخزني */}
          <div
            className={`grid gap-3 ${
              canViewCost
                ? "grid-cols-2 md:grid-cols-4"
                : "grid-cols-2 md:grid-cols-3"
            }`}
          >
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <div className="text-[10px] text-slate-400">الرصيد المتاح</div>
              <div
                className={`font-mono font-extrabold text-sm mt-0.5 ${
                  product.stockPacks === 0
                    ? "text-rose-400"
                    : isLowStock
                      ? "text-amber-400"
                      : "text-white"
                }`}
              >
                {product.stockPacks} علبة
                {product.stockLooseStrips > 0 && (
                  <span className="text-xs text-sky-400 mr-1">
                    + {product.stockLooseStrips} شريط
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                حد الطلب: <b className="font-mono">{product.minLimit}</b> •{" "}
                {stripsPerPack > 1
                  ? `${stripsPerPack} أشرطة/علبة`
                  : "علبة كاملة فقط"}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <div className="text-[10px] text-slate-400">
                سعر البيع للجمهور
              </div>
              <div className="font-mono font-extrabold text-sm text-emerald-400 mt-0.5">
                {product.packPrice.toFixed(2)} ر.س
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {stripsPerPack > 1
                  ? `سعر الشريط: ${stripPrice.toFixed(2)} ر.س`
                  : "وحدة بيع غير مجزأة"}
              </div>
            </div>

            {canViewCost ? (
              <>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <div className="text-[10px] text-slate-400">
                    التكلفة المرجحة والهامش
                  </div>
                  <div className="font-mono font-extrabold text-sm text-amber-400 mt-0.5">
                    {product.weightedCostPrice.toFixed(2)} ر.س
                  </div>
                  <div className="text-[10px] text-sky-400 font-mono mt-0.5">
                    هامش الربح: {profitMarginPercent}%
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <div className="text-[10px] text-slate-400">
                    قيمة المخزون بالتكلفة
                  </div>
                  <div className="font-mono font-extrabold text-sm text-purple-300 mt-0.5">
                    {totalStockValueAtCost.toFixed(2)} ر.س
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    عدد التشغيلات: {sortedBatches.length}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] text-slate-400">
                  التشغيلات المسجلة
                </div>
                <div className="font-mono font-extrabold text-sm text-white mt-0.5">
                  {sortedBatches.length} تشغيلة
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  نشطة برصيد:{" "}
                  {sortedBatches.filter((b) => b.qtyPacks > 0).length}
                </div>
              </div>
            )}
          </div>

          {/* جدول التشغيلات والصلاحيات (FEFO) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-sky-400" />
                جدول التشغيلات وتواريخ الصلاحية (مرتبة حسب FEFO)
              </h4>
              <span className="text-[10.5px] text-slate-400">
                يُصرف تلقائياً من التشغيلة الأقدم صلاحية أولاً
              </span>
            </div>

            {sortedBatches.length === 0 ? (
              <div className="py-8 text-center text-slate-500 bg-slate-950 border border-slate-800 rounded-xl">
                لا توجد تشغيلات مسجلة لهذا الصنف حالياً.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-right text-[11px]">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10.5px]">
                    <tr>
                      <th className="py-2 px-3">رقم التشغيلة (Batch)</th>
                      <th className="py-2 px-3">تاريخ الانتهاء</th>
                      <th className="py-2 px-3">حالة الصلاحية</th>
                      <th className="py-2 px-3 text-center">الرصيد</th>
                      {canAdjustStock && (
                        <th className="py-2 px-3 text-left">إجراء</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 bg-slate-950/50">
                    {sortedBatches.map((batch) => {
                      const days = getBatchRemainingDays(batch.expiryDate);
                      const isExpired = days <= 0;
                      const isCritical = days > 0 && days <= 30;
                      const isWarning90 = days > 30 && days <= 90;
                      const isWarning180 = days > 90 && days <= 180;

                      return (
                        <tr
                          key={batch.id}
                          className="hover:bg-slate-800/40 transition"
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-white">
                            {batch.batchNumber}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">
                            {batch.expiryDate}
                          </td>
                          <td className="py-2.5 px-3">
                            {batch.qtyPacks <= 0 ? (
                              <span className="text-[10px] text-slate-500 font-bold">
                                مستنفدة (0)
                              </span>
                            ) : isExpired ? (
                              <span className="inline-flex items-center gap-1 bg-rose-950 border border-rose-700 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                <Flame className="w-3 h-3" /> منتهية الصلاحية
                              </span>
                            ) : isCritical ? (
                              <span className="inline-flex items-center gap-1 bg-rose-950/80 border border-rose-800 text-rose-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                                <Flame className="w-3 h-3" /> {days} يوم (حرج)
                              </span>
                            ) : isWarning90 ? (
                              <span className="inline-flex items-center gap-1 bg-orange-950/80 border border-orange-800 text-orange-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                                <Clock className="w-3 h-3" /> {days} يوم
                              </span>
                            ) : isWarning180 ? (
                              <span className="inline-flex items-center gap-1 bg-amber-950/70 border border-amber-800 text-amber-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                                <Clock className="w-3 h-3" /> {days} يوم
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" /> صالحة (
                                {days} يوم)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-white">
                            {batch.qtyPacks} علبة
                          </td>
                          {canAdjustStock && (
                            <td className="py-2.5 px-3 text-left">
                              {batch.qtyPacks > 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onAdjustStock(product, batch.id)
                                  }
                                  className={`px-2.5 py-1 rounded-lg font-bold text-[10.5px] inline-flex items-center gap-1 border transition ${
                                    isExpired || isCritical
                                      ? "bg-rose-950/70 hover:bg-rose-700 border-rose-700 text-rose-200 hover:text-white"
                                      : "bg-slate-800 hover:bg-amber-600 border-slate-700 text-slate-200 hover:text-white"
                                  }`}
                                >
                                  {isExpired ? (
                                    <>
                                      <Trash2 className="w-3 h-3" /> إعدام
                                      التشغيلة
                                    </>
                                  ) : (
                                    <>
                                      <ClipboardCheck className="w-3 h-3" />{" "}
                                      تسوية الدفعة
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* شريط الإجراءات السفلي */}
        <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {canAdjustStock && (
              <button
                type="button"
                onClick={() => onAdjustStock(product)}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow transition"
              >
                <ClipboardCheck className="w-4 h-4" />
                تسوية جرد / تالف
              </button>
            )}

            <button
              type="button"
              onClick={() => onPrintBarcode(product)}
              className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow transition"
            >
              <Barcode className="w-4 h-4" />
              طباعة لصاقة باركود
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
