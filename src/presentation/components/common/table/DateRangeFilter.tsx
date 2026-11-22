import React from "react";
import { Calendar, X } from "lucide-react";
import {
  DateRangePreset,
  DateRangeValue,
  DEFAULT_DATE_RANGE,
  buildDateRangeFromPreset,
  isDateRangeActive,
} from "./dateRangeUtils";

// الألوان التمييزية المدعومة لتتناسق مع لون كل شاشة في النظام (تُكتب كاملة ليدعمها Tailwind JIT)
export type TableAccentColor =
  | "indigo"
  | "sky"
  | "emerald"
  | "amber"
  | "rose"
  | "purple";

interface DateRangeFilterProps {
  // قيمة النطاق الزمني الحالية المدارة من الشاشة الأم
  value: DateRangeValue;
  // دالة التحديث عند اختيار زر سريع أو تعديل تاريخ البداية/النهاية
  onChange: (next: DateRangeValue) => void;
  // لون التمييز للزر النشط (الافتراضي: indigo)
  accent?: TableAccentColor;
  // إظهار أو إخفاء شريط الأزرار السريعة (الكل / اليوم / 7 أيام / هذا الشهر)
  showPresets?: boolean;
  // إظهار زر مسح سريع داخل المكوّن نفسه عند تفعيل أي تاريخ
  showClearButton?: boolean;
  className?: string;
}

const PRESET_OPTIONS: {
  id: Exclude<DateRangePreset, "CUSTOM">;
  label: string;
}[] = [
  { id: "ALL", label: "الكل" },
  { id: "TODAY", label: "اليوم" },
  { id: "LAST_7_DAYS", label: "آخر 7 أيام" },
  { id: "THIS_MONTH", label: "هذا الشهر" },
];

const ACTIVE_PRESET_CLASSES: Record<TableAccentColor, string> = {
  indigo: "bg-indigo-600 text-white shadow",
  sky: "bg-sky-600 text-white shadow",
  emerald: "bg-emerald-600 text-white shadow",
  amber: "bg-amber-600 text-white shadow",
  rose: "bg-rose-600 text-white shadow",
  purple: "bg-purple-600 text-white shadow",
};

const ACTIVE_INPUT_BORDER_CLASSES: Record<TableAccentColor, string> = {
  indigo: "border-indigo-500/70",
  sky: "border-sky-500/70",
  emerald: "border-emerald-500/70",
  amber: "border-amber-500/70",
  rose: "border-rose-500/70",
  purple: "border-purple-500/70",
};

/**
 * مكوّن فلتر التواريخ الموحّد (DateRangeFilter)
 * يجمع بين الاختصارات الزمنية السريعة وحقول الإدخال اليدوي (من / إلى) بتصميم موحّد
 */
export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  value,
  onChange,
  accent = "indigo",
  showPresets = true,
  showClearButton = false,
  className = "",
}) => {
  const active = isDateRangeActive(value);

  // تطبيق أحد الاختصارات السريعة وتوليد تاريخَي البداية والنهاية تلقائياً
  const handleSelectPreset = (preset: Exclude<DateRangePreset, "CUSTOM">) => {
    onChange(buildDateRangeFromPreset(preset));
  };

  // تحديث تاريخ البداية يدوياً مع التحويل التلقائي لوضع CUSTOM ومنع تجاوز تاريخ النهاية
  const handleFromChange = (nextFrom: string) => {
    if (!nextFrom && !value.to) {
      onChange(DEFAULT_DATE_RANGE);
      return;
    }

    // إذا أدخل المستخدم تاريخ بداية أحدث من تاريخ النهاية الحالي، نُعدّل النهاية لتطابقه بدلاً من نطاق فارغ
    const adjustedTo =
      value.to && nextFrom && nextFrom > value.to ? nextFrom : value.to;
    onChange({
      preset: "CUSTOM",
      from: nextFrom,
      to: adjustedTo,
    });
  };

  // تحديث تاريخ النهاية يدوياً مع التحويل التلقائي لوضع CUSTOM ومنع سبق تاريخ البداية
  const handleToChange = (nextTo: string) => {
    if (!value.from && !nextTo) {
      onChange(DEFAULT_DATE_RANGE);
      return;
    }

    // إذا أدخل المستخدم تاريخ نهاية أقدم من تاريخ البداية الحالي، نُعدّل البداية لتطابقه
    const adjustedFrom =
      value.from && nextTo && nextTo < value.from ? nextTo : value.from;
    onChange({
      preset: "CUSTOM",
      from: adjustedFrom,
      to: nextTo,
    });
  };

  const activeBorderCls = ACTIVE_INPUT_BORDER_CLASSES[accent];

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {/* شريط الأزرار الزمنية السريعة */}
      {showPresets && (
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {PRESET_OPTIONS.map((option) => {
            // عند اختيار ALL يُعتبر نشطاً فقط إذا لم يكن هناك تاريخ مخصص مفعّل
            const isSelected =
              option.id === "ALL"
                ? value.preset === "ALL" && !active
                : value.preset === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelectPreset(option.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  isSelected
                    ? option.id === "ALL"
                      ? "bg-slate-700 text-white"
                      : ACTIVE_PRESET_CLASSES[accent]
                    : "text-slate-400 hover:text-white hover:bg-slate-800/70"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {/* حقل تاريخ البداية (من) */}
      <div
        className={`flex items-center gap-1.5 bg-slate-950 border rounded-xl px-2.5 py-1.5 text-[11px] transition ${
          value.from ? activeBorderCls : "border-slate-800"
        }`}
      >
        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-slate-400">من:</span>
        <input
          type="date"
          aria-label="من تاريخ"
          value={value.from}
          onChange={(e) => handleFromChange(e.target.value)}
          className="bg-transparent text-white font-mono outline-none"
        />
      </div>

      {/* حقل تاريخ النهاية (إلى) */}
      <div
        className={`flex items-center gap-1.5 bg-slate-950 border rounded-xl px-2.5 py-1.5 text-[11px] transition ${
          value.to ? activeBorderCls : "border-slate-800"
        }`}
      >
        <span className="text-slate-400">إلى:</span>
        <input
          type="date"
          aria-label="إلى تاريخ"
          value={value.to}
          onChange={(e) => handleToChange(e.target.value)}
          className="bg-transparent text-white font-mono outline-none"
        />
      </div>

      {/* زر مسح سريع اختياري لإلغاء نطاق التواريخ فقط */}
      {showClearButton && active && (
        <button
          type="button"
          onClick={() => onChange(DEFAULT_DATE_RANGE)}
          title="مسح فلتر التاريخ"
          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
