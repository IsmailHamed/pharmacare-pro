import { useCallback, useEffect, useMemo, useState } from "react";

export interface TableColumnDef<K extends string = string> {
  // المعرّف الفريد للعمود
  id: K;
  // اسم العمود الظاهر للمستخدم داخل قائمة إظهار/إخفاء الأعمدة
  label: string;
  // عمود مقفل لا يمكن للمستخدم إخفاؤه (مثل الاسم أو رقم القيد أو الإجراءات)
  locked?: boolean;
  // هل العمود ظاهر افتراضياً عند أول استخدام؟ (الافتراضي: true)
  defaultVisible?: boolean;
}

export interface UseTableColumnsResult<K extends string = string> {
  // قائمة تعريفات الأعمدة الحالية (تُمرّر مباشرةً إلى ColumnVisibilityMenu)
  columns: readonly TableColumnDef<K>[];
  // خريطة حالة الظهور لكل عمود
  visibleMap: Record<K, boolean>;
  // دالة فحص سريعة داخل JSX لتحديد هل يُعرض العمود أم لا
  isVisible: (columnId: K) => boolean;
  // تبديل حالة ظهور عمود معيّن (تتجاهل الأعمدة المقفلة)
  toggleColumn: (columnId: K) => void;
  // تعيين حالة ظهور عمود معيّن بشكل صريح
  setColumnVisible: (columnId: K, visible: boolean) => void;
  // إظهار جميع الأعمدة دفعة واحدة
  showAll: () => void;
  // إعادة جميع الأعمدة إلى حالتها الافتراضية ومسح التخصيص المحفوظ
  resetColumns: () => void;
  // عدد الأعمدة الظاهرة حالياً
  visibleCount: number;
  // إجمالي عدد الأعمدة المعرّفة
  totalCount: number;
  // عدد الأعمدة المخفية حالياً
  hiddenCount: number;
  // هل تختلف الحالة الحالية عن الإعدادات الافتراضية؟
  hasCustomVisibility: boolean;
}

const STORAGE_PREFIX = "pos_table_cols_";

// قراءة التخصيص المحفوظ بأمان من localStorage
const readStoredVisibility = (
  storageKey: string,
): Record<string, boolean> | null => {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, boolean>;
    }
    return null;
  } catch {
    return null;
  }
};

// حفظ التخصيص بأمان في localStorage
const writeStoredVisibility = (
  storageKey: string,
  map: Record<string, boolean>,
): void => {
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${storageKey}`,
      JSON.stringify(map),
    );
  } catch {
    // تجاهل أخطاء امتلاء التخزين أو تعطيله بصمت دون تعطيل الواجهة
  }
};

// حذف التخصيص المحفوظ عند إعادة الضبط للافتراضي
const clearStoredVisibility = (storageKey: string): void => {
  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${storageKey}`);
  } catch {
    // تجاهل أخطاء التخزين بصمت
  }
};

// بناء خريطة الحالة الافتراضية من تعريفات الأعمدة
const buildDefaultMap = <K extends string>(
  columns: readonly TableColumnDef<K>[],
): Record<K, boolean> => {
  const map = {} as Record<K, boolean>;
  columns.forEach((col) => {
    map[col.id] = col.locked ? true : (col.defaultVisible ?? true);
  });
  return map;
};

/**
 * Hook موحّد لإدارة إظهار وإخفاء أعمدة الجداول مع حفظ تفضيلات المستخدم في localStorage
 * لا يؤثر على التصدير (التصدير يبقى شاملاً لكافة الأعمدة المسموح بها للمستخدم)
 */
export function useTableColumns<K extends string>(
  storageKey: string,
  columns: readonly TableColumnDef<K>[],
): UseTableColumnsResult<K> {
  // تخزين التخصيصات اليدوية للمستخدم فقط، ثم دمجها لحظياً مع قائمة الأعمدة الحالية
  const [storedOverrides, setStoredOverrides] = useState<
    Record<string, boolean>
  >(() => readStoredVisibility(storageKey) ?? {});

  // إعادة قراءة التخصيص تلقائياً في حال تغيّر مفتاح الجدول (مثل التبديل بين العملاء والمستودعات)
  useEffect(() => {
    setStoredOverrides(readStoredVisibility(storageKey) ?? {});
  }, [storageKey]);

  const defaultMap = useMemo(() => buildDefaultMap(columns), [columns]);

  // الخريطة النهائية الفعّالة: تضمن دائماً بقاء الأعمدة المقفلة ظاهرة
  const visibleMap = useMemo(() => {
    const map = {} as Record<K, boolean>;
    columns.forEach((col) => {
      if (col.locked) {
        map[col.id] = true;
      } else if (typeof storedOverrides[col.id] === "boolean") {
        map[col.id] = storedOverrides[col.id];
      } else {
        map[col.id] = col.defaultVisible ?? true;
      }
    });
    return map;
  }, [columns, storedOverrides]);

  const isVisible = useCallback(
    (columnId: K): boolean => visibleMap[columnId] ?? true,
    [visibleMap],
  );

  const setColumnVisible = useCallback(
    (columnId: K, nextVisible: boolean) => {
      const targetCol = columns.find((c) => c.id === columnId);
      if (!targetCol || targetCol.locked) return;

      setStoredOverrides((prev) => {
        // منع إخفاء آخر عمود ظاهر في الجدول
        if (!nextVisible) {
          const currentVisibleCount = columns.filter((col) =>
            col.locked
              ? true
              : typeof prev[col.id] === "boolean"
                ? prev[col.id]
                : (col.defaultVisible ?? true),
          ).length;

          if (currentVisibleCount <= 1) {
            return prev;
          }
        }

        const next = { ...prev, [columnId]: nextVisible };
        writeStoredVisibility(storageKey, next);
        return next;
      });
    },
    [columns, storageKey],
  );

  const toggleColumn = useCallback(
    (columnId: K) => {
      setColumnVisible(columnId, !isVisible(columnId));
    },
    [isVisible, setColumnVisible],
  );

  const showAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    columns.forEach((col) => {
      next[col.id] = true;
    });
    writeStoredVisibility(storageKey, next);
    setStoredOverrides(next);
  }, [columns, storageKey]);

  const resetColumns = useCallback(() => {
    clearStoredVisibility(storageKey);
    setStoredOverrides({});
  }, [storageKey]);

  const totalCount = columns.length;
  const visibleCount = useMemo(
    () => columns.filter((col) => visibleMap[col.id]).length,
    [columns, visibleMap],
  );
  const hiddenCount = totalCount - visibleCount;

  const hasCustomVisibility = useMemo(
    () => columns.some((col) => visibleMap[col.id] !== defaultMap[col.id]),
    [columns, visibleMap, defaultMap],
  );

  return {
    columns,
    visibleMap,
    isVisible,
    toggleColumn,
    setColumnVisible,
    showAll,
    resetColumns,
    visibleCount,
    totalCount,
    hiddenCount,
    hasCustomVisibility,
  };
}
