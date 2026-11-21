import React, { forwardRef, useMemo } from "react";
import { ProductEntity } from "../../domain/entities";
import {
  buildLasaRiskGroupSet,
  parseLasaDisplay,
} from "../../domain/utils/lasaFormatter";
import { ProductSearchInput } from "./common/ProductSearchInput";
import { Repeat, AlertTriangle } from "lucide-react";

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

    // اكتشاف مجموعات الأدوية المتشابهة اسماً (LASA) ضمن النتائج المعروضة حالياً
    const lasaRiskGroups = useMemo(
      () => buildLasaRiskGroupSet(products),
      [products],
    );

    return (
      <div className="w-7/12 p-4 flex flex-col border-l border-slate-800">
        {/* حقل البحث الضبابي والصوتي الموحّد */}
        <ProductSearchInput
          ref={ref}
          value={searchQuery}
          onChange={onSearchChange}
          onKeyDown={onSearchEnter}
          resultsCount={products.length}
          accent="blue"
          inputBgClass="bg-slate-900"
          shortcutHint="F2"
          className="mb-3"
        />

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

                // تحليل عناصر التمييز البصري (LASA): العيارات، الصفات الفارقة، والشكل الصيدلاني
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
                      {/* السطر الرئيسي: الاسم الأساسي + شارات العيار الضخمة + الشكل الصيدلاني */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white text-[13px] tracking-tight">
                          {lasa.baseName}
                        </span>

                        {/* العيارات الدوائية بألوان متباينة وخط ضخم لمنع أخطاء الصرف */}
                        {lasa.strengths.map((strength) => (
                          <span
                            key={strength.text}
                            dir="ltr"
                            className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[12px] font-black font-mono tracking-wide ${strength.badgeClass}`}
                          >
                            {strength.text}
                          </span>
                        ))}

                        {/* الصفات الفارقة الحرجة (XR / Forte / Extra / أطفال...) */}
                        {lasa.modifiers.map((mod) => (
                          <span
                            key={mod}
                            className="inline-flex items-center px-1.5 py-0.5 rounded border bg-yellow-500/15 text-yellow-200 border-yellow-400/70 text-[11px] font-extrabold"
                          >
                            {mod}
                          </span>
                        ))}

                        {/* الشكل الصيدلاني (أقراص، شراب، حقن، كبسول...) */}
                        {lasa.dosageForm && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] ${lasa.dosageForm.badgeClass}`}
                          >
                            {lasa.dosageForm.label}
                          </span>
                        )}

                        {p.isControlled && (
                          <span className="bg-rose-950 text-rose-300 border border-rose-800 text-[10px] px-1.5 py-0.5 rounded font-bold">
                            مراقب 🔒
                          </span>
                        )}

                        {isTopSearchMatch && (
                          <span className="bg-sky-950 text-sky-300 border border-sky-700/80 text-[9px] font-mono px-1.5 py-0.5 rounded">
                            ↵ Enter
                          </span>
                        )}
                      </div>

                      {/* السطر الفرعي: المادة الفعالة + تنبيه LASA عند وجود أكثر من عيار لنفس الاسم */}
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>{p.scientificName}</span>
                        {isLasaRisk && (
                          <span
                            title="يوجد أكثر من عيار أو شكل صيدلاني لهذا الاسم في القائمة — تحقق من العيار قبل الصرف"
                            className="inline-flex items-center gap-1 bg-amber-950/90 border border-amber-600/70 text-amber-300 text-[9px] font-extrabold px-1.5 py-0.2 rounded"
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                            LASA
                          </span>
                        )}
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
