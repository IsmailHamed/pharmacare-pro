import {
  ProductEntity,
  PurchaseOrderEntity,
  SupplierEntity,
} from "../../../../domain/entities";
import { CreatePurchaseOrderInput } from "../../../../application/store/storeTypes";
import {
  CsvCellValue,
  exportRowsToCsv,
} from "../../../../domain/utils/csvExport";
import { SortDirection } from "../../common/table/useTableSort";
import { TableColumnDef } from "../../common/table/useTableColumns";
import { TableExportColumn } from "../../common/table/TableExportButton";

export const SHORTAGE_PAGE_SIZE = 50;
export const OUT_OF_STOCK_KEY = "__OUT_OF_STOCK__";
export const ASSIGNED_KEY = "__ASSIGNED__";
export const UNASSIGNED_KEY = "__UNASSIGNED__";

// مفاتيح الأعمدة القابلة للفرز والتحكم في الظهور في جدول دفتر النواقص
export type ShortageSortKey =
  | "name"
  | "stockPacks"
  | "supplierName"
  | "weightedCostPrice"
  | "orderQty"
  | "estimatedTotal";

// تمثيل أمر شراء مفتوح مرتبط بصنف معيّن لعرض حالته الفعلية ومنع تكرار الطلب لنفس المستودع فقط
export interface ProductOpenOrderEntry {
  orderId: string;
  supplierId?: string;
  supplierName: string;
  status: "DRAFT" | "SENT" | "PARTIAL";
  remainingPacks: number;
}

// بطاقة سلّة حيّة لمستودع محدد جاهزة للاعتماد المستقل أو النسخ السريع
export interface LiveSupplierBasket {
  supplier: SupplierEntity;
  draft: CreatePurchaseOrderInput;
  itemsCount: number;
  totalPacks: number;
  estimatedTotal: number;
}

export interface ActiveShortageOrderItem {
  product: ProductEntity;
  qty: number;
  supplier: SupplierEntity | null;
}

export const OPEN_ORDER_STATUS_META: Record<
  ProductOpenOrderEntry["status"],
  { label: string; cls: string }
> = {
  DRAFT: {
    label: "قيد الطلب (مسودة)",
    cls: "bg-slate-800/90 border-slate-700 text-slate-300",
  },
  SENT: {
    label: "مُرسل للمستودع",
    cls: "bg-sky-950/70 border-sky-700/80 text-sky-300",
  },
  PARTIAL: {
    label: "استلام جزئي",
    cls: "bg-amber-950/70 border-amber-700/80 text-amber-300",
  },
};

// الاتجاه الابتدائي المفضّل عند النقر الأول على كل عمود في جدول النواقص
export const SHORTAGE_DEFAULT_DIRECTIONS: Partial<
  Record<ShortageSortKey, SortDirection>
> = {
  name: "asc",
  stockPacks: "asc",
  supplierName: "asc",
  weightedCostPrice: "desc",
  orderQty: "desc",
  estimatedTotal: "desc",
};

export const getSuggestedQty = (product: ProductEntity): number =>
  Math.max(5, product.minLimit * 2 - product.stockPacks);

// التحقق مما إذا كان الصنف مدرجاً بالفعل في أمر شراء مفتوح لنفس المستودع المحدد (مع السماح بطلبه من مستودعات أخرى)
export const hasOpenOrderForSupplier = (
  entries: ProductOpenOrderEntry[] | undefined,
  supplier: SupplierEntity,
): boolean => {
  if (!entries || entries.length === 0) return false;
  const cleanName = supplier.name.trim().toLowerCase();
  return entries.some(
    (entry) =>
      (entry.supplierId && entry.supplierId === supplier.id) ||
      entry.supplierName.trim().toLowerCase() === cleanName,
  );
};

// تتبع كافة أوامر الشراء المفتوحة لكل صنف مع حالتها الفعلية واسم المستودع
export const buildOpenOrdersByProductMap = (
  purchaseOrders: PurchaseOrderEntity[],
): Map<string, ProductOpenOrderEntry[]> => {
  const map = new Map<string, ProductOpenOrderEntry[]>();

  purchaseOrders.forEach((order) => {
    if (
      order.status !== "DRAFT" &&
      order.status !== "SENT" &&
      order.status !== "PARTIAL"
    ) {
      return;
    }

    const openStatus = order.status;
    order.items.forEach((item) => {
      const remaining = Math.max(0, item.orderedPacks - item.receivedPacks);
      if (remaining <= 0) return;

      const entry: ProductOpenOrderEntry = {
        orderId: order.id,
        supplierId: order.supplierId,
        supplierName: order.supplierName,
        status: openStatus,
        remainingPacks: remaining,
      };

      const existing = map.get(item.productId);
      if (existing) {
        existing.push(entry);
      } else {
        map.set(item.productId, [entry]);
      }
    });
  });

  return map;
};

