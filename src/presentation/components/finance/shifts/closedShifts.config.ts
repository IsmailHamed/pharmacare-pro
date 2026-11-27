import { ShiftSummaryEntity } from "../../../../domain/entities";
import { FilterPillOption } from "../../common/table/FilterPills";
import {
  SortAccessors,
  SortDirection,
  SortState,
} from "../../common/table/useTableSort";
import { TableColumnDef } from "../../common/table/useTableColumns";
import { TableExportColumn } from "../../common/table/TableExportButton";
import { AlertOctagon } from "lucide-react";

export type VarianceFilter = "ALL" | "WITH_VARIANCE";

// مفاتيح الأعمدة القابلة للفرز والتحكم في الظهور داخل أرشيف الورديات المغلقة
export type ClosedShiftSortKey =
  | "closedAt"
  | "pharmacistName"
  | "openingBalance"
  | "cashSalesTotal"
  | "expectedDrawerCash"
  | "actualDrawerCash"
  | "variance"
  | "safeDropAmount"
  | "nextShiftFloat";

export interface ClosedShiftsArchiveStats {
  totalCashSales: number;
  totalSafeDrop: number;
  netVariance: number;
  varianceShiftsCount: number;
}

// تعريف أعمدة الجدول للتحكم في الإظهار والإخفاء (مع قفل العمودين الأساسيين)
export const CLOSED_SHIFT_COLUMNS: readonly TableColumnDef<ClosedShiftSortKey>[] =
  [
    { id: "closedAt", label: "رقم الوردية والتاريخ", locked: true },
    { id: "pharmacistName", label: "صاحب العهدة / المُغلق", locked: true },
    { id: "openingBalance", label: "العهدة الافتتاحية" },
    { id: "cashSalesTotal", label: "مبيعات الكاش" },
    { id: "expectedDrawerCash", label: "النقد المتوقع" },
    { id: "actualDrawerCash", label: "الجرد الفعلي" },
    { id: "variance", label: "الفارق (Variance)" },
    { id: "safeDropAmount", label: "المورّد للخزنة" },
    { id: "nextShiftFloat", label: "العهدة المرحلة" },
  ];

// أعمدة التصدير إلى Excel / CSV مرتبطة بمعرّفات الأعمدة لتصدير الحقول الظاهرة فقط
export const CLOSED_SHIFT_EXPORT_COLUMNS: readonly TableExportColumn<
  ShiftSummaryEntity,
  ClosedShiftSortKey
>[] = [
  { columnId: "closedAt", header: "رقم الوردية", getValue: (s) => s.id },
  {
    columnId: "closedAt",
    header: "تاريخ ووقت الإغلاق",
    getValue: (s) =>
      s.closedAt ? s.closedAt.slice(0, 16).replace("T", " ") : "—",
  },
  {
    columnId: "pharmacistName",
    header: "صاحب العهدة",
    getValue: (s) => s.pharmacistName,
  },
  {
    columnId: "pharmacistName",
    header: "أغلقها",
    getValue: (s) => s.closedByName || s.pharmacistName,
  },
  {
    columnId: "openingBalance",
    header: "العهدة الافتتاحية",
    getValue: (s) => s.openingBalance.toFixed(2),
  },
  {
    columnId: "cashSalesTotal",
    header: "مبيعات الكاش",
    getValue: (s) => s.cashSalesTotal.toFixed(2),
  },
  {
    columnId: "expectedDrawerCash",
    header: "النقد المتوقع",
    getValue: (s) => s.expectedDrawerCash.toFixed(2),
  },
  {
    columnId: "actualDrawerCash",
    header: "الجرد الفعلي",
    getValue: (s) => (s.actualDrawerCash ?? 0).toFixed(2),
  },
  {
    columnId: "variance",
    header: "الفارق (Variance)",
    getValue: (s) => (s.variance || 0).toFixed(2),
  },
  {
    columnId: "safeDropAmount",
    header: "المورّد للخزنة",
    getValue: (s) => (s.safeDropAmount || 0).toFixed(2),
  },
  {
    columnId: "nextShiftFloat",
    header: "العهدة المرحلة",
    getValue: (s) => (s.nextShiftFloat || 0).toFixed(2),
  },
];

// دوال استخراج قيم الأعمدة للفرز (مُعرّفة خارج المكوّن للحفاظ على ثبات المرجع)
export const CLOSED_SHIFT_SORT_ACCESSORS: SortAccessors<
  ShiftSummaryEntity,
  ClosedShiftSortKey
> = {
  closedAt: (s) => (s.closedAt ? new Date(s.closedAt) : s.id),
  pharmacistName: (s) => s.pharmacistName,
  openingBalance: (s) => s.openingBalance,
  cashSalesTotal: (s) => s.cashSalesTotal,
  expectedDrawerCash: (s) => s.expectedDrawerCash,
  actualDrawerCash: (s) => s.actualDrawerCash ?? 0,
  variance: (s) => s.variance || 0,
  safeDropAmount: (s) => s.safeDropAmount || 0,
  nextShiftFloat: (s) => s.nextShiftFloat || 0,
};

// الترتيب الافتراضي للأرشيف (الأحدث إغلاقاً أولاً) والاتجاه الابتدائي لكل عمود عند النقر الأول
export const DEFAULT_CLOSED_SHIFT_SORT: SortState<ClosedShiftSortKey> = {
  key: "closedAt",
  direction: "desc",
};

export const CLOSED_SHIFT_DEFAULT_DIRECTIONS: Partial<
  Record<ClosedShiftSortKey, SortDirection>
> = {
  closedAt: "desc",
  pharmacistName: "asc",
  openingBalance: "desc",
  cashSalesTotal: "desc",
  expectedDrawerCash: "desc",
  actualDrawerCash: "desc",
  variance: "asc",
  safeDropAmount: "desc",
  nextShiftFloat: "desc",
};

// حساب إحصائيات الملخص العلوي لكامل أرشيف الورديات المغلقة
export const computeClosedShiftsArchiveStats = (
  closedShifts: ShiftSummaryEntity[],
): ClosedShiftsArchiveStats => {
  let totalCashSales = 0;
  let totalSafeDrop = 0;
  let netVariance = 0;
  let varianceShiftsCount = 0;

  closedShifts.forEach((s) => {
    totalCashSales += s.cashSalesTotal;
    totalSafeDrop += s.safeDropAmount || 0;
    const variance = s.variance || 0;
    netVariance += variance;
    if (variance !== 0) varianceShiftsCount += 1;
  });

  return {
    totalCashSales,
    totalSafeDrop,
    netVariance,
    varianceShiftsCount,
  };
};

// خيارات فلتر الفروقات الممرّرة إلى المكوّن الموحّد FilterPills
export const getVarianceFilterOptions = (
  totalCount: number,
  varianceShiftsCount: number,
): FilterPillOption<VarianceFilter>[] => [
  {
    id: "ALL",
    label: "كل الورديات",
    count: totalCount,
    tone: "slate",
  },
  {
    id: "WITH_VARIANCE",
    label: "ذات الفارق",
    count: varianceShiftsCount,
    icon: AlertOctagon,
    tone: "rose",
  },
];
