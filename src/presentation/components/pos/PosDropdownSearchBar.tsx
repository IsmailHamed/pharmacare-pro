import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ProductEntity } from "../../../domain/entities";
import {
  buildLasaRiskGroupSet,
  parseLasaDisplay,
} from "../../../domain/utils/lasaFormatter";
import { ProductSearchInput } from "../common/ProductSearchInput";
import { DrugIdentityBadges } from "../common/DrugIdentityBadges";
import { CornerDownLeft, Repeat } from "lucide-react";

interface Props {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  // معالج الإدخال المباشر للباركود أو رقم فاتورة (INV- / -S) أو تنبيه عدم وجود تطابق
  onDirectSearchEnter: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  // قائمة المنتجات المفلترة بالفعل عبر المحرك الضبابي والصوتي في POSView
  products: ProductEntity[];
  allProducts: ProductEntity[];
  onAddToCart: (product: ProductEntity, unit: "pack" | "strip") => void;
  onShowAlternatives: (product: ProductEntity) => void;
  // إبلاغ POSView بالصنف المظلل حالياً ليتمكن اختصار F4 من فتح بدائله عند فراغ السلة
  onHighlightedProductChange?: (product: ProductEntity | null) => void;
  invoiceMode: "SALE" | "RETURN";
  // زر تبديل وضع العرض (مقسوم / منسدل) يُعرض بجانب شريط البحث دون استهلاك ارتفاع إضافي
  layoutToggle?: React.ReactNode;
}

/**
 * شريط البحث المنسدل الخاص بالوضع التركيزي في نقطة البيع (POS Dropdown Mode)
 * يُخفي جدول الكتالوج الثابت ويعرض النتائج في قائمة عائمة فوق السلة الموسّعة
 */
