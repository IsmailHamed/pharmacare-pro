import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ProductEntity } from "../../../domain/entities";
import {
  buildProductSearchIndex,
  searchProductsFuzzy,
} from "../../../domain/utils/fuzzySearch";
import {
  buildLasaRiskGroupSet,
  parseLasaDisplay,
} from "../../../domain/utils/lasaFormatter";
import { SoundFeedbackService } from "../../../infrastructure/audio/SoundFeedbackService";
import { usePosStore } from "../../../application/store/usePosStore";
import { useBarcodeScanner } from "../../hooks/useBarcodeScanner";
import { ProductSearchInput, SearchAccent } from "./ProductSearchInput";
import { AlertTriangle, Barcode, CornerDownLeft, Plus } from "lucide-react";

interface Props {
  products: ProductEntity[];
  onSelectProduct: (product: ProductEntity) => void;
  onNotFound?: (rawQuery: string) => void;
  placeholder?: string;
  accent?: SearchAccent;
  inputBgClass?: string;
  showCost?: boolean;
  enableBarcodeScanner?: boolean;
  enableF2Shortcut?: boolean;
  maxResults?: number;
  actionLabel?: string;
  className?: string;
}

const normalizeBarcodeQuery = (raw: string): string => {
  const lower = raw.trim().toLowerCase();
  return lower.endsWith("-s") ? lower.slice(0, -2) : lower;
};

/**
 * مكوّن الالتقاط السريع للأدوية (باركود ليزري + بحث ضبابي وصوتي + شارات LASA)
 * مخصص لشاشات الإدخال السريع مثل فاتورة الشراء والبونص دون تقييد الأصناف ذات الرصيد 0
 */
