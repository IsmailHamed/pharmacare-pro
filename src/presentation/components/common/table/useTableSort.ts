import { useCallback, useMemo, useState } from "react";

// اتجاه الفرز المعتمد في الجداول: تصاعدي أو تنازلي
export type SortDirection = "asc" | "desc";

// حالة الفرز النشطة حالياً (أو null عند عدم تفعيل فرز محدد)
export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

// أنواع القيم القابلة للمقارنة التي تعيدها دالة استخراج قيمة العمود
export type SortableValue = string | number | boolean | Date | null | undefined;

// خريطة دوال استخراج القيمة لكل عمود قابل للفرز في الجدول
export type SortAccessors<T, K extends string> = Record<
  K,
  (item: T) => SortableValue
>;

export interface UseTableSortOptions<T, K extends string> {
  // دوال استخراج القيمة المقابلة لكل مفتاح عمود (يُفضّل تعريفها خارج المكوّن أو داخل useMemo)
  accessors: SortAccessors<T, K>;
  // حالة الفرز الابتدائية عند فتح الجدول (مثلاً: الأحدث أولاً حسب createdAt)
  defaultSort?: SortState<K> | null;
  // الاتجاه الافتراضي لكل عمود عند النقر عليه لأول مرة (مثلاً: التواريخ والمبالغ تنازلياً، والأسماء تصاعدياً)
  defaultDirections?: Partial<Record<K, SortDirection>>;
  // عند التفعيل، النقرة الثالثة على نفس العمود تُلغي الفرز وتعيد الترتيب الأصلي
  allowClear?: boolean;
}

export interface UseTableSortResult<T, K extends string> {
  // نسخة جديدة من الصفوف مرتّبة حسب حالة الفرز الحالية دون تعديل المصفوفة الأصلية
  sortedItems: T[];
  // حالة الفرز النشطة حالياً
  sortState: SortState<K> | null;
  // تبديل الفرز عند النقر على رأس أي عمود
  toggleSort: (key: K, preferredInitialDirection?: SortDirection) => void;
  // تعيين حالة الفرز برمجياً عند الحاجة (مثل أزرار "الأحدث أولاً / الأقدم أولاً")
  setSortState: React.Dispatch<React.SetStateAction<SortState<K> | null>>;
  // إعادة الفرز إلى الحالة الابتدائية الافتراضية
  resetSort: () => void;
  // دالة مساعدة تُعيد اتجاه العمود الحالي لتمريرها مباشرةً إلى مكوّن <SortableTh />
  getSortDirection: (key: K) => SortDirection | null;
}

/**
 * التحقق مما إذا كانت القيمة فارغة أو غير صالحة للمقارنة حتى تُدفع تلقائياً لنهاية الجدول
 */
const isEmptySortValue = (val: SortableValue): boolean => {
  if (val === null || val === undefined) return true;
  if (typeof val === "number" && Number.isNaN(val)) return true;
  if (val instanceof Date && Number.isNaN(val.getTime())) return true;
  if (typeof val === "string" && val.trim() === "") return true;
  return false;
};

/**
 * مقارنة قيمتين قابلتين للفرز بدقة مع دعم النصوص العربية والأرقام والتواريخ والقيم المنطقية
 */
const compareSortableValues = (
  a: SortableValue,
  b: SortableValue,
  direction: SortDirection,
): number => {
  const aEmpty = isEmptySortValue(a);
  const bEmpty = isEmptySortValue(b);

  // إبقاء القيم الفارغة (مثل أصناف بدون تاريخ صلاحية أو فاتورة بدون رقم مورد) دائماً في الأسفل
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  let baseComparison = 0;

  if (a instanceof Date && b instanceof Date) {
    baseComparison = a.getTime() - b.getTime();
  } else if (typeof a === "number" && typeof b === "number") {
    baseComparison = a - b;
  } else if (typeof a === "boolean" && typeof b === "boolean") {
    baseComparison = Number(a) - Number(b);
  } else {
    // مقارنة نصية داعمة للعربية مع الترتيب الرقمي الطبيعي (numeric: true)
    baseComparison = String(a).localeCompare(String(b), "ar", {
      numeric: true,
      sensitivity: "base",
    });
  }

  return direction === "asc" ? baseComparison : -baseComparison;
};

/**
 * Hook موحّد لفرز الجداول بالأعمدة التفاعلية (Column Sorting)
 */
export const useTableSort = <T, K extends string>(
  items: readonly T[],
  options: UseTableSortOptions<T, K>,
): UseTableSortResult<T, K> => {
  const {
    accessors,
    defaultSort = null,
    defaultDirections,
    allowClear = false,
  } = options;

  const [sortState, setSortState] = useState<SortState<K> | null>(defaultSort);

  // تبديل اتجاه الفرز عند النقر على رأس العمود
  const toggleSort = useCallback(
    (key: K, preferredInitialDirection?: SortDirection) => {
      setSortState((prev) => {
        const initialDir: SortDirection =
          preferredInitialDirection ?? defaultDirections?.[key] ?? "asc";

        // إذا كان النقر على عمود جديد نبدأ باتجاهه الافتراضي
        if (!prev || prev.key !== key) {
          return { key, direction: initialDir };
        }

        // إذا كان العمود هو نفسه في الاتجاه الابتدائي نعكس الاتجاه
        if (prev.direction === initialDir) {
          return {
            key,
            direction: initialDir === "asc" ? "desc" : "asc",
          };
        }

        // عند التفعيل، النقرة الثالثة تعيد الترتيب الأصلي، وإلا تعود للاتجاه الابتدائي
        if (allowClear) {
          return null;
        }
        return { key, direction: initialDir };
      });
    },
    [defaultDirections, allowClear],
  );

  // إعادة الفرز إلى الحالة الابتدائية المحددة للجدول
  const resetSort = useCallback(() => {
    setSortState(defaultSort);
  }, [defaultSort]);

  // استرجاع اتجاه فرز عمود معيّن لتمييزه بصرياً في رأس الجدول
  const getSortDirection = useCallback(
    (key: K): SortDirection | null =>
      sortState && sortState.key === key ? sortState.direction : null,
    [sortState],
  );

  // تنفيذ الفرز على نسخة جديدة من المصفوفة لضمان عدم تعديل بيانات المتجر الأصلية
  const sortedItems = useMemo(() => {
    if (!sortState) return [...items];

    const accessor = accessors[sortState.key];
    if (!accessor) return [...items];

    return [...items].sort((itemA, itemB) =>
      compareSortableValues(
        accessor(itemA),
        accessor(itemB),
        sortState.direction,
      ),
    );
  }, [items, sortState, accessors]);

  return {
    sortedItems,
    sortState,
    toggleSort,
    setSortState,
    resetSort,
    getSortDirection,
  };
};
