import React, { forwardRef } from "react";
import { ProductEntity } from "../../domain/entities";
import { Search, Repeat } from "lucide-react";

interface Props {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchEnter: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  products: ProductEntity[];
  onAddToCart: (product: ProductEntity, unit: "pack" | "strip") => void;
  onShowAlternatives: (product: ProductEntity) => void;
  invoiceMode: "SALE" | "RETURN";
}

export const ProductCatalog = forwardRef<HTMLInputElement, Props>(
  (
    {
      searchQuery,
      onSearchChange,
      onSearchEnter,
      products,
      onAddToCart,
      onShowAlternatives,
      invoiceMode,
    },
    ref,
  ) => {
    return (
      <div className="w-7/12 p-4 flex flex-col border-l border-slate-800">
        {/* حقل البحث */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          <input
            ref={ref}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={onSearchEnter}
            placeholder="ابحث بالباركود، الاسم التجاري، أو المادة الفعالة... (F2)"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pr-10 pl-12 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
          />
          <span className="absolute left-3 top-2.5 bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-mono">
            F2
          </span>
        </div>

        {/* جدول الأدوية */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40 no-scrollbar">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-800/90 sticky top-0 text-slate-400 border-b border-slate-700">
              <tr>
                <th className="py-2.5 px-3">الباركود</th>
                <th className="py-2.5 px-3">الدواء والمادة الفعالة</th>
                <th className="py-2.5 px-3">الرصيد</th>
                <th className="py-2.5 px-3">سعر العلبة</th>
                <th className="py-2.5 px-3 text-center">إدراج</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-slate-500 py-10">
                    لا توجد نتائج مطابقة — جرّب الباركود أو المادة الفعالة
                  </td>
                </tr>
              )}
              {products.map((p) => {
                const outOfStock =
                  p.stockPacks === 0 && p.stockLooseStrips === 0;
                return (
                  <tr key={p.id} className="hover:bg-slate-800/50 transition">
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {p.barcode}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        {p.name}
                        {p.isControlled && (
                          <span className="bg-rose-950 text-rose-300 border border-rose-800 text-[10px] px-1.5 rounded">
                            مراقب 🔒
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {p.scientificName}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-bold ${
                          outOfStock
                            ? "text-rose-400"
                            : p.stockPacks <= p.minLimit
                              ? "text-amber-400"
                              : "text-slate-200"
                        }`}
                      >
                        {p.stockPacks} علبة
                        {p.stockLooseStrips > 0
                          ? ` + ${p.stockLooseStrips} شريط`
                          : ""}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                      {p.packPrice.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          disabled={outOfStock && invoiceMode === "SALE"}
                          onClick={() => onAddToCart(p, "pack")}
                          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white px-2.5 py-1 rounded text-[11px] font-bold"
                        >
                          علبة
                        </button>
                        <button
                          disabled={outOfStock && invoiceMode === "SALE"}
                          onClick={() => onAddToCart(p, "strip")}
                          className="bg-indigo-700 hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-500 text-white px-2.5 py-1 rounded text-[11px] font-bold"
                        >
                          شريط
                        </button>
                        <button
                          onClick={() => onShowAlternatives(p)}
                          title="البدائل العلمية (F4)"
                          className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-1.5 py-1 rounded"
                        >
                          <Repeat className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  },
);