// تعريف أعمدة جدول النواقص للتحكم في الإظهار والإخفاء مع احترام صلاحية عرض التكلفة
export const getShortageTableColumns = (
  canViewCost: boolean,
): TableColumnDef<ShortageSortKey>[] => {
  const base: TableColumnDef<ShortageSortKey>[] = [
    { id: "name", label: "الدواء / المادة الفعالة", locked: true },
    { id: "stockPacks", label: "الرصيد / الحد" },
    { id: "supplierName", label: "المستودع الموجه له الطلب" },
  ];
  if (canViewCost) {
    base.push({ id: "weightedCostPrice", label: "آخر تكلفة" });
  }
  base.push({
    id: "orderQty",
    label: "الكمية المطلوبة (علبة)",
    locked: true,
  });
  if (canViewCost) {
    base.push({ id: "estimatedTotal", label: "الإجمالي التقديري" });
  }
  return base;
};

// أعمدة تصدير جدول النواقص إلى Excel / CSV مرتبطة بمعرّفات الأعمدة لتصدير الحقول الظاهرة فقط واحترام صلاحية التكلفة
export const getShortageExportColumns = (params: {
  canViewCost: boolean;
  assignedSupplierMap: Record<string, string>;
  suppliersById: Map<string, SupplierEntity>;
  orderQtyMap: Record<string, number>;
}): TableExportColumn<ProductEntity, ShortageSortKey>[] => {
  const { canViewCost, assignedSupplierMap, suppliersById, orderQtyMap } =
    params;

  const cols: TableExportColumn<ProductEntity, ShortageSortKey>[] = [
    {
      columnId: "name",
      header: "الاسم التجاري للدواء",
      getValue: (p) => p.name,
    },
    {
      columnId: "name",
      header: "المادة الفعالة",
      getValue: (p) => p.scientificName,
    },
    { columnId: "name", header: "الباركود", getValue: (p) => p.barcode },
    {
      columnId: "stockPacks",
      header: "الرصيد الحالي (علبة)",
      getValue: (p) => p.stockPacks,
    },
    {
      columnId: "stockPacks",
      header: "حد الطلب الأدنى",
      getValue: (p) => p.minLimit,
    },
    {
      columnId: "supplierName",
      header: "المستودع الموجه له الطلب",
      getValue: (p) => {
        const sid = assignedSupplierMap[p.id];
        return sid ? (suppliersById.get(sid)?.name ?? "غير محدد") : "غير محدد";
      },
    },
  ];

  if (canViewCost) {
    cols.push({
      columnId: "weightedCostPrice",
      header: "آخر تكلفة مرجحة",
      getValue: (p) => p.weightedCostPrice.toFixed(2),
    });
  }

  cols.push({
    columnId: "orderQty",
    header: "الكمية المطلوبة (علبة)",
    getValue: (p) =>
      orderQtyMap[p.id] !== undefined ? orderQtyMap[p.id] : getSuggestedQty(p),
  });

  if (canViewCost) {
    cols.push({
      columnId: "estimatedTotal",
      header: "الإجمالي التقديري",
      getValue: (p) => {
        const qty =
          orderQtyMap[p.id] !== undefined
            ? orderQtyMap[p.id]
            : getSuggestedQty(p);
        return (qty * p.weightedCostPrice).toFixed(2);
      },
    });
  }

  return cols;
};

