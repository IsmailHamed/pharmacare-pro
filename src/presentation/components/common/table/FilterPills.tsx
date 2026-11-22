import React from "react";
import { TableAccentColor } from "./DateRangeFilter";

// النغمات اللونية المدعومة لحبوب الفلترة (إضافة slate للحالة المحايدة مثل "الكل")
export type FilterPillTone = "slate" | TableAccentColor;

// بنية الخيار الواحد داخل مجموعة الفلاتر
export interface FilterPillOption<T extends string = string> {
  id: T;
  label: string;
  // عدّاد رقمي اختياري يظهر كشارة دائرية بجانب النص (مثل عدد النواقص أو الفواتير)
  count?: number;
  // أيقونة اختيارية من Lucide تُعرض قبل النص
  icon?: React.ElementType;
  // لون التمييز الخاص بهذا الخيار عند تفعيله (يُغلّب defaultTone)
  tone?: FilterPillTone;
  // تلوين خفيف للحبة حتى قبل اختيارها (مفيد لإبراز مستودع لديه أصناف أو حالة حرجة)
  highlightWhenInactive?: boolean;
  disabled?: boolean;
  title?: string;
}

export interface FilterPillsProps<T extends string = string> {
  options: readonly FilterPillOption<T>[];
  // القيمة المختارة حالياً
  value: T;
  // دالة التحديث عند النقر على أحد الخيارات
  onChange: (nextValue: T) => void;
  // chips: حبوب مستقلة بإطار (مناسبة للالتفاف) | segmented: شريط مدمج متلاصق
  variant?: "chips" | "segmented";
  // اللون الافتراضي للخيار النشط ما لم يحدد الخيار لوناً خاصاً به
  defaultTone?: FilterPillTone;
  ariaLabel?: string;
  className?: string;
}

// أصناف الحالة النشطة لنمط الشرائح المستقلة (مكتوبة كاملة لدعم Tailwind JIT)
const ACTIVE_CHIP_CLASSES: Record<FilterPillTone, string> = {
  slate: "bg-slate-700 border-slate-500 text-white shadow",
  indigo: "bg-indigo-600 border-indigo-400 text-white shadow",
  sky: "bg-sky-600 border-sky-400 text-white shadow",
  emerald: "bg-emerald-950/90 border-emerald-500 text-emerald-200 shadow",
  amber: "bg-amber-950/90 border-amber-500 text-amber-200 shadow",
  rose: "bg-rose-950/90 border-rose-500 text-rose-200 shadow",
  purple: "bg-purple-600 border-purple-400 text-white shadow",
};

// أصناف الإبراز الخفيف عند عدم التحديد (لإظهار الخيارات المهمة بصرياً قبل النقر عليها)
const INACTIVE_HIGHLIGHT_CHIP_CLASSES: Record<FilterPillTone, string> = {
  slate:
    "bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500 hover:text-white",
  indigo:
    "bg-indigo-950/45 border-indigo-800/80 text-indigo-200 hover:border-indigo-600",
  sky: "bg-sky-950/45 border-sky-800/80 text-sky-200 hover:border-sky-600",
  emerald:
    "bg-slate-900 border-slate-800 text-emerald-400 hover:border-emerald-700",
  amber: "bg-slate-900 border-slate-800 text-amber-400 hover:border-amber-700",
  rose: "bg-rose-950/35 border-rose-800/70 text-rose-300 hover:border-rose-600",
  purple:
    "bg-purple-950/45 border-purple-800/80 text-purple-200 hover:border-purple-600",
};

// أصناف الحالة النشطة لنمط الشريط المدمج (Segmented Control)
const ACTIVE_SEGMENTED_CLASSES: Record<FilterPillTone, string> = {
  slate: "bg-slate-700 text-white shadow",
  indigo: "bg-indigo-600 text-white shadow",
  sky: "bg-sky-600 text-white shadow",
  emerald: "bg-emerald-600 text-white shadow",
  amber: "bg-amber-600 text-white shadow",
  rose: "bg-rose-600 text-white shadow",
  purple: "bg-purple-600 text-white shadow",
};

/**
 * مكوّن حبوب الفلترة السريعة الموحّد (FilterPills)
 * يدعم النوع العام Generic لضمان أمان الأنواع عند ربطه بحالات التصفية في كل شاشة
 */
export const FilterPills = <T extends string>({
  options,
  value,
  onChange,
  variant = "chips",
  defaultTone = "indigo",
  ariaLabel = "خيارات التصفية السريعة",
  className = "",
}: FilterPillsProps<T>): React.ReactElement => {
  const isSegmented = variant === "segmented";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={
        isSegmented
          ? `inline-flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 flex-wrap ${className}`
          : `flex items-center gap-1.5 flex-wrap ${className}`
      }
    >
      {options.map((option) => {
        const isSelected = option.id === value;
        const tone: FilterPillTone = option.tone ?? defaultTone;
        const Icon = option.icon;

        // تحديد أصناف التصميم حسب النمط (مقسّم أو شرائح) وحالة التفعيل
        const buttonClasses = isSegmented
          ? `px-2.5 py-1 rounded-lg text-[11px] font-bold transition inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
              isSelected
                ? ACTIVE_SEGMENTED_CLASSES[tone]
                : "text-slate-400 hover:text-white hover:bg-slate-800/70"
            }`
          : `px-3 py-1.5 rounded-lg text-[11px] font-bold border transition inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
              isSelected
                ? ACTIVE_CHIP_CLASSES[tone]
                : option.highlightWhenInactive
                  ? INACTIVE_HIGHLIGHT_CHIP_CLASSES[tone]
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
            }`;

        return (
          <button
            key={option.id}
            type="button"
            disabled={option.disabled}
            aria-pressed={isSelected}
            title={option.title}
            onClick={() => onChange(option.id)}
            className={buttonClasses}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span>{option.label}</span>

            {/* عرض شارة العدّاد الرقمي عند تمرير count (بما في ذلك الصفر) */}
            {typeof option.count === "number" && (
              <span
                className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full leading-tight ${
                  isSelected
                    ? "bg-black/30 text-current"
                    : "bg-slate-950/90 text-slate-300 border border-slate-800"
                }`}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
