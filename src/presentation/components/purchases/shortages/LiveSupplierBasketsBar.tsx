import React from "react";
import { LiveSupplierBasket } from "./shortages.config";
import {
  Building2,
  Check,
  ClipboardCheck,
  Copy,
  ShoppingBasket,
} from "lucide-react";

interface Props {
  baskets: LiveSupplierBasket[];
  activeSupplierFilter: string;
  canViewCost: boolean;
  creatingOrders: boolean;
  copiedBasketId: string | null;
  onToggleSupplierFilter: (supplierId: string) => void;
  onCreateBasket: (basket: LiveSupplierBasket) => void;
  onCopyBasket: (basket: LiveSupplierBasket) => void;
}

/**
 * بطاقات ملخّص حيّة لسلّات المستودعات (Live Supplier Baskets)
 * تتيح التصفية السريعة على أي مستودع، أو اعتماد سلّته كأمر شراء مستقل، أو نسخ نص طلبيته.
 */
export const LiveSupplierBasketsBar: React.FC<Props> = ({
  baskets,
  activeSupplierFilter,
  canViewCost,
  creatingOrders,
  copiedBasketId,
  onToggleSupplierFilter,
  onCreateBasket,
  onCopyBasket,
}) => {
  if (baskets.length === 0) return null;

  return (
    <div className="bg-indigo-950/20 border border-indigo-800/60 rounded-xl p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-indigo-200 font-bold text-xs">
          <ShoppingBasket className="w-4 h-4 text-indigo-400" />
          <span>
            سلّات المستودعات الجاهزة للاعتماد (
            <span className="font-mono text-white">{baskets.length}</span>)
          </span>
        </div>
        <span className="text-[10.5px] text-slate-400">
          اضغط على اسم المستودع لتصفية الجدول، أو اعتمد سلّة كل مستودع بشكل
          مستقل
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {baskets.map((basket) => {
          const isFocused = activeSupplierFilter === basket.supplier.id;
          const isCopiedBasket = copiedBasketId === basket.supplier.id;

          return (
            <div
              key={basket.supplier.id}
              className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 transition ${
                isFocused
                  ? "bg-indigo-950/60 border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.16)]"
                  : "bg-slate-950/85 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onToggleSupplierFilter(basket.supplier.id)}
                  className="text-right group min-w-0"
                  title={
                    isFocused
                      ? "إلغاء التصفية بهذا المستودع"
                      : "تصفية الجدول على أصناف هذا المستودع"
                  }
                >
                  <div className="font-bold text-white group-hover:text-indigo-300 flex items-center gap-1.5 truncate transition">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">{basket.supplier.name}</span>
                  </div>
                  <div className="text-[10.5px] text-slate-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{basket.itemsCount} صنف</span>
                    <span>•</span>
                    <span>{basket.totalPacks} علبة</span>
                    {canViewCost && (
                      <>
                        <span>•</span>
                        <b className="text-amber-300">
                          {basket.estimatedTotal.toFixed(2)} ر.س
                        </b>
                      </>
                    )}
                  </div>
                </button>

                {isFocused && (
                  <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-indigo-600/30 border border-indigo-500/60 text-indigo-200 shrink-0">
                    معروض
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  disabled={creatingOrders}
                  onClick={() => onCreateBasket(basket)}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold py-1.5 px-2.5 rounded-lg text-[11px] inline-flex items-center justify-center gap-1 transition"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  اعتماد الأمر
                </button>

                <button
                  type="button"
                  onClick={() => onCopyBasket(basket)}
                  className="bg-slate-800 hover:bg-emerald-700 border border-slate-700 hover:border-emerald-600 text-slate-200 hover:text-white font-bold py-1.5 px-2.5 rounded-lg text-[11px] inline-flex items-center gap-1 transition"
                >
                  {isCopiedBasket ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      نُسخ
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      نسخ
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
