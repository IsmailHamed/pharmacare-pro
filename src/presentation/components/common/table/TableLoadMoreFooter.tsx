import React from "react";
import { CheckCircle2, ChevronDown, ChevronsDown } from "lucide-react";
import { TableAccentColor } from "./DateRangeFilter";

export interface TableLoadMoreFooterProps {
  // عدد الصفوف الظاهرة حالياً على الشاشة
  visibleCount: number;
  // العدد الإجمالي للصفوف بعد تطبيق الفلاتر
  totalCount: number;
  // عدد الصفوف المتبقية غير المعروضة بعد
  remainingCount: number;
  // حجم الدفعة الواحدة (مثلاً 50)
  pageSize: number;
  // هل توجد صفوف إضافية يمكن تحميلها؟
  hasMore: boolean;
  // دالة تحميل الدفعة التالية من useTablePagination
  onLoadMore: () => void;
  // دالة اختيارية لإظهار كافة الصفوف المتبقية دفعة واحدة
  onShowAll?: () => void;
  // تسمية نوع السجل للعرض البشري (مثلاً: "صنف" أو "فاتورة" أو "سجل")
  itemLabel?: string;
  // لون التمييز المتناسق مع الشاشة الحالية
  accent?: TableAccentColor;
  // إظهار سطر تأكيد خفيف عند اكتمال عرض كافة الصفوف (مفيد للجداول الطويلة فقط)
  showSummaryWhenComplete?: boolean;
  className?: string;
}

// خريطة ألوان الأيقونات والأرقام النشطة (مكتوبة كاملة لدعم Tailwind JIT)
const ACCENT_ICON_CLASSES: Record<TableAccentColor, string> = {
  indigo: "text-indigo-400",
  sky: "text-sky-400",
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
  purple: "text-purple-400",
};

const ACCENT_HOVER_BORDER_CLASSES: Record<TableAccentColor, string> = {
  indigo: "hover:border-indigo-500/70",
  sky: "hover:border-sky-500/70",
  emerald: "hover:border-emerald-500/70",
  amber: "hover:border-amber-500/70",
  rose: "hover:border-rose-500/70",
  purple: "hover:border-purple-500/70",
};

/**
 * تذييل التحميل التدريجي الموحّد للجداول (TableLoadMoreFooter)
 * يعرض زر تحميل الدفعة التالية مع عدد المتبقي وزر اختياري لعرض الكل
 */
export const TableLoadMoreFooter: React.FC<TableLoadMoreFooterProps> = ({
  visibleCount,
  totalCount,
  remainingCount,
  pageSize,
  hasMore,
  onLoadMore,
  onShowAll,
  itemLabel = "سجل",
  accent = "sky",
  showSummaryWhenComplete = false,
  className = "",
}) => {
  // عدم عرض التذييل نهائياً إذا كان الجدول فارغاً
  if (totalCount === 0) return null;

  // عند اكتمال عرض جميع الصفوف نعرض شريط تأكيد خفيف فقط إذا طُلب وكان العدد يتجاوز دفعة واحدة
  if (!hasMore) {
    if (!showSummaryWhenComplete || totalCount <= pageSize) {
      return null;
    }

    return (
      <div
        className={`pt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-mono ${className}`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/70" />
        <span>
          تم عرض كامل القائمة ({totalCount} {itemLabel})
        </span>
      </div>
    );
  }

  // حساب عدد الصفوف الفعلي للدفعة التالية حتى لا نعد المستخدم بـ 50 صفاً والمتبقي 12 فقط
  const nextBatchCount = Math.min(pageSize, remainingCount);
  // إظهار زر "عرض الكل" فقط عند توفر الدالة وبقاء أكثر من دفعة واحدة
  const canShowAll = Boolean(onShowAll) && remainingCount > pageSize;

  return (
    <div
      className={`pt-2.5 flex flex-col items-center justify-center gap-2 ${className}`}
    >
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {/* زر تحميل الدفعة التالية */}
        <button
          type="button"
          onClick={onLoadMore}
          className={`bg-slate-800 hover:bg-slate-700 border border-slate-700 ${ACCENT_HOVER_BORDER_CLASSES[accent]} text-slate-200 hover:text-white font-bold text-xs px-5 py-2.5 rounded-xl inline-flex items-center gap-2 shadow transition`}
        >
          <ChevronDown
            className={`w-4 h-4 shrink-0 ${ACCENT_ICON_CLASSES[accent]}`}
          />
          <span>
            عرض <b className="font-mono text-white">{nextBatchCount}</b>{" "}
            {itemLabel} إضافي{" "}
            <span className="text-slate-400 font-normal">
              (المتبقي:{" "}
              <b className="font-mono text-slate-200">{remainingCount}</b>)
            </span>
          </span>
        </button>

        {/* زر ثانوي لعرض كامل الصفوف المتبقية دفعة واحدة عند وجود أكثر من دفعة */}
        {canShowAll && onShowAll && (
          <button
            type="button"
            onClick={onShowAll}
            title={`إظهار جميع الصفوف المتبقية دفعة واحدة (${totalCount} ${itemLabel})`}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-600 text-slate-300 hover:text-white font-bold text-[11px] px-3.5 py-2.5 rounded-xl inline-flex items-center gap-1.5 transition"
          >
            <ChevronsDown className="w-3.5 h-3.5 text-slate-400" />
            <span>عرض الكل ({totalCount})</span>
          </button>
        )}
      </div>

      {/* مؤشر نصي يوضح نسبة المعروض حالياً من الإجمالي */}
      <div className="text-[10.5px] text-slate-500 font-mono">
        يعرض الآن <b className="text-slate-300">{visibleCount}</b> من أصل{" "}
        <b className="text-slate-300">{totalCount}</b> {itemLabel}
      </div>
    </div>
  );
};
