import React from "react";
import { RotateCcw, Search, X } from "lucide-react";
import { TableAccentColor } from "./DateRangeFilter";

export interface DataTableToolbarProps {
  // === 1. منطقة البحث (إما استخدام البحث النصي المدمج أو تمرير مكوّن بحث مخصص مثل ProductSearchInput) ===
  searchSlot?: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  // تلميح اختصار اختياري يظهر داخل حقل البحث المدمج عند فراغه (مثل F2)
  searchShortcutHint?: string;

  // === 2. فلاتر وإجراءات الصف الأول ===
  // فلاتر إضافية بمحاذاة البحث (مثل قائمة المستودعات أو حبوب طريقة الدفع)
  filters?: React.ReactNode;
  // أزرار الإجراءات في الصف الأول (تصدير، طباعة، إضافة...)
  actions?: React.ReactNode;

  // === 3. الصف الثاني (نطاق التواريخ / حبوب الفلترة السريعة / إجراءات إضافية) ===
  secondaryFilters?: React.ReactNode;
  secondaryActions?: React.ReactNode;

  // === 4. زر إعادة ضبط جميع الفلاتر الموحّد ===
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  resetLabel?: string;

  // === 5. شريط العدّاد والحالة المدمج أسفل الفلاتر (اختياري) ===
  visibleCount?: number;
  filteredCount?: number;
  totalCount?: number;
  itemLabel?: string;
  // عناصر إضافية تظهر على يسار شريط العدّاد (مثل تلميح اختصارات أو زر توسيع الكل)
  metaExtra?: React.ReactNode;

  // لون التمييز المتناسق مع الشاشة (يُستخدم لحدود التركيز في حقل البحث المدمج)
  accent?: TableAccentColor;
  className?: string;
}

// خريطة ألوان حدود التركيز لحقل البحث المدمج (مكتوبة كاملة لدعم Tailwind JIT)
const SEARCH_FOCUS_BORDER_CLASSES: Record<TableAccentColor, string> = {
  indigo: "focus:border-indigo-500",
  sky: "focus:border-sky-500",
  emerald: "focus:border-emerald-500",
  amber: "focus:border-amber-500",
  rose: "focus:border-rose-500",
  purple: "focus:border-purple-500",
};

const COUNT_ACCENT_CLASSES: Record<TableAccentColor, string> = {
  indigo: "text-indigo-400",
  sky: "text-sky-400",
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
  purple: "text-purple-400",
};

/**
 * شريط الأدوات والفلاتر الموحّد للجداول (DataTableToolbar)
 * يضبط تناسق البحث، الفلاتر، نطاقات التواريخ، زر إعادة الضبط، وشريط العدّاد في كافة الشاشات
 */
