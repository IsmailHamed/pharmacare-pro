import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// الحجم الافتراضي للدفعة الواحدة في جداول النظام لتوازن الأداء وسرعة التصفح
export const DEFAULT_TABLE_PAGE_SIZE = 50;

export interface UseTablePaginationOptions {
  // عدد الصفوف المضافة في كل دفعة (الافتراضي: 50)
  pageSize?: number;
  // مصفوفة القيم (مثل عبارة البحث والفلاتر) التي يعيد تغيّر أي منها العداد للصفحة الأولى تلقائياً
  resetDeps?: readonly unknown[];
}

export interface UseTablePaginationResult<T> {
  // الصفوف المعروضة حالياً بعد تقطيعها حسب الحد المرئي
  visibleItems: T[];
  // عدد الصفوف الظاهرة فعلياً على الشاشة الآن
  visibleCount: number;
  // إجمالي عدد الصفوف بعد تطبيق الفلاتر
  totalCount: number;
  // عدد الصفوف المتبقية التي لم تُعرض بعد
  remainingCount: number;
  // هل توجد صفوف إضافية يمكن تحميلها؟
  hasMore: boolean;
  // حجم الدفعة المستخدم حالياً
  pageSize: number;
  // تحميل دفعة إضافية من الصفوف (+pageSize)
  loadMore: () => void;
  // عرض كافة الصفوف المتبقية دفعة واحدة عند الحاجة
  showAll: () => void;
  // إعادة ضبط العرض يدوياً إلى الدفعة الأولى
  resetPagination: () => void;
}

/**
 * Hook موحّد للتحميل التدريجي لصفوف الجداول (Incremental Pagination)
 * يحمي الأداء عند التعامل مع مئات أو آلاف الأصناف والفواتير ويعيد الضبط تلقائياً عند تغيّر الفلاتر
 */
export const useTablePagination = <T>(
  items: readonly T[],
  options: UseTablePaginationOptions = {},
): UseTablePaginationResult<T> => {
  const { pageSize = DEFAULT_TABLE_PAGE_SIZE, resetDeps } = options;

  // ضمان أن يكون حجم الدفعة عدداً صحيحاً موجباً على الأقل 1
  const safePageSize = Math.max(1, Math.floor(pageSize));

  const [visibleLimit, setVisibleLimit] = useState<number>(safePageSize);

  // مرجع لحفظ آخر قيم الفلاتر لمقارنتها سطحياً وتجنب إعادة الضبط غير المبرر عند كل Render
  const prevResetDepsRef = useRef<readonly unknown[] | undefined>(resetDeps);
  const prevPageSizeRef = useRef<number>(safePageSize);

  // إعادة ضبط الحد المرئي عند تغيّر حجم الدفعة الأساسية
  useEffect(() => {
    if (prevPageSizeRef.current !== safePageSize) {
      setVisibleLimit(safePageSize);
      prevPageSizeRef.current = safePageSize;
    }
  }, [safePageSize]);

  // إعادة ضبط الحد المرئي تلقائياً إلى الدفعة الأولى فور تغيّر أي قيمة في resetDeps
  useEffect(() => {
    if (!resetDeps) return;

    const prev = prevResetDepsRef.current;
    const hasChanged =
      !prev ||
      prev.length !== resetDeps.length ||
      resetDeps.some((val, idx) => !Object.is(val, prev[idx]));

    if (hasChanged) {
      setVisibleLimit(safePageSize);
      prevResetDepsRef.current = resetDeps;
    }
  }, [resetDeps, safePageSize]);

  // تقطيع المصفوفة المعروضة فقط عند تغيّر العناصر أو الحد المرئي
  const visibleItems = useMemo(
    () => items.slice(0, visibleLimit),
    [items, visibleLimit],
  );

  const totalCount = items.length;
  const visibleCount = visibleItems.length;
  const remainingCount = Math.max(0, totalCount - visibleCount);
  const hasMore = remainingCount > 0;

  // زيادة الحد المرئي بمقدار دفعة واحدة مع عدم تجاوز العدد الإجمالي
  const loadMore = useCallback(() => {
    setVisibleLimit((prev) => prev + safePageSize);
  }, [safePageSize]);

  // إظهار كافة الصفوف المتبقية دفعة واحدة
  const showAll = useCallback(() => {
    setVisibleLimit(Math.max(safePageSize, items.length));
  }, [safePageSize, items.length]);

  // إعادة العداد يدوياً إلى الدفعة الأولى
  const resetPagination = useCallback(() => {
    setVisibleLimit(safePageSize);
  }, [safePageSize]);

  return {
    visibleItems,
    visibleCount,
    totalCount,
    remainingCount,
    hasMore,
    pageSize: safePageSize,
    loadMore,
    showAll,
    resetPagination,
  };
};
