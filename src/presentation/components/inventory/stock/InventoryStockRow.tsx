import React from "react";
import { ProductEntity } from "../../../../domain/entities";
import { InventorySortKey, NearestExpiryInfo } from "./inventoryStock.config";
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  Flame,
  ShieldAlert,
} from "lucide-react";

interface Props {
  product: ProductEntity;
  isHighlighted: boolean;
  isDeadStock: boolean;
  expiryInfo: NearestExpiryInfo;
  canViewCost: boolean;
  canAdjustStock: boolean;
  isColumnVisible: (id: InventorySortKey) => boolean;
  setRowRef: (productId: string, el: HTMLTableRowElement | null) => void;
  onOpenDetails: (productId: string) => void;
  onAdjustStock: (product: ProductEntity) => void;
}

/**
 * صف دواء مفرد داخل جدول المخزون ورادار الصلاحيات (FEFO)
 */
export const InventoryStockRow: React.FC<Props> = ({
  product: p,
  isHighlighted,
  isDeadStock,
  expiryInfo,
  canViewCost,
  canAdjustStock,
  isColumnVisible,
  setRowRef,
  onOpenDetails,
  onAdjustStock,
}) => {
  const isLowStock = p.stockPacks <= p.minLimit;
  const profitMarginPercent = (
    ((p.packPrice - p.weightedCostPrice) /
      Math.max(0.01, p.weightedCostPrice)) *
    100
  ).toFixed(0);
  const stripsPerPack = Math.max(1, p.stripsPerPack);

  return (
    <tr
      ref={(el) => setRowRef(p.id, el)}
      onClick={() => onOpenDetails(p.id)}
      className={`cursor-pointer transition ${
        isHighlighted
          ? "bg-amber-950/25"
          : "bg-slate-950/40 hover:bg-slate-800/60"
      }`}
    >
      {/* الاسم والمادة الفعالة والباركود */}
      {isColumnVisible("name") && (
        <td className="py-3 px-3">
          <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
            <span>{p.name}</span>
            {p.isControlled && (
              <span
                title="دواء مراقب / نفسي"
                className="inline-flex items-center gap-0.5 text-[9.5px] bg-rose-950 border border-rose-800 text-rose-300 px-1.5 py-0.2 rounded-full"
              >
                <ShieldAlert className="w-2.5 h-2.5" /> مراقب
              </span>
            )}
            {isDeadStock && (
              <span className="text-[9.5px] bg-purple-950 border border-purple-800 text-purple-300 px-1.5 py-0.2 rounded-full">
                راكد
              </span>
            )}
          </div>
          <div className="text-[10.5px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{p.scientificName}</span>
            <span className="font-mono text-slate-500">• {p.barcode}</span>
          </div>
        </td>
      )}

      {/* التصنيف */}
      {isColumnVisible("category") && (
        <td className="py-3 px-3">
          <span className="text-[10.5px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded-md">
            {p.category || "عام"}
          </span>
        </td>
      )}

      {/* الرصيد المتاح */}
      {isColumnVisible("stockPacks") && (
        <td className="py-3 px-3 text-center">
          <div
            className={`font-mono font-extrabold ${
              p.stockPacks === 0
                ? "text-rose-400"
                : isLowStock
                  ? "text-amber-400"
                  : "text-white"
            }`}
          >
            {p.stockPacks} علبة
            {p.stockLooseStrips > 0 && (
              <span className="text-[10.5px] text-sky-400 mr-1">
                +{p.stockLooseStrips} ش
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {isLowStock ? (
              <span className="text-sky-400 font-sans font-bold">
                تحت الحد ({p.minLimit})
              </span>
            ) : (
              `الحد: ${p.minLimit}`
            )}
          </div>
        </td>
      )}

      {/* أقرب صلاحية (FEFO) */}
      {isColumnVisible("nearestExpiry") && (
        <td className="py-3 px-3">
          {!expiryInfo.expiryDate ? (
            <span className="text-[11px] text-slate-500">—</span>
          ) : (
            <div className="space-y-0.5">
              <div>
                {expiryInfo.days <= 0 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-950 border border-rose-700 text-rose-300 px-2 py-0.5 rounded-full">
                    <Flame className="w-3 h-3" /> منتهية الصلاحية
                  </span>
                ) : expiryInfo.days <= 30 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-rose-950/80 border border-rose-800 text-rose-300 px-2 py-0.5 rounded-full">
                    <Flame className="w-3 h-3" /> {expiryInfo.days} يوم
                  </span>
                ) : expiryInfo.days <= 90 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-orange-950/80 border border-orange-800 text-orange-300 px-2 py-0.5 rounded-full">
                    <Clock className="w-3 h-3" /> {expiryInfo.days} يوم
                  </span>
                ) : expiryInfo.days <= 180 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-amber-950/70 border border-amber-800 text-amber-300 px-2 py-0.5 rounded-full">
                    <Clock className="w-3 h-3" /> {expiryInfo.days} يوم
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-emerald-950/50 border border-emerald-800 text-emerald-300 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> {expiryInfo.expiryDate}
                  </span>
                )}
              </div>
              <div className="text-[10px] font-mono text-slate-500">
                {expiryInfo.days <= 180 ? `${expiryInfo.expiryDate} • ` : ""}
                {expiryInfo.activeBatchesCount} تشغيلة
              </div>
            </div>
          )}
        </td>
      )}

      {/* سعر البيع */}
      {isColumnVisible("packPrice") && (
        <td className="py-3 px-3 text-center">
          <div className="font-mono font-extrabold text-emerald-400">
            {p.packPrice.toFixed(2)}
          </div>
          {stripsPerPack > 1 && (
            <div className="text-[10px] font-mono text-slate-500">
              الشريط: {(p.packPrice / stripsPerPack).toFixed(2)}
            </div>
          )}
        </td>
      )}

      {/* التكلفة والهامش (محمي بصلاحية canViewCostAndProfit) */}
      {canViewCost && isColumnVisible("weightedCostPrice") && (
        <td className="py-3 px-3 text-center">
          <div className="font-mono font-bold text-amber-400">
            {p.weightedCostPrice.toFixed(2)}
          </div>
          <div className="text-[10px] font-mono text-sky-400">
            +{profitMarginPercent}%
          </div>
        </td>
      )}

      {/* إجراءات مدمجة غير مزدحمة */}
      <td className="py-3 px-3">
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails(p.id);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-[11px] inline-flex items-center gap-1 transition"
          >
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            التفاصيل
          </button>

          {canAdjustStock && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAdjustStock(p);
              }}
              title="تسوية جرد / تالف سريعة"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-600 border border-slate-700 text-amber-400 hover:text-white transition"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
