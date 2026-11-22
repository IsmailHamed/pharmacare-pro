import React from "react";
import { TableEmptyState, TableEmptyStateProps } from "./TableEmptyState";

// خصائص مخصّصة لحالتَي الفراغ دون الحاجة لتكرار variant أو إعدادات الصف
export type DataTableEmptyConfig = Omit<
  TableEmptyStateProps,
  "variant" | "asTableRow" | "colSpan"
>;

export interface DataTableShellProps {
  // === 1. مناطق التركيب المحيطة بالجدول ===
  // شريط الأدوات والفلاتر الموحّد (عادةً <DataTableToolbar />)
  toolbar?: React.ReactNode;
  // شريط اختياري يظهر بين الفلاتر والجدول مباشرةً (مثل شريط التوجيه الجماعي في دفتر النواقص)
  aboveTable?: React.ReactNode;
  // صف/صفوف عناوين الأعمدة داخل <thead> (تستخدم <SortableTh /> أو <th>)
  header: React.ReactNode;
  // صفوف البيانات الفعلية داخل <tbody>
  children: React.ReactNode;
  // تذييل الجدول (عادةً <TableLoadMoreFooter />)
  footer?: React.ReactNode;

  // === 2. أعداد السجلات للتمييز التلقائي بين الجدول الفارغ أصلاً وبين عدم تطابق الفلاتر ===
  // إجمالي عدد السجلات الأصلية قبل الفلترة
  totalCount: number;
  // عدد السجلات المطابقة بعد تطبيق البحث والفلاتر
  filteredCount: number;

  // === 3. إعدادات حالتَي الفراغ الموحّدتين ===
  // تخصيص رسالة وأيقونة حالة عدم وجود بيانات مسجلة إطلاقاً (totalCount === 0)
  emptyState?: DataTableEmptyConfig;
  // تخصيص رسالة وأيقونة حالة عدم وجود نتائج مطابقة للفلاتر (totalCount > 0 && filteredCount === 0)
  noResultsState?: DataTableEmptyConfig;
  // عبارة البحث الحالية لتمريرها تلقائياً إلى حالة no-results إن لم تُحدّد داخل noResultsState
  searchQuery?: string;
  // دالة إعادة ضبط الفلاتر لتمريرها تلقائياً كزر سريع في حالة no-results
  onResetFilters?: () => void;

  // === 4. خيارات العرض والتخطيط للجدول ===
  // تغليف الجدول والفلاتر ببطاقة داكنة موحّدة (عطّلها بـ false إذا كانت الشاشة الأم تملك بطاقة خارجية بالفعل)
  framed?: boolean;
  // تثبيت رأس الجدول <thead> في الأعلى عند وجود تمرير عمودي داخل حاوية الجدول
  stickyHeader?: boolean;
  // إبقاء رأس الجدول ظاهراً وعرض رسالة الفراغ كصف ممتد داخل <tbody> بدلاً من استبدال الجدول بالكامل
  keepHeaderOnEmpty?: boolean;
  // عدد أعمدة الجدول (مطلوب فقط عند تفعيل keepHeaderOnEmpty لمدّ خلية الفراغ بعرض الجدول)
  colSpan?: number;
  // تخصيص أصناف Tailwind للحاوية الخارجية أو حاوية التمرير أو <table> أو <tbody>
  className?: string;
  tableContainerClassName?: string;
  tableClassName?: string;
  bodyClassName?: string;
}

/**
 * الهيكل الحاوي الموحّد للجداول (DataTableShell)
 * يوحّد إطار الجدول، الترويسة الثابتة، الفواصل، حالتَي الفراغ، ومواضع شريط الأدوات والتذييل
 */
export const DataTableShell: React.FC<DataTableShellProps> = ({
  toolbar,
  aboveTable,
  header,
  children,
  footer,
  totalCount,
  filteredCount,
  emptyState,
  noResultsState,
  searchQuery,
  onResetFilters,
  framed = true,
  stickyHeader = false,
  keepHeaderOnEmpty = false,
  colSpan = 1,
  className = "",
  tableContainerClassName = "",
  tableClassName = "",
  bodyClassName = "",
}) => {
  // التمييز الصريح بين فراغ البيانات بالكامل وعدم تطابق الفلاتر النشطة
  const isCompletelyEmpty = totalCount === 0;
  const isNoMatchingResults = totalCount > 0 && filteredCount === 0;
  const shouldShowEmpty = isCompletelyEmpty || isNoMatchingResults;

  // بناء مكوّن حالة الفراغ المناسب مع وراثة searchQuery و onResetFilters تلقائياً لحالة no-results
  const renderEmptyState = (asTableRow: boolean) => {
    if (isCompletelyEmpty) {
      return (
        <TableEmptyState
          {...emptyState}
          variant="empty"
          asTableRow={asTableRow}
          colSpan={colSpan}
        />
      );
    }

    return (
      <TableEmptyState
        searchQuery={searchQuery}
        onResetFilters={onResetFilters}
        {...noResultsState}
        variant="no-results"
        asTableRow={asTableRow}
        colSpan={colSpan}
      />
    );
  };

  return (
    <div
      className={
        framed
          ? `bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 ${className}`
          : `space-y-3.5 ${className}`
      }
    >
      {/* 1. شريط الأدوات والفلاتر الموحّد */}
      {toolbar}

      {/* 2. شريط اختياري فوق الجدول (مثل التحديد الجماعي أو التنبيهات السياقية) */}
      {aboveTable}

      {/* 3. منطقة الجدول أو بطاقة حالة الفراغ الموحّدة */}
      {shouldShowEmpty && !keepHeaderOnEmpty ? (
        renderEmptyState(false)
      ) : (
        <div
          className={`overflow-x-auto rounded-xl border border-slate-800 ${tableContainerClassName}`}
        >
          <table
            className={`w-full text-right text-xs border-collapse ${tableClassName}`}
          >
            <thead
              className={`bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] ${
                stickyHeader ? "sticky top-0 z-10" : ""
              }`}
            >
              {header}
            </thead>

            <tbody
              className={`divide-y divide-slate-800/70 bg-slate-950/35 ${bodyClassName}`}
            >
              {shouldShowEmpty ? renderEmptyState(true) : children}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. تذييل التحميل التدريجي (يظهر فقط عند وجود بيانات مطابقة) */}
      {!shouldShowEmpty && footer}
    </div>
  );
};
