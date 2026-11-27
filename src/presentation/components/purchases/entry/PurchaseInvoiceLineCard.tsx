import React from "react";
import { ProductEntity } from "../../../../domain/entities";
import { WeightedCostCalculation } from "../../../../application/use-cases/AddPurchaseWithBonus";
import { DrugIdentityBadges } from "../../common/DrugIdentityBadges";
import { Trash2 } from "lucide-react";

export interface PurchaseDraftLine {
  uid: string;
  productId: string;
  batchNumber: string;
  expiryDate: string;
  purchasedPacks: number;
  bonusPacks: number;
  purchasePricePerPack: number;
  newPackSalePrice: number;
}

interface Props {
  line: PurchaseDraftLine;
  product: ProductEntity;
  calc: WeightedCostCalculation | null;
  displayIndex: number;
  isLatest: boolean;
  inputCls: string;
  setBatchInputRef: (uid: string, el: HTMLInputElement | null) => void;
  onUpdateLine: (uid: string, patch: Partial<PurchaseDraftLine>) => void;
  onRemoveLine: (uid: string) => void;
}

/**
 * بطاقة بند دوائي مفرد داخل فاتورة الشراء تعرض التكلفة المرجحة الجديدة وتدعم البونص وسعر البيع الجديد
 */
export const PurchaseInvoiceLineCard: React.FC<Props> = ({
  line,
  product,
  calc,
  displayIndex,
  isLatest,
  inputCls,
  setBatchInputRef,
  onUpdateLine,
  onRemoveLine,
}) => (
  <div
    className={`bg-slate-950 border rounded-xl p-3.5 space-y-3 transition ${
      isLatest
        ? "border-indigo-500/80 shadow-[0_0_12px_rgba(99,102,241,0.12)]"
        : "border-slate-800"
    }`}
  >
    <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-800/80 pb-2">
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <span className="font-mono text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
          #{displayIndex}
        </span>
        <DrugIdentityBadges
          name={product.name}
          category={product.category}
          isControlled={product.isControlled}
          size="sm"
        />
        <span className="text-[10.5px] text-slate-400">
          — {product.scientificName}
        </span>
        <span className="font-mono text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
          {product.barcode}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[10.5px] text-slate-400 font-mono">
          الرصيد الحالي:{" "}
          <b className="text-slate-200">{product.stockPacks} علبة</b>
        </span>
        {calc && (
          <span className="text-[10.5px] bg-amber-950/50 border border-amber-800/70 text-amber-300 px-2 py-0.5 rounded-lg font-mono">
            تكلفة مرجحة جديدة: <b>{calc.newWeightedCostPrice.toFixed(2)}</b> ر.س
          </span>
        )}
        {calc && (
          <span className="text-[11px] font-mono font-extrabold text-white">
            {calc.lineTotalCost.toFixed(2)} ر.س
          </span>
        )}
        <button
          type="button"
          onClick={() => onRemoveLine(line.uid)}
          title="حذف البند من الفاتورة"
          className="bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-rose-200 rounded-lg p-1.5 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 items-end">
      <div>
        <label className="block text-slate-400 mb-1 text-[10.5px]">
          رقم التشغيلة (Batch) *
        </label>
        <input
          ref={(el) => setBatchInputRef(line.uid, el)}
          type="text"
          value={line.batchNumber}
          onChange={(e) =>
            onUpdateLine(line.uid, { batchNumber: e.target.value })
          }
          className={`${inputCls} font-mono`}
          placeholder="BATCH-01"
        />
      </div>

      <div>
        <label className="block text-slate-400 mb-1 text-[10.5px]">
          تاريخ الصلاحية *
        </label>
        <input
          type="date"
          value={line.expiryDate}
          onChange={(e) =>
            onUpdateLine(line.uid, { expiryDate: e.target.value })
          }
          className={`${inputCls} font-mono`}
        />
      </div>

      <div>
        <label className="block text-slate-400 mb-1 text-[10.5px]">
          الكمية المشتراة (علبة)
        </label>
        <input
          type="number"
          min={0}
          value={line.purchasedPacks}
          onChange={(e) =>
            onUpdateLine(line.uid, {
              purchasedPacks: Math.max(0, Number(e.target.value) || 0),
            })
          }
          className={`${inputCls} font-mono text-center font-bold`}
        />
      </div>

      <div>
        <label className="block text-emerald-400 font-bold mb-1 text-[10.5px]">
          + بونص مجاني
        </label>
        <input
          type="number"
          min={0}
          value={line.bonusPacks}
          onChange={(e) =>
            onUpdateLine(line.uid, {
              bonusPacks: Math.max(0, Number(e.target.value) || 0),
            })
          }
          className="w-full bg-emerald-950 border border-emerald-800 rounded-lg p-2 text-emerald-300 font-mono font-bold text-center outline-none focus:border-emerald-500"
        />
      </div>

      <div>
        <label className="block text-slate-400 mb-1 text-[10.5px]">
          سعر شراء العلبة
        </label>
        <input
          type="number"
          min={0}
          step="0.01"
          value={line.purchasePricePerPack}
          onChange={(e) =>
            onUpdateLine(line.uid, {
              purchasePricePerPack: Math.max(0, Number(e.target.value) || 0),
            })
          }
          className={`${inputCls} font-mono text-center font-bold`}
        />
      </div>

      <div>
        <label className="block text-slate-400 mb-1 text-[10.5px]">
          سعر بيع جديد (اختياري)
        </label>
        <input
          type="number"
          min={0}
          step="0.01"
          value={line.newPackSalePrice > 0 ? line.newPackSalePrice : ""}
          onChange={(e) =>
            onUpdateLine(line.uid, {
              newPackSalePrice: Math.max(0, Number(e.target.value) || 0),
            })
          }
          placeholder={`الحالي: ${product.packPrice.toFixed(2)}`}
          className={`${inputCls} font-mono text-center`}
        />
      </div>
    </div>
  </div>
);
