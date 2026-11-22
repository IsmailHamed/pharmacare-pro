import React from "react";
import { CheckCircle2, Inbox, RotateCcw, SearchX } from "lucide-react";

// نوع حالة الفراغ: إما غياب كامل للبيانات الأصلية أو عدم تطابق نتائج البحث/الفلاتر
export type TableEmptyVariant = "empty" | "no-results";

// النغمة اللونية للحالة (neutral للحالات الاعتيادية، و success لحالات مثل "لا توجد نواقص")
export type TableEmptyTone = "neutral" | "success";

export interface TableEmptyStateProps {
  // تحديد سبب فراغ الجدول لاختيار الأيقونة والنص الافتراضي الأنسب
  variant?: TableEmptyVariant;
  // النغمة البصرية للنص والأيقونة
  tone?: TableEmptyTone;
  // عنوان مخصص (يُستخدم نص افتراضي واضح إذا لم يُمرّر)
  title?: string;
  // وصف إرشادي إضافي أسفل العنوان
  description?: string;
  // عبارة البحث الحالية لإظهارها تلقائياً ضمن رسالة عدم وجود نتائج
  searchQuery?: string;
  // أيقونة مخصصة من Lucide لتجاوز الأيقونة الافتراضية لكل شاشة
  icon?: React.ElementType;
  // دالة إعادة ضبط الفلاتر (عند تمريرها في حالة no-results يظهر زر إعادة الضبط تلقائياً)
  onResetFilters?: () => void;
  // نص مخصص لزر إعادة الضبط
  resetLabel?: string;
  // إجراء مخصص إضافي (مثل زر "إضافة صنف جديد" أو "إدارة المستودعات")
  action?: React.ReactNode;
  // تقليل الحشوة العمودية للجداول المدمجة أو النوافذ المنبثقة
  compact?: boolean;
  // عند التفعيل، يُصيّر المكوّن داخل <tr><td colSpan={...}> للاستخدام المباشر داخل <tbody>
  asTableRow?: boolean;
  // عدد أعمدة الجدول عند تفعيل asTableRow
  colSpan?: number;
  className?: string;
}

/**
 * مكوّن حالة الفراغ الموحّد للجداول (TableEmptyState)
 * يفرّق بصرياً بين جدول بلا سجلات أصلاً وجدول بلا مطابقات للفلاتر النشطة
 */
export const TableEmptyState: React.FC<TableEmptyStateProps> = ({
  variant = "empty",
  tone = "neutral",
  title,
  description,
  searchQuery,
  icon,
  onResetFilters,
  resetLabel = "إعادة ضبط الفلاتر",
  action,
  compact = false,
  asTableRow = false,
  colSpan = 1,
  className = "",
}) => {
  const isNoResults = variant === "no-results";
  const isSuccessTone = tone === "success" && !isNoResults;
  const trimmedQuery = searchQuery?.trim() ?? "";

  // اختيار الأيقونة المناسبة حسب النوع والنغمة ما لم يُمرّر المستخدم أيقونة مخصصة
  const ResolvedIcon =
    icon ?? (isNoResults ? SearchX : isSuccessTone ? CheckCircle2 : Inbox);

  // توليد عنوان افتراضي مفهوم عند عدم تمرير عنوان مخصص
  const resolvedTitle =
    title ??
    (isNoResults
      ? trimmedQuery
        ? `لا توجد نتائج مطابقة لـ «${trimmedQuery}»`
        : "لا توجد سجلات مطابقة لخيارات الفلترة الحالية"
      : "لا توجد بيانات مسجلة حتى الآن");

  const iconClasses = isSuccessTone
    ? "w-9 h-9 text-emerald-500/60 stroke-1"
    : isNoResults
      ? "w-9 h-9 text-slate-600 stroke-1"
      : "w-10 h-10 text-slate-700 stroke-1";

  const titleClasses = isSuccessTone
    ? "text-sm font-bold text-emerald-400"
    : "text-xs sm:text-sm font-bold text-slate-300";

  const content = (
    <div
      className={`flex flex-col items-center justify-center text-center gap-2 px-4 ${
        compact ? "py-10" : "py-14"
      } ${className}`}
    >
      <ResolvedIcon className={iconClasses} />

      <p className={titleClasses}>{resolvedTitle}</p>

      {description && (
        <p className="text-[11px] text-slate-500 max-w-md leading-relaxed">
          {description}
        </p>
      )}

      {/* شريط الإجراءات: زر مسح الفلاتر السريع و/أو أي إجراء مخصص من الشاشة الأم */}
      {(onResetFilters || action) && (
        <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
          {onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-bold text-[11px] inline-flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{resetLabel}</span>
            </button>
          )}
          {action}
        </div>
      )}
    </div>
  );

  // في حال الاستخدام المباشر داخل <tbody> نُغلف المحتوى بصف جدول ممتد على كامل الأعمدة
  if (asTableRow) {
    return (
      <tr>
        <td colSpan={colSpan} className="p-0">
          {content}
        </td>
      </tr>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40">
      {content}
    </div>
  );
};
