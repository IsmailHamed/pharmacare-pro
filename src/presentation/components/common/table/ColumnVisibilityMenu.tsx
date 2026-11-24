import React, { useEffect, useRef, useState } from "react";
import { Check, Columns3, Eye, Lock, RotateCcw } from "lucide-react";
import { TableAccentColor } from "./DateRangeFilter";
import { UseTableColumnsResult } from "./useTableColumns";

export interface ColumnVisibilityMenuProps<K extends string = string> {
  // كائن الحالة المُرجع مباشرةً من useTableColumns
  columnsState: UseTableColumnsResult<K>;
  // لون التمييز المتناسق مع الشاشة الحالية
  accent?: TableAccentColor;
  // نص الزر (الافتراضي: "الأعمدة")
  label?: string;
  // محاذاة القائمة المنسدلة نسبةً للزر (في RTL عادةً left لتفتح نحو الداخل دون خروج عن الشاشة)
  align?: "left" | "right";
  className?: string;
}

// خرائط ألوان كاملة لدعم Tailwind JIT
const ACTIVE_BUTTON_CLASSES: Record<TableAccentColor, string> = {
  indigo: "border-indigo-500/70 text-indigo-200 bg-indigo-950/40",
  sky: "border-sky-500/70 text-sky-200 bg-sky-950/40",
  emerald: "border-emerald-500/70 text-emerald-200 bg-emerald-950/40",
  amber: "border-amber-500/70 text-amber-200 bg-amber-950/40",
  rose: "border-rose-500/70 text-rose-200 bg-rose-950/40",
  purple: "border-purple-500/70 text-purple-200 bg-purple-950/40",
};

const CHECKBOX_ACTIVE_CLASSES: Record<TableAccentColor, string> = {
  indigo: "bg-indigo-600 border-indigo-500 text-white",
  sky: "bg-sky-600 border-sky-500 text-white",
  emerald: "bg-emerald-600 border-emerald-500 text-white",
  amber: "bg-amber-600 border-amber-500 text-white",
  rose: "bg-rose-600 border-rose-500 text-white",
  purple: "bg-purple-600 border-purple-500 text-white",
};

const BADGE_CLASSES: Record<TableAccentColor, string> = {
  indigo: "bg-indigo-600/30 text-indigo-300 border-indigo-500/40",
  sky: "bg-sky-600/30 text-sky-300 border-sky-500/40",
  emerald: "bg-emerald-600/30 text-emerald-300 border-emerald-500/40",
  amber: "bg-amber-600/30 text-amber-300 border-amber-500/40",
  rose: "bg-rose-600/30 text-rose-300 border-rose-500/40",
  purple: "bg-purple-600/30 text-purple-300 border-purple-500/40",
};

/**
 * قائمة إظهار وإخفاء أعمدة الجدول الموحّدة (ColumnVisibilityMenu)
 * تُمرّر داخل actions أو secondaryActions في DataTableToolbar
 */
export function ColumnVisibilityMenu<K extends string = string>({
  columnsState,
  accent = "sky",
  label = "الأعمدة",
  align = "left",
  className = "",
}: ColumnVisibilityMenuProps<K>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    columns,
    isVisible,
    toggleColumn,
    showAll,
    resetColumns,
    visibleCount,
    totalCount,
    hiddenCount,
    hasCustomVisibility,
  } = columnsState;

  // إغلاق القائمة تلقائياً عند النقر خارجها أو الضغط على مفتاح Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* زر فتح القائمة المنسدلة للأعمدة */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title="التحكم في الأعمدة الظاهرة داخل الجدول"
        className={`px-2.5 py-1.5 rounded-xl border font-bold text-[11px] inline-flex items-center gap-1.5 transition ${
          isOpen || hiddenCount > 0
            ? ACTIVE_BUTTON_CLASSES[accent]
            : "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
        }`}
      >
        <Columns3 className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
        {hiddenCount > 0 && (
          <span
            className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full border ${BADGE_CLASSES[accent]}`}
          >
            {visibleCount}/{totalCount}
          </span>
        )}
      </button>

      {/* القائمة المنسدلة */}
      {isOpen && (
        <div
          role="menu"
          className={`absolute top-full mt-1.5 z-30 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {/* رأس القائمة */}
          <div className="px-3 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-200">أعمدة الجدول</span>
            <span className="font-mono text-[10px] text-slate-400">
              {visibleCount} / {totalCount}
            </span>
          </div>

          {/* قائمة الأعمدة القابلة للتبديل */}
          <div className="p-1.5 max-h-64 overflow-y-auto space-y-0.5">
            {columns.map((col) => {
              const checked = isVisible(col.id);
              const isLastVisible = checked && visibleCount <= 1;
              const isDisabled = Boolean(col.locked) || isLastVisible;

              return (
                <button
                  key={col.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={checked}
                  disabled={isDisabled}
                  onClick={() => toggleColumn(col.id)}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] flex items-center justify-between gap-2 text-right transition ${
                    isDisabled
                      ? "opacity-60 cursor-not-allowed text-slate-400"
                      : "hover:bg-slate-800 text-slate-200 cursor-pointer"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                        checked
                          ? CHECKBOX_ACTIVE_CLASSES[accent]
                          : "bg-slate-950 border-slate-700"
                      }`}
                    >
                      {checked && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                    <span className="truncate font-medium">{col.label}</span>
                  </div>

                  {col.locked && (
                    <Lock
                      className="w-3 h-3 text-slate-500 shrink-0"
                      title="عمود أساسي لا يمكن إخفاؤه"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* تذييل الإجراءات السريعة (إظهار الكل / إعادة الافتراضي) */}
          {(hiddenCount > 0 || hasCustomVisibility) && (
            <div className="px-2 py-1.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-1.5">
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={showAll}
                  className="flex-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10.5px] inline-flex items-center justify-center gap-1 transition"
                >
                  <Eye className="w-3 h-3" />
                  إظهار الكل
                </button>
              )}

              {hasCustomVisibility && (
                <button
                  type="button"
                  onClick={resetColumns}
                  className="flex-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-bold text-[10.5px] inline-flex items-center justify-center gap-1 transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  الافتراضي
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
