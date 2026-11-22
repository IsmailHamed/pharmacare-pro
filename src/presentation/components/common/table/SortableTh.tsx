import React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { SortDirection } from "./useTableSort";
import { TableAccentColor } from "./DateRangeFilter";

// خيارات محاذاة محتوى العمود المتوافقة مع اتجاه الواجهة العربية (RTL)
export type TableColumnAlign = "right" | "center" | "left";

export interface SortableThProps {
  // عنوان العمود (نص أو عناصر JSX) لسهولة استبدال <th> التقليدي مباشرةً
  children: React.ReactNode;
  // اتجاه الفرز الحالي لهذا العمود (يُمرّر مباشرة من getSortDirection في useTableSort)
  direction: SortDirection | null;
  // دالة تبديل الفرز عند النقر على رأس العمود (تُمرّر من toggleSort)
  onSort: () => void;
  // محاذاة العمود داخل الجدول (الافتراضي: right ليتماشى مع الجداول العربية)
  align?: TableColumnAlign;
  // لون التمييز لأيقونة الفرز النشطة (مكتوب بالكامل لدعم Tailwind JIT)
  accent?: TableAccentColor;
  // تلميح اختياري يظهر عند تمرير المؤشر فوق رأس العمود
  title?: string;
  className?: string;
  colSpan?: number;
}

// ألوان أيقونة الفرز النشطة لكل شاشة
const ACTIVE_ICON_CLASSES: Record<TableAccentColor, string> = {
  indigo: "text-indigo-400",
  sky: "text-sky-400",
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
  purple: "text-purple-400",
};

// ربط محاذاة النص بمحاذاة Flex في اتجاه RTL (البداية يميناً والنهاية يساراً)
const ALIGN_TH_CLASSES: Record<TableColumnAlign, string> = {
  right: "text-right",
  center: "text-center",
  left: "text-left",
};

const ALIGN_FLEX_CLASSES: Record<TableColumnAlign, string> = {
  right: "justify-start",
  center: "justify-center",
  left: "justify-end",
};

/**
 * مكوّن رأس عمود قابل للفرز (SortableTh)
 * يعرض أيقونة اتجاه الفرز (تصاعدي / تنازلي / محايد) ويوحّد سلوك الترتيب في كافة الجداول
 */
export const SortableTh: React.FC<SortableThProps> = ({
  children,
  direction,
  onSort,
  align = "right",
  accent = "indigo",
  title,
  className = "",
  colSpan,
}) => {
  const isActive = direction !== null;

  // قيمة قياسية لقارئات الشاشة توضح حالة ترتيب العمود الحالية
  const ariaSort: React.AriaAttributes["aria-sort"] =
    direction === "asc"
      ? "ascending"
      : direction === "desc"
        ? "descending"
        : "none";

  // توليد نص تلميح واضح تلقائياً في حال عدم تمرير title مخصص
  const resolvedTitle =
    title ??
    (direction === "asc"
      ? "مرتّب تصاعدياً — اضغط للتبديل إلى الترتيب التنازلي"
      : direction === "desc"
        ? "مرتّب تنازلياً — اضغط للتبديل إلى الترتيب التصاعدي"
        : "اضغط للفرز حسب هذا العمود");

  return (
    <th
      scope="col"
      colSpan={colSpan}
      aria-sort={ariaSort}
      className={`py-2.5 px-3 select-none ${ALIGN_TH_CLASSES[align]} ${className}`}
    >
      <button
        type="button"
        onClick={onSort}
        title={resolvedTitle}
        className={`group w-full inline-flex items-center gap-1.5 font-bold transition outline-none focus-visible:text-white ${
          ALIGN_FLEX_CLASSES[align]
        } ${isActive ? "text-white" : "text-slate-400 hover:text-slate-200"}`}
      >
        <span className="truncate">{children}</span>

        {/* أيقونة حالة الفرز: سهم صاعد أو هابط للعمود النشط، وسهمان خافتان لبقية الأعمدة */}
        {direction === "asc" ? (
          <ArrowUp
            className={`w-3.5 h-3.5 shrink-0 ${ACTIVE_ICON_CLASSES[accent]}`}
          />
        ) : direction === "desc" ? (
          <ArrowDown
            className={`w-3.5 h-3.5 shrink-0 ${ACTIVE_ICON_CLASSES[accent]}`}
          />
        ) : (
          <ArrowUpDown className="w-3 h-3 shrink-0 text-slate-600 group-hover:text-slate-400 transition" />
        )}
      </button>
    </th>
  );
};