export const DataTableToolbar: React.FC<DataTableToolbarProps> = ({
  searchSlot,
  searchValue,
  onSearchChange,
  searchPlaceholder = "ابحث في السجلات...",
  searchInputRef,
  searchShortcutHint,
  filters,
  actions,
  secondaryFilters,
  secondaryActions,
  hasActiveFilters = false,
  onResetFilters,
  resetLabel = "إعادة ضبط الفلاتر",
  visibleCount,
  filteredCount,
  totalCount,
  itemLabel = "سجل",
  metaExtra,
  accent = "indigo",
  className = "",
}) => {
  // التحقق من استخدام حقل البحث النصي المدمج عند عدم تمرير مكوّن searchSlot مخصص
  const hasBuiltInSearch = !searchSlot && typeof onSearchChange === "function";

  const hasPrimaryRow = Boolean(
    searchSlot || hasBuiltInSearch || filters || actions,
  );

  // إظهار زر إعادة الضبط في الصف الثاني إن وُجد، وإلا نضعه في الصف الأول تلقائياً
  const showResetButton = Boolean(hasActiveFilters && onResetFilters);
  const hasSecondaryRow = Boolean(secondaryFilters || secondaryActions);
  const renderResetInSecondary = showResetButton && hasSecondaryRow;
  const renderResetInPrimary = showResetButton && !hasSecondaryRow;

  const hasMetaCounts =
    typeof visibleCount === "number" && typeof filteredCount === "number";
  const hasMetaRow = Boolean(hasMetaCounts || metaExtra);

  // عنصر زر إعادة ضبط الفلاتر الموحّد لتفادي تكراره بين الصفين
  const resetButtonNode = showResetButton ? (
    <button
      type="button"
      onClick={onResetFilters}
      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white font-bold text-[11px] inline-flex items-center gap-1 transition shrink-0"
    >
      <RotateCcw className="w-3.5 h-3.5" />
      <span>{resetLabel}</span>
    </button>
  ) : null;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* الصف الأول: حقل البحث + الفلاتر الأساسية + الإجراءات */}
      {hasPrimaryRow && (
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-[240px]">
            {/* مكوّن البحث المخصص (مثل ProductSearchInput للأدوية) */}
            {searchSlot && (
              <div className="flex-1 min-w-[240px]">{searchSlot}</div>
            )}

            {/* حقل البحث النصي المدمج لجداول السجلات والحركات */}
            {hasBuiltInSearch && (
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchValue ?? ""}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className={`w-full bg-slate-950 border border-slate-800 ${SEARCH_FOCUS_BORDER_CLASSES[accent]} rounded-xl pr-9 pl-9 py-2 text-xs text-white placeholder:text-slate-500 outline-none transition`}
                />

                {/* زر مسح نص البحث السريع أو شارة الاختصار عند الفراغ */}
                {searchValue ? (
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
                    title="مسح عبارة البحث"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5 rounded transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : searchShortcutHint ? (
                  <kbd className="absolute left-2.5 top-1/2 -translate-y-1/2 bg-slate-900 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-mono pointer-events-none">
                    {searchShortcutHint}
                  </kbd>
                ) : null}
              </div>
            )}

            {/* الفلاتر الإضافية بمحاذاة البحث */}
            {filters}

            {/* زر إعادة الضبط في حال عدم وجود صف ثانٍ */}
            {renderResetInPrimary && resetButtonNode}
          </div>

          {/* أزرار الإجراءات في نهاية الصف الأول */}
          {actions && (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {actions}
            </div>
          )}
        </div>
      )}

      {/* الصف الثاني: نطاق التواريخ / حبوب الفلترة + زر إعادة الضبط + الإجراءات الثانوية */}
      {hasSecondaryRow && (
        <div
          className={`flex items-center justify-between gap-2.5 flex-wrap ${
            hasPrimaryRow ? "border-t border-slate-800/80 pt-3" : ""
          }`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            {secondaryFilters}
            {renderResetInSecondary && resetButtonNode}
          </div>

          {secondaryActions && (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {secondaryActions}
            </div>
          )}
        </div>
      )}

      {/* شريط الحالة والعدّاد المدمج فوق الجدول مباشرةً */}
      {hasMetaRow && (
        <div className="flex items-center justify-between gap-2 flex-wrap px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-400">
          <div>
            {hasMetaCounts && (
              <span className="font-mono">
                يعرض <b className="text-white">{visibleCount}</b> من أصل{" "}
                <b className={COUNT_ACCENT_CLASSES[accent]}>{filteredCount}</b>{" "}
                <span className="font-sans">{itemLabel}</span>
                {typeof totalCount === "number" &&
                  totalCount !== filteredCount && (
                    <span className="text-slate-500 font-sans mr-1.5">
                      (إجمالي السجل:{" "}
                      <b className="font-mono text-slate-400">{totalCount}</b>)
                    </span>
                  )}
              </span>
            )}
          </div>

          {metaExtra && (
            <div className="flex items-center gap-2 flex-wrap">{metaExtra}</div>
          )}
        </div>
      )}
    </div>
  );
};
