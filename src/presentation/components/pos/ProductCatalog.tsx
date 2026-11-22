import React, { forwardRef, useMemo } from "react";
import { ProductEntity } from "../../../domain/entities";
import {
  buildLasaRiskGroupSet,
  parseLasaDisplay,
} from "../../../domain/utils/lasaFormatter";
import { ProductSearchInput } from "../common/ProductSearchInput";
import { DrugIdentityBadges } from "../common/DrugIdentityBadges";
import { Repeat } from "lucide-react";

interface Props {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchEnter: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  products: ProductEntity[];
  onAddToCart: (product: ProductEntity, unit: "pack" | "strip") => void;
  onShowAlternatives: (product: ProductEntity) => void;
  invoiceMode: "SALE" | "RETURN";
  // زر تبديل وضع العرض (مقسوم / بحث منسدل) يُعرض بمحاذاة شريط البحث دون استهلاك ارتفاع إضافي
  layoutToggle?: React.ReactNode;
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
      layoutToggle,
    },
    ref,
  ) => {
    const hasQuery = searchQuery.trim().length > 0;

    // اكتشاف مجموعات الأدوية المتشابهة اسماً (LASA) ضمن النتائج المعروضة حالياً
    const lasaRiskGroups = useMemo(
      () => buildLasaRiskGroupSet(products),
      [products],
    );

    return (
      <div className="w-7/12 p-4 flex flex-col border-l border-slate-800">
        {/* صف شريط البحث الضبابي والصوتي الموحّد + زر التبديل إلى وضع البحث المنسدل */}
        <div className="flex items-center gap-2 mb-3">
          <ProductSearchInput
            ref={ref}
            value={searchQuery}
            onChange={onSearchChange}
            onKeyDown={onSearchEnter}
            resultsCount={products.length}
            accent="blue"
            inputBgClass="bg-slate-900"
            shortcutHint="F2"
            className="flex-1"
          />
          {layoutToggle}
        </div>

        {/* جدول الأدوية */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40 no-scrollbar">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-800/90 sticky top-0 text-slate-400 border-b border-slate-700 z-10">
              <tr>
                <th className="py-2.5 px-3">الباركود</th>
                <th className="py-2.5 px-3">الدواء والعيار والمادة الفعالة</th>
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

                // تحليل مفتاح مجموعة LASA لاكتشاف تشابه الأسماء وتلوين الصف للتحذير البصري
                const lasa = parseLasaDisplay(p.name, p.category);
                const isLasaRisk =
                  lasa.lasaGroupKey.length >= 3 &&
                  lasaRiskGroups.has(lasa.lasaGroupKey);

                return (
                  <tr
                    key={p.id}
                    className={`transition ${
                      isTopSearchMatch
                        ? "bg-sky-950/35 hover:bg-sky-950/50"
                        : isLasaRisk
                          ? "bg-amber-950/10 hover:bg-amber-950/25"
                          : "hover:bg-slate-800/50"
                    } ${isLasaRisk ? "border-r-2 border-r-amber-500/80" : ""}`}
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {p.barcode}
                    </td>

                    <td className="py-2.5 px-3">
                      {/* السطر الرئيسي: هوية الدواء وشارات العيارات والشكل الصيدلاني وتنبيه LASA */}
                      <DrugIdentityBadges
                        name={p.name}
                        category={p.category}
                        isControlled={p.isControlled}
                        isLasaRisk={isLasaRisk}
                        isTopMatch={isTopSearchMatch}
                        size="md"
                      />
                      {/* السطر الفرعي: المادة الفعالة */}
                      <div className="text-[11px] text-slate-400 mt-0.5">
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
