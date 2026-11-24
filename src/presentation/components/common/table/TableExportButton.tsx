import React from "react";
import { FileSpreadsheet } from "lucide-react";
import {
  CsvCellValue,
  exportRowsToCsv,
} from "../../../../domain/utils/csvExport";
import { usePosStore } from "../../../../application/store/usePosStore";

export interface TableExportColumn<T, K extends string = string> {
  // معرّف العمود المرتبط بـ useTableColumns (يُستخدم لتصدير الأعمدة الظاهرة فقط)
  columnId?: K;
  // عنوان العمود في الصف الأول من ملف Excel / CSV
  header: string;
  // دالة استخراج قيمة الخلية من كل سجل
  getValue: (item: T) => CsvCellValue;
}

export interface TableExportButtonProps<T, K extends string = string> {
  // قائمة السجلات المراد تصديرها (كامل النتائج المفلترة والمرتّبة)
  items: readonly T[];
  // تعريف أعمدة التصدير
  columns: readonly TableExportColumn<T, K>[];
  // دالة فحص ظهور العمود (عادةً columnsState.isVisible) لتصدير الأعمدة الظاهرة فقط
  isColumnVisible?: (columnId: K) => boolean;
  // بادئة اسم الملف (يُضاف لها تاريخ اليوم وامتداد .csv تلقائياً)
  fileNamePrefix: string;
  // نص الزر الظاهر للمستخدم
  label?: string;
  // تسمية نوع السجل لرسالة الإشعار بعد التصدير (مثلاً: "وردية"، "سند"، "تسوية")
  itemLabel?: string;
  // تعطيل إضافي اختياري للزر
  disabled?: boolean;
  // دالة اختيارية تُستدعى بعد إتمام التصدير بنجاح
  onExported?: (exportedCount: number, downloadedFileName: string) => void;
  className?: string;
}

/**
 * زر تصدير Excel / CSV الموحّد للجداول (TableExportButton)
 * يصدّر كامل النتائج المفلترة والمرتّبة مع احترام الأعمدة الظاهرة حالياً عند تمرير isColumnVisible
 */
export function TableExportButton<T, K extends string = string>({
  items,
  columns,
  isColumnVisible,
  fileNamePrefix,
  label = "تصدير Excel / CSV",
  itemLabel = "سجل",
  disabled = false,
  onExported,
  className = "",
}: TableExportButtonProps<T, K>) {
  const setNotification = usePosStore((s) => s.setNotification);

  // تصفية أعمدة التصدير لتطابق الأعمدة الظاهرة حالياً في الجدول
  const activeColumns = isColumnVisible
    ? columns.filter((col) => !col.columnId || isColumnVisible(col.columnId))
    : columns;

  const isDisabled =
    disabled || items.length === 0 || activeColumns.length === 0;

  const handleExport = () => {
    if (isDisabled) return;

    const headers = activeColumns.map((col) => col.header);
    const rows: CsvCellValue[][] = items.map((item) =>
      activeColumns.map((col) => col.getValue(item)),
    );

    const datePart = new Date().toISOString().slice(0, 10);
    const downloadedFileName = exportRowsToCsv({
      fileName: `${fileNamePrefix}_${datePart}.csv`,
      headers,
      rows,
    });

    setNotification({
      type: "success",
      message: `تم تصدير (${items.length} ${itemLabel}) إلى ملف ${downloadedFileName} بنجاح.`,
    });

    onExported?.(items.length, downloadedFileName);
  };

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={handleExport}
      title={
        items.length === 0
          ? "لا توجد بيانات مطابقة للتصدير"
          : `تصدير الأعمدة الظاهرة لكامل النتائج المطابقة (${items.length} ${itemLabel})`
      }
      className={`px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[11px] inline-flex items-center gap-1.5 transition ${className}`}
    >
      <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </button>
  );
}
