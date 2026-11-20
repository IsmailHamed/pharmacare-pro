import React, { forwardRef } from "react";
import { ProductEntity } from "../../domain/entities";
import { Search, Repeat, X, Sparkles } from "lucide-react";

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
    const hasQuery = searchQuery.trim().length > 0;

    return (
      <div className="w-7/12 p-4 flex flex-col border-l border-slate-800">
        {/* حقل البحث الضبابي والصوتي الذكي */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          <input
            ref={ref}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={onSearchEnter}
            placeholder="ابحث بالباركود أو الاسم والعيار معاً (مثلاً: pan 500 أو اموكس 1g) أو المادة الفعالة... (F2)"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pr-10 pl-32 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
          />

          <div className="absolute left-2.5 top-2 flex items-center gap-1.5">
            {hasQuery && (
              <>
                <span className="bg-sky-950/90 border border-sky-800/80 text-sky-300 px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  {products.length}
                </span>
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  title="مسح البحث"
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-1 rounded transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            )}
            <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-mono">
              F2
            </span>
          </div>
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
                    لا توجد نتائج مطابقة لـ «{searchQuery.trim()}» — جرّب الاسم
                    مع العيار (مثل: pan 500) أو الباركود أو المادة الفعالة
                  </td>
                </tr>
              )}
              {products.map((p, idx) => {
                const outOfStock =
                  p.stockPacks === 0 && p.stockLooseStrips === 0;
                const isTopSearchMatch = hasQuery && idx === 0;

                return (
                  <tr
                    key={p.id}
                    className={`transition ${
                      isTopSearchMatch
                        ? "bg-sky-950/35 hover:bg-sky-950/50"
                        : "hover:bg-slate-800/50"
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {p.barcode}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                        {p.name}
                        {p.isControlled && (
                          <span className="bg-rose-950 text-rose-300 border border-rose-800 text-[10px] px-1.5 rounded">
                            مراقب 🔒
                          </span>
                        )}
                        {isTopSearchMatch && (
                          <span className="bg-sky-950 text-sky-300 border border-sky-700/80 text-[9px] font-mono px-1.5 py-0.2 rounded">
                            ↵ Enter
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
