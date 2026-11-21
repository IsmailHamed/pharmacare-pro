import React, { forwardRef } from "react";
import { Search, Sparkles, X } from "lucide-react";

export type SearchAccent = "blue" | "amber" | "indigo" | "sky";

const ACCENT_FOCUS_CLASSES: Record<SearchAccent, string> = {
  blue: "focus:border-blue-500",
  amber: "focus:border-amber-500",
  indigo: "focus:border-indigo-500",
  sky: "focus:border-sky-500",
};

interface Props {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  resultsCount?: number;
  placeholder?: string;
  shortcutHint?: string;
  accent?: SearchAccent;
  inputBgClass?: string;
  className?: string;
}

/**
 * شريط البحث الموحّد عن الأدوية (مطابق لشريط نقطة البيع):
 * يدعم البحث الضبابي والصوتي والباركود مع عداد النتائج الحي وزر المسح وتلميح الاختصار
 */
export const ProductSearchInput = forwardRef<HTMLInputElement, Props>(
  (
    {
      value,
      onChange,
      onKeyDown,
      onFocus,
      resultsCount,
      placeholder = "ابحث بالباركود أو الاسم والعيار معاً (مثلاً: pan 500 أو اموكس 1g) أو المادة الفعالة... (F2)",
      shortcutHint = "F2",
      accent = "blue",
      inputBgClass = "bg-slate-900",
      className = "",
    },
    ref,
  ) => {
    const hasQuery = value.trim().length > 0;

    return (
      <div className={`relative ${className}`}>
        <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />

        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          placeholder={placeholder}
          className={`w-full ${inputBgClass} border border-slate-700 rounded-xl pr-10 pl-32 py-2.5 text-xs text-white focus:outline-none transition ${ACCENT_FOCUS_CLASSES[accent]}`}
        />

        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {hasQuery && (
            <>
              {typeof resultsCount === "number" && (
                <span className="bg-sky-950/90 border border-sky-800/80 text-sky-300 px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  {resultsCount}
                </span>
              )}
              <button
                type="button"
                onClick={() => onChange("")}
                title="مسح البحث"
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-1 rounded transition"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          )}
          {shortcutHint && (
            <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-mono">
              {shortcutHint}
            </span>
          )}
        </div>
      </div>
    );
  },
);

ProductSearchInput.displayName = "ProductSearchInput";