// بناء بطاقات ملخّص حيّة لسلّات المستودعات الموزّعة حالياً عبر كامل الدفتر
export const buildLiveSupplierBaskets = (params: {
  shortageProducts: ProductEntity[];
  assignedSupplierMap: Record<string, string>;
  suppliersById: Map<string, SupplierEntity>;
  orderQtyMap: Record<string, number>;
  openOrdersByProduct: Map<string, ProductOpenOrderEntry[]>;
}): LiveSupplierBasket[] => {
  const {
    shortageProducts,
    assignedSupplierMap,
    suppliersById,
    orderQtyMap,
    openOrdersByProduct,
  } = params;

  const basketsMap = new Map<string, LiveSupplierBasket>();

  shortageProducts.forEach((product) => {
    const sid = assignedSupplierMap[product.id];
    if (!sid) return;
    const supplier = suppliersById.get(sid);
    if (!supplier) return;

    const qty =
      orderQtyMap[product.id] !== undefined
        ? orderQtyMap[product.id]
        : getSuggestedQty(product);
    if (qty <= 0) return;

    // استبعاد التكرار فقط إذا كان للصنف أمر مفتوح مسبقاً لدى نفس المستودع
    if (
      hasOpenOrderForSupplier(openOrdersByProduct.get(product.id), supplier)
    ) {
      return;
    }

    const lineCost = qty * product.weightedCostPrice;
    const existing = basketsMap.get(supplier.id);
    if (existing) {
      existing.draft.items.push({ product, orderedPacks: qty });
      existing.itemsCount += 1;
      existing.totalPacks += qty;
      existing.estimatedTotal = Number(
        (existing.estimatedTotal + lineCost).toFixed(2),
      );
    } else {
      basketsMap.set(supplier.id, {
        supplier,
        draft: {
          supplierId: supplier.id,
          supplierName: supplier.name,
          supplierPhone: supplier.phone,
          salesRepName: supplier.salesRepName,
          items: [{ product, orderedPacks: qty }],
        },
        itemsCount: 1,
        totalPacks: qty,
        estimatedTotal: Number(lineCost.toFixed(2)),
      });
    }
  });

  return Array.from(basketsMap.values()).sort(
    (a, b) => b.itemsCount - a.itemsCount,
  );
};

// تجميع الأصناف الموجّهة لمستودع ضمن النطاق الحالي مع منع التكرار لنفس المستودع
export const buildGroupedOrdersDraft = (
  activeOrderItems: ActiveShortageOrderItem[],
  openOrdersByProduct: Map<string, ProductOpenOrderEntry[]>,
): CreatePurchaseOrderInput[] => {
  const groups = new Map<string, CreatePurchaseOrderInput>();

  activeOrderItems.forEach(({ product, qty, supplier }) => {
    if (!supplier) return;
    if (
      hasOpenOrderForSupplier(openOrdersByProduct.get(product.id), supplier)
    ) {
      return;
    }

    const existing = groups.get(supplier.id);
    if (existing) {
      existing.items.push({ product, orderedPacks: qty });
    } else {
      groups.set(supplier.id, {
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierPhone: supplier.phone,
        salesRepName: supplier.salesRepName,
        items: [{ product, orderedPacks: qty }],
      });
    }
  });

  return Array.from(groups.values());
};

// تصدير ملف CSV لطلبية النواقص بترميز عربي UTF-8 BOM مع احترام الأعمدة الظاهرة وصلاحية التكلفة
export const exportShortagesOrderToCsv = (params: {
  activeOrderItems: ActiveShortageOrderItem[];
  selectedSupplier: SupplierEntity | null;
  canViewCost: boolean;
  isColumnVisible: (id: ShortageSortKey) => boolean;
}): string => {
  const { activeOrderItems, selectedSupplier, canViewCost, isColumnVisible } =
    params;

  const showSupplier = isColumnVisible("supplierName");
  const showStock = isColumnVisible("stockPacks");
  const showCost = canViewCost && isColumnVisible("weightedCostPrice");
  const showEstimated = canViewCost && isColumnVisible("estimatedTotal");

  const headers: string[] = [];
  if (showSupplier) headers.push("المستودع المحدد");
  headers.push("الباركود", "الاسم التجاري للدواء", "المادة الفعالة");
  if (showStock) headers.push("الرصيد الحالي (علبة)", "حد الطلب الأدنى");
  headers.push("الكمية المطلوبة (علبة)");
  if (showCost) headers.push("آخر تكلفة مرجحة للعلبة");
  if (showEstimated) headers.push("التكلفة التقديرية للسطر");

  const rows: CsvCellValue[][] = activeOrderItems.map(
    ({ product, qty, supplier }) => {
      const row: CsvCellValue[] = [];
      if (showSupplier) row.push(supplier?.name || "غير محدد");
      row.push(product.barcode, product.name, product.scientificName);
      if (showStock) row.push(product.stockPacks, product.minLimit);
      row.push(qty);
      if (showCost) row.push(product.weightedCostPrice.toFixed(2));
      if (showEstimated) row.push((qty * product.weightedCostPrice).toFixed(2));
      return row;
    },
  );

  const datePart = new Date().toISOString().slice(0, 10);
  const safeSupplierSlug = selectedSupplier
    ? `_${selectedSupplier.name.replace(/[^\p{L}\p{N}_-]+/gu, "_")}`
    : "";

  return exportRowsToCsv({
    fileName: `Purchase_Order${safeSupplierSlug}_${datePart}.csv`,
    headers,
    rows,
  });
};