export const PosDropdownSearchBar = forwardRef<HTMLInputElement, Props>(
  (
    {
      searchQuery,
      onSearchChange,
      onDirectSearchEnter,
      products,
      allProducts,
      onAddToCart,
      onShowAlternatives,
      onHighlightedProductChange,
      invoiceMode,
      layoutToggle,
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showEmptyList, setShowEmptyList] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const hasQuery = searchQuery.trim().length > 0;
    const shouldRenderDropdown = isOpen && (hasQuery || showEmptyList);

    // اكتشاف مجموعات الأدوية المتشابهة اسماً (LASA) ضمن النتائج المعروضة في القائمة المنسدلة
    const lasaRiskGroups = useMemo(
      () => buildLasaRiskGroupSet(products),
      [products],
    );

    // إعادة ضبط مؤشر الصف المظلّل للأول عند تغيّر عبارة البحث
    useEffect(() => {
      setActiveIndex(0);
    }, [searchQuery]);

    // ضمان بقاء المؤشر ضمن حدود القائمة إذا تغيّر عدد النتائج
    useEffect(() => {
      if (activeIndex >= products.length && products.length > 0) {
        setActiveIndex(0);
      }
    }, [products.length, activeIndex]);

    // إبلاغ الشاشة الأم بالصنف المظلّل حالياً لدعم اختصار البدائل العلمية (F4)
    useEffect(() => {
      if (!onHighlightedProductChange) return;
      const highlighted = shouldRenderDropdown
        ? (products[activeIndex] ?? products[0] ?? null)
        : null;
      onHighlightedProductChange(highlighted);
    }, [
      shouldRenderDropdown,
      products,
      activeIndex,
      onHighlightedProductChange,
    ]);

    // إغلاق القائمة المنسدلة تلقائياً عند النقر خارج حاوية البحث
    useEffect(() => {
      if (!isOpen) return;
      const handleClickOutside = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
          setShowEmptyList(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // تمرير الصف المظلّل تلقائياً داخل القائمة عند التنقل بالأسهم ↑ و ↓
    useEffect(() => {
      if (!shouldRenderDropdown || products.length === 0) return;
      const current = products[activeIndex];
      if (current) {
        itemRefs.current[current.id]?.scrollIntoView({ block: "nearest" });
      }
    }, [shouldRenderDropdown, products, activeIndex]);

    // إدراج الصنف المختار في السلة ثم تنظيف خانة البحث وإغلاق القائمة لكشف السلة كاملة
    const handlePickProduct = useCallback(
      (product: ProductEntity, unit: "pack" | "strip") => {
        onAddToCart(product, unit);
        onSearchChange("");
        setIsOpen(false);
        setShowEmptyList(false);
        setActiveIndex(0);
      },
      [onAddToCart, onSearchChange],
    );

    // إدارة اختصارات لوحة المفاتيح داخل خانة البحث المنسدلة
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          if (!hasQuery) setShowEmptyList(true);
          setActiveIndex(0);
          return;
        }
        if (products.length > 0) {
          setActiveIndex((prev) => (prev + 1) % products.length);
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (shouldRenderDropdown && products.length > 0) {
          setActiveIndex(
            (prev) => (prev - 1 + products.length) % products.length,
          );
        }
        return;
      }

      if (e.key === "Escape") {
        if (isOpen || showEmptyList) {
          e.preventDefault();
          setIsOpen(false);
          setShowEmptyList(false);
        }
        return;
      }

      if (e.key === "Enter") {
        const q = searchQuery.trim();

        // السماح باختيار الصف المظلل حتى لو فُتحت القائمة بالأسهم بدون كتابة
        if (!q) {
          if (shouldRenderDropdown && products[activeIndex]) {
            e.preventDefault();
            handlePickProduct(
              products[activeIndex],
              e.shiftKey ? "strip" : "pack",
            );
          }
          return;
        }

        // 1. أولوية لمسح الباركود المباشر أو باركود الشريط (-S) أو رقم فاتورة مرتجع (INV-)
        const isDirectScanQuery =
          q.toUpperCase().startsWith("INV-") ||
          q.toUpperCase().endsWith("-S") ||
          allProducts.some((p) => p.barcode.toLowerCase() === q.toLowerCase());

        if (isDirectScanQuery) {
          onDirectSearchEnter(e);
          setIsOpen(false);
          setShowEmptyList(false);
          return;
        }

        // 2. إدراج النتيجة المظللة حالياً (Enter للعلبة، و Shift+Enter للشريط)
        const picked = products[activeIndex] || products[0];
        if (picked) {
          e.preventDefault();
          handlePickProduct(picked, e.shiftKey ? "strip" : "pack");
        } else {
          // عند عدم وجود نتائج نمرّر الحدث للمعالج الأصلي لإطلاق النغمة التحذيرية والإشعار
          onDirectSearchEnter(e);
        }
      }
    };

    return (
      <div
        ref={containerRef}
        className="relative px-4 pt-3 pb-2 bg-slate-900/40 border-b border-slate-800 z-20"
      >
        {/* الصف العلوي: شريط البحث العريض + زر تبديل وضع العرض */}
        <div className="flex items-center gap-2">
          <ProductSearchInput
            ref={ref}
            value={searchQuery}
            onChange={(val) => {
              onSearchChange(val);
              if (val.trim().length > 0) {
                setIsOpen(true);
                setShowEmptyList(false);
              } else {
                setShowEmptyList(false);
                setIsOpen(false);
              }
            }}
            onFocus={() => {
              if (hasQuery) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            resultsCount={hasQuery ? products.length : undefined}
            accent="blue"
            inputBgClass="bg-slate-950"
            shortcutHint="F2"
            placeholder="امسح الباركود أو ابحث بالاسم والعيار (مثلاً: pan 500) — Enter علبة • Shift+Enter شريط • ↓ تصفح القائمة..."
            className="flex-1"
          />

          {layoutToggle}
        </div>

        {/* القائمة المنسدلة العائمة للنتائج فوق منطقة السلة */}
        {shouldRenderDropdown && (
          <div className="absolute left-4 right-4 top-full mt-1 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            {/* شريط إرشادي مختصر لأزرار الإدراج السريع */}
            <div className="px-3.5 py-1.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-[10.5px] text-slate-400 font-mono">
              <span>
                النتائج المعروضة:{" "}
                <b className="text-sky-400">{products.length}</b>
              </span>
              <span className="hidden sm:inline">
                ↑/↓ تنقل • Enter علبة • Shift+Enter شريط • F4 بدائل • Esc إغلاق
              </span>
            </div>

            {products.length === 0 ? (
              <div className="py-10 px-4 text-center text-slate-400 text-xs">
                لا توجد نتائج مطابقة لـ «{searchQuery.trim()}» — جرّب الاسم مع
                العيار (مثل: pan 500) أو الباركود أو المادة الفعالة.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/70">
                {products.map((p, idx) => {
                  const isActive = idx === activeIndex;
                  const outOfStock =
                    p.stockPacks === 0 && p.stockLooseStrips === 0;
                  const lasa = parseLasaDisplay(p.name, p.category);
                  const isLasaRisk =
                    lasa.lasaGroupKey.length >= 3 &&
                    lasaRiskGroups.has(lasa.lasaGroupKey);

                  return (
                    <div
                      key={p.id}
                      ref={(el) => {
                        itemRefs.current[p.id] = el;
                      }}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        if (outOfStock && invoiceMode === "SALE") return;
                        handlePickProduct(p, "pack");
                      }}
                      className={`px-4 py-2.5 flex items-center justify-between gap-3 transition cursor-pointer ${
                        isActive
                          ? "bg-sky-950/55"
                          : isLasaRisk
                            ? "bg-amber-950/10 hover:bg-amber-950/25"
                            : "hover:bg-slate-800/70"
                      } ${isLasaRisk ? "border-r-2 border-r-amber-500/80" : ""}`}
                    >
                      {/* هوية الدواء مع شارات العيار والشكل الصيدلاني وتنبيه LASA */}
                      <div className="min-w-0 flex-1">
                        <DrugIdentityBadges
                          name={p.name}
                          category={p.category}
                          isControlled={p.isControlled}
                          isLasaRisk={isLasaRisk}
                          isTopMatch={isActive}
                          size="md"
                        />
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>{p.scientificName}</span>
                          <span className="font-mono text-slate-500">
                            • {p.barcode}
                          </span>
                        </div>
                      </div>

                      {/* الرصيد والسعر وأزرار الإدراج السريع (علبة / شريط / بدائل) */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-left font-mono text-xs">
                          <div
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
                              ? ` + ${p.stockLooseStrips} ش`
                              : ""}
                          </div>
                          <div className="text-[11px] text-emerald-400 font-extrabold">
                            {p.packPrice.toFixed(2)} ر.س
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            disabled={outOfStock && invoiceMode === "SALE"}
                            onClick={() => handlePickProduct(p, "pack")}
                            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition"
                          >
                            {isActive && <CornerDownLeft className="w-3 h-3" />}
                            علبة
                          </button>
                          <button
                            type="button"
                            disabled={outOfStock && invoiceMode === "SALE"}
                            onClick={() => handlePickProduct(p, "strip")}
                            className="bg-indigo-700 hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition"
                          >
                            شريط
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              setShowEmptyList(false);
                              onShowAlternatives(p);
                            }}
                            title="البدائل العلمية (F4)"
                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 p-1.5 rounded-lg transition"
                          >
                            <Repeat className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);