export const ProductQuickPicker: React.FC<Props> = ({
  products,
  onSelectProduct,
  onNotFound,
  placeholder = "امسح الباركود أو ابحث بالاسم والعيار (مثلاً: pan 500 أو اموكس 1g) أو المادة الفعالة لإضافة بند... (F2)",
  accent = "indigo",
  inputBgClass = "bg-slate-950",
  showCost = false,
  enableBarcodeScanner = true,
  enableF2Shortcut = true,
  maxResults = 25,
  actionLabel = "إضافة",
  className = "",
}) => {
  const setNotification = usePosStore((s) => s.setNotification);
  const canViewCost = usePosStore(
    (s) => s.currentUser?.permissions.canViewCostAndProfit ?? false,
  );

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [showEmptyList, setShowEmptyList] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const hasQuery = query.trim().length > 0;

  // فهرسة الأدوية مرة واحدة عند تغيّر القائمة لضمان السرعة مع 10,000+ صنف
  const searchIndex = useMemo(
    () => buildProductSearchIndex(products),
    [products],
  );

  // خريطة باركود سريعة O(1) للالتقاط اللحظي من الماسح الليزري
  const barcodeMap = useMemo(() => {
    const map = new Map<string, ProductEntity>();
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const key = p.barcode.trim().toLowerCase();
      if (key) map.set(key, p);
    }
    return map;
  }, [products]);

  const results = useMemo(() => {
    if (!hasQuery && !showEmptyList) return [];
    return searchProductsFuzzy(searchIndex, query, maxResults);
  }, [searchIndex, query, hasQuery, showEmptyList, maxResults]);

  // كشف مجموعات LASA ضمن النتائج المعروضة حالياً
  const lasaRiskGroups = useMemo(
    () => buildLasaRiskGroupSet(results),
    [results],
  );

  const shouldRenderDropdown = isOpen && (hasQuery || showEmptyList);

  const notifyNotFound = useCallback(
    (rawCode: string) => {
      SoundFeedbackService.playWarningBuzzer();
      if (onNotFound) {
        onNotFound(rawCode);
        return;
      }
      setNotification({
        type: "warning",
        message: `لم يتم العثور على صنف دوائي مطابق لـ (${rawCode})`,
      });
    },
    [onNotFound, setNotification],
  );

  const handlePickProduct = useCallback(
    (product: ProductEntity) => {
      onSelectProduct(product);
      setQuery("");
      setIsOpen(false);
      setShowEmptyList(false);
      setActiveIndex(0);
    },
    [onSelectProduct],
  );

  // معالج قارئ الباركود الليزري العالمي للشاشة النشطة
  const handleHardwareScan = useCallback(
    (scannedCode: string): boolean => {
      const baseBarcode = normalizeBarcodeQuery(scannedCode);
      const exactProduct = barcodeMap.get(baseBarcode);
      if (exactProduct) {
        handlePickProduct(exactProduct);
        return true;
      }
      notifyNotFound(scannedCode.trim());
      return false;
    },
    [barcodeMap, handlePickProduct, notifyNotFound],
  );

  useBarcodeScanner(
    enableBarcodeScanner,
    () => {
      setQuery("");
      setIsOpen(false);
      setShowEmptyList(false);
    },
    handleHardwareScan,
  );

  // إعادة ضبط مؤشر الصف المظلّل عند تغيّر النص
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // إغلاق القائمة عند النقر خارجها
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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // اختصار F2 (أو / خارج حقول الإدخال) للتركيز السريع على خانة البحث
  useEffect(() => {
    if (!enableF2Shortcut) return;
    const handleGlobalFocus = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (e.key === "F2" || (e.key === "/" && !isEditable)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleGlobalFocus);
    return () => window.removeEventListener("keydown", handleGlobalFocus);
  }, [enableF2Shortcut]);

  // تمرير النتيجة المظللة تلقائياً عند التنقل بالأسهم
  useEffect(() => {
    if (!shouldRenderDropdown || results.length === 0) return;
    const current = results[activeIndex];
    if (current) {
      itemRefs.current[current.id]?.scrollIntoView({ block: "nearest" });
    }
  }, [shouldRenderDropdown, results, activeIndex]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        if (!hasQuery) setShowEmptyList(true);
        setActiveIndex(0);
        return;
      }
      if (results.length > 0) {
        setActiveIndex((prev) => (prev + 1) % results.length);
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (shouldRenderDropdown && results.length > 0) {
        setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
      }
      return;
    }

    if (e.key === "Escape") {
      if (isOpen || hasQuery) {
        e.preventDefault();
        setIsOpen(false);
        setShowEmptyList(false);
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = query.trim();

      if (!trimmed) {
        if (shouldRenderDropdown && results[activeIndex]) {
          handlePickProduct(results[activeIndex]);
        }
        return;
      }

      // 1. أولوية لمطابقة الباركود المباشرة (بما فيها باركود الشريط -S)
      const exactProduct = barcodeMap.get(normalizeBarcodeQuery(trimmed));
      if (exactProduct) {
        handlePickProduct(exactProduct);
        return;
      }

      // 2. اختيار النتيجة المظللة أو الأولى من البحث الضبابي والصوتي
      const picked = results[activeIndex] || results[0];
      if (picked) {
        handlePickProduct(picked);
      } else {
        notifyNotFound(trimmed);
      }
    }
  };

  const displayCost = showCost && canViewCost;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <ProductSearchInput
        ref={inputRef}
        value={query}
        onChange={(val) => {
          setQuery(val);
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
        onKeyDown={handleInputKeyDown}
        resultsCount={hasQuery ? results.length : undefined}
        placeholder={placeholder}
        shortcutHint={enableF2Shortcut ? "F2" : undefined}
        accent={accent}
        inputBgClass={inputBgClass}
      />

      {/* شريط إرشادي صغير أسفل خانة البحث */}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10.5px] text-slate-500 px-1 flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <Barcode className="w-3.5 h-3.5 text-indigo-400" />
          يدعم قارئ الباركود الليزري المباشر والبحث الضبابي/الصوتي مع تمييز
          العيارات (LASA)
        </span>
        <span className="font-mono hidden sm:inline">
          ↓ لفتح القائمة • ↑/↓ للتنقل • Enter للإدراج الفوري
        </span>
      </div>

      {/* القائمة المنسدلة للنتائج */}
      {shouldRenderDropdown && (
        <div className="absolute left-0 right-0 top-[44px] z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {results.length === 0 ? (
            <div className="py-8 px-4 text-center text-slate-400 text-xs">
              لا توجد أصناف مطابقة لـ «{query.trim()}» — جرّب الاسم مع العيار
              (مثل: pan 500) أو الباركود أو المادة الفعالة.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/70">
              {results.map((p, idx) => {
                const isActive = idx === activeIndex;
                const lasa = parseLasaDisplay(p.name, p.category);
                const isLasaRisk =
                  lasa.lasaGroupKey.length >= 3 &&
                  lasaRiskGroups.has(lasa.lasaGroupKey);
                const isLowStock = p.stockPacks <= p.minLimit;

                return (
                  <button
                    key={p.id}
                    ref={(el) => {
                      itemRefs.current[p.id] = el;
                    }}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handlePickProduct(p)}
                    className={`w-full text-right px-3.5 py-2.5 flex items-center justify-between gap-3 transition ${
                      isActive
                        ? "bg-indigo-950/65"
                        : isLasaRisk
                          ? "bg-amber-950/10 hover:bg-amber-950/25"
                          : "hover:bg-slate-800/70"
                    } ${isLasaRisk ? "border-r-2 border-r-amber-500/80" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white text-xs tracking-tight">
                          {lasa.baseName}
                        </span>

                        {lasa.strengths.map((strength) => (
                          <span
                            key={strength.text}
                            dir="ltr"
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[11px] font-black font-mono ${strength.badgeClass}`}
                          >
                            {strength.text}
                          </span>
                        ))}

                        {lasa.modifiers.map((mod) => (
                          <span
                            key={mod}
                            className="inline-flex items-center px-1.5 py-0.5 rounded border bg-yellow-500/15 text-yellow-200 border-yellow-400/70 text-[10px] font-extrabold"
                          >
                            {mod}
                          </span>
                        ))}

                        {lasa.dosageForm && (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[10px] ${lasa.dosageForm.badgeClass}`}
                          >
                            {lasa.dosageForm.label}
                          </span>
                        )}

                        {p.isControlled && (
                          <span className="bg-rose-950 text-rose-300 border border-rose-800 text-[9.5px] px-1.5 py-0.5 rounded font-bold">
                            مراقب 🔒
                          </span>
                        )}

                        {isLasaRisk && (
                          <span className="inline-flex items-center gap-0.5 bg-amber-950/90 border border-amber-600/70 text-amber-300 text-[9px] font-extrabold px-1.5 py-0.2 rounded">
                            <AlertTriangle className="w-2.5 h-2.5" /> LASA
                          </span>
                        )}
                      </div>

                      <div className="text-[10.5px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>{p.scientificName}</span>
                        <span className="font-mono text-slate-500">
                          • {p.barcode}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-left font-mono text-[11px]">
                        <div
                          className={`font-bold ${
                            p.stockPacks === 0
                              ? "text-rose-400"
                              : isLowStock
                                ? "text-amber-400"
                                : "text-slate-300"
                          }`}
                        >
                          رصيد: {p.stockPacks} علبة
                        </div>
                        <div className="text-[10px] text-slate-400">
                          بيع:{" "}
                          <b className="text-emerald-400">
                            {p.packPrice.toFixed(2)}
                          </b>
                          {displayCost && (
                            <>
                              {" | "}تكلفة:{" "}
                              <b className="text-amber-400">
                                {p.weightedCostPrice.toFixed(2)}
                              </b>
                            </>
                          )}
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 border ${
                          isActive
                            ? "bg-indigo-600 border-indigo-400 text-white"
                            : "bg-slate-800 border-slate-700 text-slate-200"
                        }`}
                      >
                        {isActive ? (
                          <>
                            <CornerDownLeft className="w-3 h-3" /> {actionLabel}
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" /> {actionLabel}
                          </>
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
