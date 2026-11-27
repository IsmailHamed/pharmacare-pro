import { ProductEntity } from "../../../../domain/entities";
import { FilterPillOption } from "../../common/table/FilterPills";
import { SortAccessors, SortDirection } from "../../common/table/useTableSort";
import { TableColumnDef } from "../../common/table/useTableColumns";
import { TableExportColumn } from "../../common/table/TableExportButton";
import { AlertTriangle, ArchiveRestore, Clock, Flame } from "lucide-react";

export const INVENTORY_PAGE_SIZE = 50;

export type InventoryFilterMode =
  | "ALL"
  | "EXP_30"
  | "EXP_90"
  | "EXP_180"
  | "LOW_STOCK"
  | "DEAD_STOCK";

// مفاتيح الأعمدة القابلة للفرز والتحكم في الظهور في جدول المخزون ورادار الصلاحيات
export type InventorySortKey =
  | "name"
  | "category"
  | "stockPacks"
  | "nearestExpiry"
  | "packPrice"
  | "weightedCostPrice";

export interface NearestExpiryInfo {
  days: number;
  expiryDate: string | null;
  activeBatchesCount: number;
}

export interface InventoryRadarStats {
  lowStockCount: number;
  exp30Count: number;
  exp90Count: number;
  exp180Count: number;
  deadStockCount: number;
}

// الاتجاه الابتدائي المفضّل لكل عمود عند النقر الأول (الأقل رصيداً والأقرب صلاحية أولاً)
export const INVENTORY_DEFAULT_DIRECTIONS: Partial<
  Record<InventorySortKey, SortDirection>
> = {
  name: "asc",
  category: "asc",
  stockPacks: "asc",
  nearestExpiry: "asc",
  packPrice: "desc",
  weightedCostPrice: "desc",
};

export const getNearestExpiryInfo = (
  product: ProductEntity,
): NearestExpiryInfo => {
  const activeBatches = (product.batches || [])
    .filter((b) => b.qtyPacks > 0 && Boolean(b.expiryDate))
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  if (activeBatches.length === 0) {
    return { days: 9999, expiryDate: null, activeBatchesCount: 0 };
  }

  const nearest = activeBatches[0];
  const expMs = new Date(nearest.expiryDate).getTime();
  const days = Number.isNaN(expMs)
    ? 9999
    : Math.ceil((expMs - Date.now()) / (1000 * 60 * 60 * 24));

  return {
    days,
    expiryDate: nearest.expiryDate,
    activeBatchesCount: activeBatches.length,
  };
};

// تعريف أعمدة الجدول القابلة للإظهار/الإخفاء مع احترام صلاحية عرض التكلفة
export const getInventoryTableColumns = (
  canViewCost: boolean,
): TableColumnDef<InventorySortKey>[] => {
  const base: TableColumnDef<InventorySortKey>[] = [
    { id: "name", label: "الدواء / المادة الفعالة", locked: true },
    { id: "category", label: "التصنيف" },
    { id: "stockPacks", label: "الرصيد المتاح" },
    { id: "nearestExpiry", label: "أقرب صلاحية (FEFO)" },
    { id: "packPrice", label: "سعر البيع" },
  ];
  if (canViewCost) {
    base.push({ id: "weightedCostPrice", label: "التكلفة / الهامش" });
  }
  return base;
};

// أعمدة التصدير إلى Excel / CSV مرتبطة بمعرّفات الأعمدة لتصدير الحقول الظاهرة فقط واحترام صلاحية التكلفة
export const getInventoryExportColumns = (
  canViewCost: boolean,
  expiryInfoMap: Map<string, NearestExpiryInfo>,
): TableExportColumn<ProductEntity, InventorySortKey>[] => {
  const cols: TableExportColumn<ProductEntity, InventorySortKey>[] = [
    { columnId: "name", header: "الاسم التجاري", getValue: (p) => p.name },
    {
      columnId: "name",
      header: "المادة الفعالة",
      getValue: (p) => p.scientificName,
    },
    { columnId: "name", header: "الباركود", getValue: (p) => p.barcode },
    {
      columnId: "category",
      header: "التصنيف",
      getValue: (p) => p.category || "عام",
    },
    {
      columnId: "stockPacks",
      header: "الرصيد (علبة)",
      getValue: (p) => p.stockPacks,
    },
    {
      columnId: "stockPacks",
      header: "أشرطة فرط",
      getValue: (p) => p.stockLooseStrips,
    },
    {
      columnId: "stockPacks",
      header: "حد الطلب الأدنى",
      getValue: (p) => p.minLimit,
    },
    {
      columnId: "nearestExpiry",
      header: "أقرب تاريخ صلاحية",
      getValue: (p) => expiryInfoMap.get(p.id)?.expiryDate || "—",
    },
    {
      columnId: "nearestExpiry",
      header: "الأيام المتبقية للصلاحية",
      getValue: (p) => {
        const info = expiryInfoMap.get(p.id);
        return info?.expiryDate ? info.days : "—";
      },
    },
    {
      columnId: "packPrice",
      header: "سعر البيع (علبة)",
      getValue: (p) => p.packPrice.toFixed(2),
    },
  ];

  if (canViewCost) {
    cols.push(
      {
        columnId: "weightedCostPrice",
        header: "التكلفة المرجحة",
        getValue: (p) => p.weightedCostPrice.toFixed(2),
      },
      {
        columnId: "weightedCostPrice",
        header: "هامش الربح (%)",
        getValue: (p) =>
          `${(
            ((p.packPrice - p.weightedCostPrice) /
              Math.max(0.01, p.weightedCostPrice)) *
            100
          ).toFixed(0)}%`,
      },
    );
  }

  return cols;
};

// دوال استخراج قيم الأعمدة للفرز (مع إبقاء الأصناف بدون صلاحية مسجلة في الأسفل تلقائياً)
export const createInventorySortAccessors = (
  expiryInfoMap: Map<string, NearestExpiryInfo>,
): SortAccessors<ProductEntity, InventorySortKey> => ({
  name: (p) => p.name,
  category: (p) => p.category || "عام",
  stockPacks: (p) =>
    p.stockPacks + p.stockLooseStrips / Math.max(1, p.stripsPerPack),
  nearestExpiry: (p) => {
    const info = expiryInfoMap.get(p.id);
    return info?.expiryDate ? info.days : null;
  },
  packPrice: (p) => p.packPrice,
  weightedCostPrice: (p) => p.weightedCostPrice,
});

// حساب إحصائيات رادار الصلاحيات والنواقص والراكد
export const computeInventoryRadarStats = (
  products: ProductEntity[],
  expiryInfoMap: Map<string, NearestExpiryInfo>,
  soldProductIdsLast60Days: Set<string>,
): InventoryRadarStats => {
  let lowStockCount = 0;
  let exp30Count = 0;
  let exp90Count = 0;
  let exp180Count = 0;
  let deadStockCount = 0;

  products.forEach((p) => {
    if (p.stockPacks <= p.minLimit) lowStockCount++;
    const days = expiryInfoMap.get(p.id)?.days ?? 9999;
    if (days <= 30) exp30Count++;
    else if (days <= 90) exp90Count++;
    else if (days <= 180) exp180Count++;

    if (p.stockPacks > p.minLimit && !soldProductIdsLast60Days.has(p.id)) {
      deadStockCount++;
    }
  });

  return {
    lowStockCount,
    exp30Count,
    exp90Count,
    exp180Count,
    deadStockCount,
  };
};

// بناء خيارات حبوب رادار الصلاحيات والمخزون الممرّرة إلى المكوّن الموحّد FilterPills
export const getInventoryFilterPillOptions = (
  totalCount: number,
  radarStats: InventoryRadarStats,
): FilterPillOption<InventoryFilterMode>[] => [
  {
    id: "ALL",
    label: "الكل",
    count: totalCount,
    tone: "slate",
  },
  {
    id: "EXP_30",
    label: "خطر ≤30 يوماً",
    count: radarStats.exp30Count,
    icon: Flame,
    tone: "rose",
    highlightWhenInactive: true,
  },
  {
    id: "EXP_90",
    label: "قريبة 31–90 يوماً",
    count: radarStats.exp90Count,
    icon: Clock,
    tone: "amber",
    highlightWhenInactive: true,
  },
  {
    id: "EXP_180",
    label: "تنبيه 91–180 يوماً",
    count: radarStats.exp180Count,
    tone: "amber",
    highlightWhenInactive: true,
  },
  {
    id: "LOW_STOCK",
    label: "نواقص",
    count: radarStats.lowStockCount,
    icon: AlertTriangle,
    tone: "sky",
    highlightWhenInactive: true,
  },
  {
    id: "DEAD_STOCK",
    label: "راكد",
    count: radarStats.deadStockCount,
    icon: ArchiveRestore,
    tone: "purple",
    highlightWhenInactive: true,
  },
];
