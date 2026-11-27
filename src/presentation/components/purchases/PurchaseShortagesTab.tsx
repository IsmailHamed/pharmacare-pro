import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ProductEntity,
  PurchaseOrderDispatchChannel,
  SupplierEntity,
} from "../../../domain/entities";
import {
  buildProductSearchIndex,
  searchProductsFuzzy,
} from "../../../domain/utils/fuzzySearch";
import { CsvCellValue, exportRowsToCsv } from "../../../domain/utils/csvExport";
import { buildWhatsAppOrderText } from "../../../domain/utils/whatsappHelper";
import { usePosStore } from "../../../application/store/usePosStore";
import { CreatePurchaseOrderInput } from "../../../application/store/storeTypes";
import { ProductSearchInput } from "../common/ProductSearchInput";
import { FilterPillOption, FilterPills } from "../common/table/FilterPills";
import {
  SortAccessors,
  SortDirection,
  useTableSort,
} from "../common/table/useTableSort";
import { useTablePagination } from "../common/table/useTablePagination";
import {
  TableColumnDef,
  useTableColumns,
} from "../common/table/useTableColumns";
import { ColumnVisibilityMenu } from "../common/table/ColumnVisibilityMenu";
import { SortableTh } from "../common/table/SortableTh";
import { DataTableToolbar } from "../common/table/DataTableToolbar";
import { DataTableShell } from "../common/table/DataTableShell";
import { TableLoadMoreFooter } from "../common/table/TableLoadMoreFooter";
import {
  TableExportButton,
  TableExportColumn,
} from "../common/table/TableExportButton";
import {
  ClipboardList,
  ClipboardCheck,
  FileSpreadsheet,
  Copy,
  Check,
  AlertTriangle,
  Building2,
  RotateCcw,
  Settings2,
  CheckSquare,
  CheckCircle2,
  Send,
  PackageCheck,
  EyeOff,
  Eye,
  ShoppingBasket,
  X,
} from "lucide-react";

interface Props {
  shortageProducts: ProductEntity[];
  canViewCost: boolean;
  onOpenSuppliersModal: () => void;
  onOrdersCreated?: () => void;
}

const PAGE_SIZE = 50;
const OUT_OF_STOCK_KEY = "__OUT_OF_STOCK__";
const ASSIGNED_KEY = "__ASSIGNED__";
const UNASSIGNED_KEY = "__UNASSIGNED__";

// مفاتيح الأعمدة القابلة للفرز والتحكم في الظهور في جدول دفتر النواقص
type ShortageSortKey =
  | "name"
  | "stockPacks"
  | "supplierName"
  | "weightedCostPrice"
  | "orderQty"
  | "estimatedTotal";

// تمثيل أمر شراء مفتوح مرتبط بصنف معيّن لعرض حالته الفعلية ومنع تكرار الطلب لنفس المستودع فقط
interface ProductOpenOrderEntry {
  orderId: string;
  supplierId?: string;
  supplierName: string;
  status: "DRAFT" | "SENT" | "PARTIAL";
  remainingPacks: number;
}

// بطاقة سلّة حيّة لمستودع محدد جاهزة للاعتماد المستقل أو النسخ السريع
interface LiveSupplierBasket {
  supplier: SupplierEntity;
  draft: CreatePurchaseOrderInput;
  itemsCount: number;
  totalPacks: number;
  estimatedTotal: number;
}

const OPEN_ORDER_STATUS_META: Record<
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
const SHORTAGE_DEFAULT_DIRECTIONS: Partial<
  Record<ShortageSortKey, SortDirection>
> = {
  name: "asc",
  stockPacks: "asc",
  supplierName: "asc",
  weightedCostPrice: "desc",
  orderQty: "desc",
  estimatedTotal: "desc",
};

const getSuggestedQty = (product: ProductEntity): number =>
  Math.max(5, product.minLimit * 2 - product.stockPacks);

// التحقق مما إذا كان الصنف مدرجاً بالفعل في أمر شراء مفتوح لنفس المستودع المحدد (مع السماح بطلبه من مستودعات أخرى)
const hasOpenOrderForSupplier = (
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

/**
 * تبويب دفتر النواقص وتوزيع الطلبيات على المستودعات (Purchase Orders)
 * يدعم فلتر "نفد بالكامل (0)"، إخفاء الأصناف قيد الطلب حالياً، وبطاقات السلّات الحيّة لكل مستودع
 */
export const PurchaseShortagesTab: React.FC<Props> = ({
  shortageProducts,
  canViewCost,
  onOpenSuppliersModal,
  onOrdersCreated,
}) => {
  const {
    settings,
    suppliers,
    purchaseOrders,
    setNotification,
    createPurchaseOrdersBatch,
    markPurchaseOrderSent,
  } = usePosStore();

  const [orderQtyMap, setOrderQtyMap] = useState<Record<string, number>>({});
  const [assignedSupplierMap, setAssignedSupplierMap] = useState<
    Record<string, string>
  >({});
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [bulkSupplierId, setBulkSupplierId] = useState<string>("");
  const [activeSupplierFilter, setActiveSupplierFilter] =
    useState<string>("ALL");
  const [hideOpenOrdered, setHideOpenOrdered] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedBasketId, setCopiedBasketId] = useState<string | null>(null);
  const [creatingOrders, setCreatingOrders] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  // قفل فوري متزامن لمنع تكرار إنشاء أوامر الشراء عند النقر السريع المزدوج
  const creatingOrdersRef = useRef(false);

  // تعريف أعمدة جدول النواقص للتحكم في الإظهار والإخفاء مع احترام صلاحية عرض التكلفة
  const shortageColumns = useMemo<TableColumnDef<ShortageSortKey>[]>(() => {
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
  }, [canViewCost]);

  // إدارة إظهار وإخفاء الأعمدة مع حفظ تفضيلات المستخدم في localStorage
  const columnsState = useTableColumns("purchase_shortages", shortageColumns);

  const shortageSearchIndex = useMemo(
    () => buildProductSearchIndex(shortageProducts),
    [shortageProducts],
  );

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.isActive),
    [suppliers],
  );

  const suppliersById = useMemo(() => {
    const map = new Map<string, SupplierEntity>();
    suppliers.forEach((s) => map.set(s.id, s));
    return map;
  }, [suppliers]);

  // تتبع كافة أوامر الشراء المفتوحة لكل صنف مع حالتها الفعلية واسم المستودع
  const openOrdersByProduct = useMemo(() => {
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
  }, [purchaseOrders]);

  // عدد أصناف النواقص التي لديها أمر شراء مفتوح حالياً (لمؤشر زر الإخفاء)
  const openOrderedShortageCount = useMemo(
    () => shortageProducts.filter((p) => openOrdersByProduct.has(p.id)).length,
    [shortageProducts, openOrdersByProduct],
  );

  // أعمدة تصدير جدول النواقص إلى Excel / CSV مرتبطة بمعرّفات الأعمدة لتصدير الحقول الظاهرة فقط واحترام صلاحية التكلفة
  const tableExportColumns = useMemo<
    TableExportColumn<ProductEntity, ShortageSortKey>[]
  >(() => {
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
          return sid
            ? (suppliersById.get(sid)?.name ?? "غير محدد")
            : "غير محدد";
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
        orderQtyMap[p.id] !== undefined
          ? orderQtyMap[p.id]
          : getSuggestedQty(p),
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
  }, [canViewCost, assignedSupplierMap, suppliersById, orderQtyMap]);

  // اختصار F2 أو / للتركيز السريع على شريط البحث داخل دفتر النواقص
  useEffect(() => {
    const handleFocusShortcut = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (e.key === "F2" || (e.key === "/" && !isEditable)) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleFocusShortcut);
    return () => window.removeEventListener("keydown", handleFocusShortcut);
  }, []);

  // مزامنة خرائط الكميات والتوجيه والتحديد عند تغيّر قائمة الأصناف الناقصة
  useEffect(() => {
    const shortageIdSet = new Set(shortageProducts.map((p) => p.id));

    setOrderQtyMap((prev) => {
      const next: Record<string, number> = {};
      shortageProducts.forEach((p) => {
        next[p.id] = prev[p.id] !== undefined ? prev[p.id] : getSuggestedQty(p);
      });
      return next;
    });

    setAssignedSupplierMap((prev) => {
      const next: Record<string, string> = {};
      Object.entries(prev).forEach(([pid, sid]) => {
        if (shortageIdSet.has(pid) && sid) {
          next[pid] = sid;
        }
      });
      return next;
    });

    setSelectedIds((prev) => {
      const next: Record<string, boolean> = {};
      Object.entries(prev).forEach(([pid, checked]) => {
        if (checked && shortageIdSet.has(pid)) {
          next[pid] = true;
        }
      });
      return next;
    });
  }, [shortageProducts]);

  // العودة تلقائياً لخيار "الكل" في حال تم حذف المستودع المحدّد حالياً من الدليل
  useEffect(() => {
    if (
      activeSupplierFilter !== "ALL" &&
      activeSupplierFilter !== OUT_OF_STOCK_KEY &&
      activeSupplierFilter !== ASSIGNED_KEY &&
      activeSupplierFilter !== UNASSIGNED_KEY &&
      !suppliersById.has(activeSupplierFilter)
    ) {
      setActiveSupplierFilter("ALL");
    }
  }, [activeSupplierFilter, suppliersById]);

  const getOrderQty = (product: ProductEntity): number =>
    orderQtyMap[product.id] !== undefined
      ? orderQtyMap[product.id]
      : getSuggestedQty(product);

  const getAssignedSupplierId = (productId: string): string => {
    const sid = assignedSupplierMap[productId];
    return sid && suppliersById.has(sid) ? sid : "";
  };

  // قاعدة الأصناف المرئية بعد تطبيق خيار "إخفاء قيد الطلب حالياً" لتحديث العدّادات بدقة
  const visibilityFilteredShortages = useMemo(
    () =>
      hideOpenOrdered
        ? shortageProducts.filter((p) => !openOrdersByProduct.has(p.id))
        : shortageProducts,
    [shortageProducts, hideOpenOrdered, openOrdersByProduct],
  );

  const outOfStockCount = useMemo(
    () => visibilityFilteredShortages.filter((p) => p.stockPacks === 0).length,
    [visibilityFilteredShortages],
  );

  const supplierCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let assigned = 0;
    let unassigned = 0;

    visibilityFilteredShortages.forEach((p) => {
      const sid = assignedSupplierMap[p.id];
      if (sid && suppliersById.has(sid)) {
        counts[sid] = (counts[sid] || 0) + 1;
        assigned++;
      } else {
        unassigned++;
      }
    });

    return { counts, assigned, unassigned };
  }, [visibilityFilteredShortages, assignedSupplierMap, suppliersById]);

  const filterSuppliers = useMemo(() => {
    return suppliers.filter(
      (s) => s.isActive || (supplierCounts.counts[s.id] || 0) > 0,
    );
  }, [suppliers, supplierCounts]);

  // بناء خيارات شريط حبوب الفلترة الموحّد (الكل / نفد بالكامل / الموزعة / غير موزعة / المستودعات)
  const supplierFilterOptions = useMemo<FilterPillOption<string>[]>(() => {
    const baseOptions: FilterPillOption<string>[] = [
      {
        id: "ALL",
        label: "الكل",
        count: visibilityFilteredShortages.length,
        tone: "slate",
      },
      {
        id: OUT_OF_STOCK_KEY,
        label: "نفد بالكامل (0)",
        count: outOfStockCount,
        icon: AlertTriangle,
        tone: "rose",
        highlightWhenInactive: outOfStockCount > 0,
      },
      {
        id: ASSIGNED_KEY,
        label: "الموزعة",
        count: supplierCounts.assigned,
        icon: CheckCircle2,
        tone: "emerald",
        highlightWhenInactive: true,
      },
      {
        id: UNASSIGNED_KEY,
        label: "غير موزعة",
        count: supplierCounts.unassigned,
        tone: "amber",
        highlightWhenInactive: true,
      },
    ];

    const supplierOptions: FilterPillOption<string>[] = filterSuppliers.map(
      (sup) => {
        const count = supplierCounts.counts[sup.id] || 0;
        return {
          id: sup.id,
          label: sup.name,
          count,
          icon: Building2,
          tone: "indigo",
          highlightWhenInactive: count > 0,
        };
      },
    );

    return [...baseOptions, ...supplierOptions];
  }, [
    visibilityFilteredShortages.length,
    outOfStockCount,
    supplierCounts,
    filterSuppliers,
  ]);

  const scopedShortages = useMemo(() => {
    return visibilityFilteredShortages.filter((p) => {
      const sid = getAssignedSupplierId(p.id);
      if (activeSupplierFilter === "ALL") return true;
      if (activeSupplierFilter === OUT_OF_STOCK_KEY) return p.stockPacks === 0;
      if (activeSupplierFilter === ASSIGNED_KEY) return Boolean(sid);
      if (activeSupplierFilter === UNASSIGNED_KEY) return !sid;
      return sid === activeSupplierFilter;
    });
  }, [
    visibilityFilteredShortages,
    activeSupplierFilter,
    assignedSupplierMap,
    suppliersById,
  ]);

  const filteredShortages = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return scopedShortages;

    const scopedIdSet = new Set(scopedShortages.map((p) => p.id));
    return searchProductsFuzzy(
      shortageSearchIndex,
      q,
      Math.max(shortageProducts.length, 60),
    ).filter((p) => scopedIdSet.has(p.id));
  }, [
    scopedShortages,
    shortageSearchIndex,
    shortageProducts.length,
    searchQuery,
  ]);

  // دوال استخراج قيم الأعمدة للفرز (تأخذ بالاعتبار المستودع المعيّن والكمية المطلوبة لحظياً)
  const sortAccessors = useMemo<SortAccessors<ProductEntity, ShortageSortKey>>(
    () => ({
      name: (p) => p.name,
      stockPacks: (p) => p.stockPacks,
      supplierName: (p) => {
        const sid = assignedSupplierMap[p.id];
        return sid ? (suppliersById.get(sid)?.name ?? null) : null;
      },
      weightedCostPrice: (p) => p.weightedCostPrice,
      orderQty: (p) =>
        orderQtyMap[p.id] !== undefined
          ? orderQtyMap[p.id]
          : getSuggestedQty(p),
      estimatedTotal: (p) => {
        const qty =
          orderQtyMap[p.id] !== undefined
            ? orderQtyMap[p.id]
            : getSuggestedQty(p);
        return qty * p.weightedCostPrice;
      },
    }),
    [assignedSupplierMap, suppliersById, orderQtyMap],
  );

  // فرز الأعمدة التفاعلي: defaultSort=null للحفاظ على دقة ترتيب البحث الضبابي وأولوية النقص، مع allowClear للعودة للترتيب الافتراضي
  const {
    sortedItems: sortedShortages,
    sortState,
    toggleSort,
    resetSort,
    getSortDirection,
  } = useTableSort(filteredShortages, {
    accessors: sortAccessors,
    defaultSort: null,
    defaultDirections: SHORTAGE_DEFAULT_DIRECTIONS,
    allowClear: true,
  });

  // التحميل التدريجي الموحّد (50 صنفاً في الدفعة) مع إعادة ضبط تلقائية عند تغيّر الفلتر أو البحث أو الفرز
  const pagination = useTablePagination(sortedShortages, {
    pageSize: PAGE_SIZE,
    resetDeps: [
      activeSupplierFilter,
      hideOpenOrdered,
      searchQuery,
      sortState?.key,
      sortState?.direction,
    ],
  });

  const activeOrderItems = useMemo(
    () =>
      scopedShortages
        .map((product) => ({
          product,
          qty:
            orderQtyMap[product.id] !== undefined
              ? orderQtyMap[product.id]
              : getSuggestedQty(product),
          supplier: getAssignedSupplierId(product.id)
            ? suppliersById.get(getAssignedSupplierId(product.id)) || null
            : null,
        }))
        .filter((entry) => entry.qty > 0),
    [scopedShortages, orderQtyMap, assignedSupplierMap, suppliersById],
  );

  // بطاقات ملخّص حيّة لسلّات المستودعات الموزّعة حالياً عبر كامل الدفتر (تتيح الاعتماد أو النسخ لكل مستودع مستقل)
  const liveSupplierBaskets = useMemo<LiveSupplierBasket[]>(() => {
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
  }, [
    shortageProducts,
    assignedSupplierMap,
    suppliersById,
    orderQtyMap,
    openOrdersByProduct,
  ]);

  // تجميع الأصناف الموجّهة لمستودع فقط ضمن النطاق الحالي مع منع التكرار لنفس المستودع والسماح بطلب نفس الدواء من مستودع آخر
  const groupedOrdersDraft = useMemo<CreatePurchaseOrderInput[]>(() => {
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
  }, [activeOrderItems, openOrdersByProduct]);

  // إجمالي عدد الأصناف الموزّعة على مستودعات والجاهزة للاعتماد دون تكرار على نفس المستودع
  const assignedOrderItemsCount = useMemo(
    () => groupedOrdersDraft.reduce((sum, g) => sum + g.items.length, 0),
    [groupedOrdersDraft],
  );

  const selectedSupplier = useMemo(
    () =>
      activeSupplierFilter !== "ALL" &&
      activeSupplierFilter !== OUT_OF_STOCK_KEY &&
      activeSupplierFilter !== ASSIGNED_KEY &&
      activeSupplierFilter !== UNASSIGNED_KEY
        ? suppliersById.get(activeSupplierFilter) || null
        : null,
    [activeSupplierFilter, suppliersById],
  );

  const totalEstimatedCost = useMemo(
    () =>
      activeOrderItems.reduce(
        (sum, { product, qty }) => sum + qty * product.weightedCostPrice,
        0,
      ),
    [activeOrderItems],
  );

  const selectedProductIdsList = useMemo(
    () => Object.keys(selectedIds).filter((id) => selectedIds[id]),
    [selectedIds],
  );

  const allVisibleSelected =
    pagination.visibleItems.length > 0 &&
    pagination.visibleItems.every((p) => Boolean(selectedIds[p.id]));

  const hasActiveFilters =
    activeSupplierFilter !== "ALL" ||
    hideOpenOrdered ||
    Boolean(searchQuery.trim());

  // إعادة ضبط فلتر المستودع وإخفاء قيد الطلب والبحث والفرز بضغطة واحدة
  const handleResetFilters = () => {
    setActiveSupplierFilter("ALL");
    setHideOpenOrdered(false);
    setSearchQuery("");
    resetSort();
  };

  const handleToggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = { ...prev };
        pagination.visibleItems.forEach((p) => {
          delete next[p.id];
        });
        return next;
      });
      return;
    }

    setSelectedIds((prev) => {
      const next = { ...prev };
      pagination.visibleItems.forEach((p) => {
        next[p.id] = true;
      });
      return next;
    });
  };

  const handleAssignSingle = (productId: string, supplierId: string) => {
    setAssignedSupplierMap((prev) => {
      const next = { ...prev };
      if (!supplierId) {
        delete next[productId];
      } else {
        next[productId] = supplierId;
      }
      return next;
    });
  };

  const handleApplyBulkAssign = () => {
    if (selectedProductIdsList.length === 0) return;

    setAssignedSupplierMap((prev) => {
      const next = { ...prev };
      selectedProductIdsList.forEach((pid) => {
        if (!bulkSupplierId || bulkSupplierId === UNASSIGNED_KEY) {
          delete next[pid];
        } else {
          next[pid] = bulkSupplierId;
        }
      });
      return next;
    });

    const targetLabel =
      !bulkSupplierId || bulkSupplierId === UNASSIGNED_KEY
        ? "إلغاء التعيين"
        : suppliersById.get(bulkSupplierId)?.name || "المستودع المحدد";

    setNotification({
      type: "success",
      message: `تم توجيه (${selectedProductIdsList.length}) صنف إلى: ${targetLabel}.`,
    });
    setSelectedIds({});
  };

  const handleResetSuggested = () => {
    const resetMap: Record<string, number> = {};
    shortageProducts.forEach((p) => {
      resetMap[p.id] = getSuggestedQty(p);
    });
    setOrderQtyMap(resetMap);
  };

  // توليد نص طلبية الواتساب عبر الأداة الموحّدة
  const getOrderMessageText = (): string =>
    buildWhatsAppOrderText({
      pharmacyName: settings.pharmacyName,
      pharmacyPhone: settings.phone,
      supplier: selectedSupplier
        ? {
            name: selectedSupplier.name,
            salesRepName: selectedSupplier.salesRepName,
          }
        : null,
      items: activeOrderItems.map(({ product, qty, supplier }) => ({
        name: product.name,
        scientificName: product.scientificName,
        qty,
        unitLabel: "علبة",
        supplierName: supplier?.name ?? null,
      })),
    });

  // تحديث المسودات (DRAFT) المطابقة للنطاق الحالي تلقائياً إلى حالة "مُرسل للمستودع" (SENT) عند نسخ أو تصدير الطلبية
  const markMatchingDraftOrdersSent = async (
    channel: PurchaseOrderDispatchChannel,
  ): Promise<number> => {
    const activeProductIds = new Set(
      activeOrderItems.map((entry) => entry.product.id),
    );
    const activeSupplierIds = new Set(
      activeOrderItems
        .map((entry) => entry.supplier?.id)
        .filter((id): id is string => Boolean(id)),
    );

    const matchingDrafts = purchaseOrders.filter((order) => {
      if (order.status !== "DRAFT") return false;

      if (selectedSupplier) {
        return (
          (order.supplierId && order.supplierId === selectedSupplier.id) ||
          order.supplierName.trim().toLowerCase() ===
            selectedSupplier.name.trim().toLowerCase()
        );
      }

      const matchesProduct = order.items.some((item) =>
        activeProductIds.has(item.productId),
      );
      if (!matchesProduct) return false;

      if (activeSupplierFilter === ASSIGNED_KEY && order.supplierId) {
        return activeSupplierIds.has(order.supplierId);
      }

      return true;
    });

    for (const draft of matchingDrafts) {
      await markPurchaseOrderSent(draft.id, channel);
    }

    return matchingDrafts.length;
  };

  // دالة موحّدة لاعتماد قائمة أوامر شراء (سواء لكل النطاق أو لسلّة مستودع منفردة) وتفريغ توزيعها فوراً
  const submitOrdersDrafts = async (
    drafts: CreatePurchaseOrderInput[],
    navigateAfterCreate: boolean,
  ) => {
    if (drafts.length === 0 || creatingOrdersRef.current) return;

    creatingOrdersRef.current = true;
    setCreatingOrders(true);
    try {
      const createdProductIds = new Set(
        drafts.flatMap((g) => g.items.map((it) => it.product.id)),
      );

      const created = await createPurchaseOrdersBatch(drafts);
      if (created.length > 0) {
        // تفريغ المستودع المعيّن والتحديد للأصناف المعتمدة فوراً لتعطيل الزر ومنع أي تكرار
        setAssignedSupplierMap((prev) => {
          const next = { ...prev };
          createdProductIds.forEach((pid) => {
            delete next[pid];
          });
          return next;
        });
        setSelectedIds((prev) => {
          const next = { ...prev };
          createdProductIds.forEach((pid) => {
            delete next[pid];
          });
          return next;
        });

        if (navigateAfterCreate) {
          onOrdersCreated?.();
        }
      }
    } finally {
      creatingOrdersRef.current = false;
      setCreatingOrders(false);
    }
  };

  const handleCreatePurchaseOrders = async () => {
    await submitOrdersDrafts(groupedOrdersDraft, true);
  };

  // اعتماد سلّة مستودع واحد فقط (مع البقاء في الدفتر إذا كانت هناك سلّات أخرى لم تُعتمد بعد)
  const handleCreateSingleBasket = async (basket: LiveSupplierBasket) => {
    const isLastBasket = liveSupplierBaskets.length <= 1;
    await submitOrdersDrafts([basket.draft], isLastBasket);
  };

  // نسخ نص طلبية سلّة مستودع واحد مباشرةً من بطاقته
  const handleCopySingleBasket = async (basket: LiveSupplierBasket) => {
    const text = buildWhatsAppOrderText({
      pharmacyName: settings.pharmacyName,
      pharmacyPhone: settings.phone,
      supplier: {
        name: basket.supplier.name,
        salesRepName: basket.supplier.salesRepName,
      },
      items: basket.draft.items.map(({ product, orderedPacks }) => ({
        name: product.name,
        scientificName: product.scientificName,
        qty: orderedPacks,
        unitLabel: "علبة",
        supplierName: basket.supplier.name,
      })),
    });

    await navigator.clipboard.writeText(text);
    setCopiedBasketId(basket.supplier.id);
    window.setTimeout(() => {
      setCopiedBasketId((prev) => (prev === basket.supplier.id ? null : prev));
    }, 2200);
    setNotification({
      type: "success",
      message: `تم نسخ طلبية (${basket.supplier.name}) بعدد (${basket.itemsCount}) صنف بنجاح!`,
    });
  };

  const handleCopyWhatsApp = async () => {
    if (activeOrderItems.length === 0) return;
    const text = getOrderMessageText();
    await navigator.clipboard.writeText(text);
    const updatedCount = await markMatchingDraftOrdersSent("MANUAL_WHATSAPP");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
    setNotification({
      type: "success",
      message: selectedSupplier
        ? `تم نسخ طلبية (${selectedSupplier.name}) بنجاح!${updatedCount > 0 ? " وتم تحديث حالة أمر الشراء إلى مُرسل." : ""}`
        : `تم نسخ نص طلبية النواقص بنجاح!${updatedCount > 0 ? ` وتم تحديث (${updatedCount}) أمر شراء إلى مُرسل.` : ""}`,
    });
  };

  // تصدير ملف CSV عبر الأداة الموحّدة بترميز عربي UTF-8 BOM مع احترام الأعمدة الظاهرة حالياً وصلاحية التكلفة
  const handleExportCsvOrder = async () => {
    if (activeOrderItems.length === 0) return;

    const showSupplier = columnsState.isVisible("supplierName");
    const showStock = columnsState.isVisible("stockPacks");
    const showCost = canViewCost && columnsState.isVisible("weightedCostPrice");
    const showEstimated =
      canViewCost && columnsState.isVisible("estimatedTotal");

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
        if (showEstimated)
          row.push((qty * product.weightedCostPrice).toFixed(2));
        return row;
      },
    );

    const datePart = new Date().toISOString().slice(0, 10);
    const safeSupplierSlug = selectedSupplier
      ? `_${selectedSupplier.name.replace(/[^\p{L}\p{N}_-]+/gu, "_")}`
      : "";

    const downloadedFileName = exportRowsToCsv({
      fileName: `Purchase_Order${safeSupplierSlug}_${datePart}.csv`,
      headers,
      rows,
    });

    const updatedCount = await markMatchingDraftOrdersSent("CSV_EXPORT");

    setNotification({
      type: "success",
      message: selectedSupplier
        ? `تم تصدير طلبية (${selectedSupplier.name}) بنجاح.${updatedCount > 0 ? " وتم تحديث حالة أمر الشراء إلى مُرسل." : ""}`
        : `تم تصدير ملف طلبية النواقص (${downloadedFileName}) بنجاح.${updatedCount > 0 ? ` وتم تحديث (${updatedCount}) أمر شراء إلى مُرسل.` : ""}`,
    });
  };

  const currentScopeLabel = selectedSupplier
    ? selectedSupplier.name
    : activeSupplierFilter === OUT_OF_STOCK_KEY
      ? "الأصناف التي نفدت بالكامل (0)"
      : activeSupplierFilter === ASSIGNED_KEY
        ? "الأصناف الموزعة على المستودعات"
        : activeSupplierFilter === UNASSIGNED_KEY
          ? "الأصناف غير الموزعة"
          : "كافة النواقص (مجمّعة حسب المستودع)";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* الترويسة ومؤشرات النواقص السريعة */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-sky-400" /> دفتر النواقص
            وتوزيع طلبيات المستودعات
          </h3>
          <p className="text-slate-400 text-[11px] mt-0.5">
            وزّع الأصناف الناقصة على المستودعات وقت الطلب، وتابع سلّات كل مستودع
            فوراً لاعتمادها كأوامر شراء رسمية أو نسخها وتصديرها.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-slate-400">أصناف تحت الحد</div>
            <div className="font-mono font-bold text-sky-300 text-sm">
              {shortageProducts.length}
            </div>
          </div>

          {outOfStockCount > 0 && (
            <div className="bg-rose-950/35 border border-rose-800/70 rounded-xl px-3.5 py-2 text-center">
              <div className="text-[10px] text-rose-300/80">
                نفد بالكامل (0)
              </div>
              <div className="font-mono font-extrabold text-rose-400 text-sm">
                {outOfStockCount}
              </div>
            </div>
          )}

          {canViewCost && (
            <div className="bg-amber-950/30 border border-amber-800/70 rounded-xl px-3.5 py-2 text-center">
              <div className="text-[10px] text-amber-300/80">
                {selectedSupplier
                  ? `تقديري (${selectedSupplier.name})`
                  : "التكلفة التقديرية للنطاق"}
              </div>
              <div className="font-mono font-extrabold text-amber-400 text-sm">
                {totalEstimatedCost.toFixed(2)} ر.س
              </div>
            </div>
          )}
        </div>
      </div>

      {/* تنبيه عند عدم وجود مستودعات نشطة في الدليل */}
      {activeSuppliers.length === 0 && (
        <div className="bg-amber-950/30 border border-amber-800/70 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-amber-200">
            <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              لم تضف أي مستودعات إلى الدليل بعد — أضف مستودعاتك لتتمكن من تقسيم
              الطلبيات وإرسالها لكل مستودع على حدة.
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenSuppliersModal}
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 shrink-0 transition"
          >
            <Settings2 className="w-3.5 h-3.5" /> إضافة المستودعات الآن
          </button>
        </div>
      )}

      {/* لوحة تصفية المستودعات الموحّدة (FilterPills) + خيار إخفاء قيد الطلب + إجراءات الاعتماد والنسخ */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <FilterPills
            variant="chips"
            options={supplierFilterOptions}
            value={activeSupplierFilter}
            onChange={setActiveSupplierFilter}
            ariaLabel="تصفية النواقص حسب المستودع أو حالة النفاد"
          />

          <button
            type="button"
            onClick={() => setHideOpenOrdered((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl border font-bold text-[11px] inline-flex items-center gap-1.5 transition shrink-0 ${
              hideOpenOrdered
                ? "bg-amber-600/25 border-amber-500/80 text-amber-200 shadow-sm"
                : "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
            }`}
            title="إخفاء الأصناف التي لديها أمر شراء مفتوح حالياً (مسودة / مرسل / جزئي)"
          >
            {hideOpenOrdered ? (
              <Eye className="w-3.5 h-3.5 text-amber-300" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>
              {hideOpenOrdered
                ? "إظهار الأصناف قيد الطلب"
                : "إخفاء الأصناف قيد الطلب حالياً"}
            </span>
            {openOrderedShortageCount > 0 && (
              <span
                className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                  hideOpenOrdered
                    ? "bg-amber-500/30 text-amber-100"
                    : "bg-slate-800 text-amber-300"
                }`}
              >
                {openOrderedShortageCount}
              </span>
            )}
          </button>
        </div>

        <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[11px] text-slate-400">
            نطاق الطلبية الحالي:{" "}
            <b className="text-white">{currentScopeLabel}</b> —{" "}
            <span className="font-mono text-sky-400">
              {activeOrderItems.length} صنف جاهز للطلب
            </span>
            {assignedOrderItemsCount !== activeOrderItems.length && (
              <span className="font-mono text-amber-400 mr-2">
                ({assignedOrderItemsCount} منها موزّع وجاهز لأمر شراء جديد)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={groupedOrdersDraft.length === 0 || creatingOrders}
              onClick={() => void handleCreatePurchaseOrders()}
              title={
                groupedOrdersDraft.length === 0
                  ? "اختر مستودعاً لصنف واحد على الأقل (ليس لديه أمر مفتوح لدى نفس المستودع) لاعتماد أمر شراء"
                  : `سيتم اعتماد (${assignedOrderItemsCount}) صنف موزّع فقط (ويمكن طلب نفس الدواء من مستودع آخر بحرية)`
              }
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold py-2 px-3.5 rounded-xl flex items-center gap-1.5 shadow transition"
            >
              <ClipboardCheck className="w-4 h-4" />
              {groupedOrdersDraft.length > 1
                ? `اعتماد (${groupedOrdersDraft.length}) أوامر شراء (${assignedOrderItemsCount} صنف)`
                : assignedOrderItemsCount > 0
                  ? `اعتماد كأمر شراء (${assignedOrderItemsCount} صنف)`
                  : "اعتماد كأمر شراء (PO)"}
            </button>

            <button
              type="button"
              disabled={activeOrderItems.length === 0}
              onClick={() => void handleCopyWhatsApp()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold py-2 px-3.5 rounded-xl flex items-center gap-1.5 shadow transition"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" /> تم النسخ للواتساب!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> نسخ للواتساب (
                  {activeOrderItems.length})
                </>
              )}
            </button>

            <button
              type="button"
              disabled={activeOrderItems.length === 0}
              onClick={() => void handleExportCsvOrder()}
              className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold py-2 px-3.5 rounded-xl flex items-center gap-1.5 shadow transition"
            >
              <FileSpreadsheet className="w-4 h-4" /> تصدير Excel / CSV
            </button>
          </div>
        </div>
      </div>

      {/* بطاقات ملخّص حيّة لسلّات المستودعات (Live Supplier Baskets) */}
      {liveSupplierBaskets.length > 0 && (
        <div className="bg-indigo-950/20 border border-indigo-800/60 rounded-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-indigo-200 font-bold text-xs">
              <ShoppingBasket className="w-4 h-4 text-indigo-400" />
              <span>
                سلّات المستودعات الجاهزة للاعتماد (
                <span className="font-mono text-white">
                  {liveSupplierBaskets.length}
                </span>
                )
              </span>
            </div>
            <span className="text-[10.5px] text-slate-400">
              اضغط على اسم المستودع لتصفية الجدول، أو اعتمد سلّة كل مستودع بشكل
              مستقل
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {liveSupplierBaskets.map((basket) => {
              const isFocused = activeSupplierFilter === basket.supplier.id;
              const isCopiedBasket = copiedBasketId === basket.supplier.id;

              return (
                <div
                  key={basket.supplier.id}
                  className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 transition ${
                    isFocused
                      ? "bg-indigo-950/60 border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.16)]"
                      : "bg-slate-950/85 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSupplierFilter(
                          isFocused ? "ALL" : basket.supplier.id,
                        )
                      }
                      className="text-right group min-w-0"
                      title={
                        isFocused
                          ? "إلغاء التصفية بهذا المستودع"
                          : "تصفية الجدول على أصناف هذا المستودع"
                      }
                    >
                      <div className="font-bold text-white group-hover:text-indigo-300 flex items-center gap-1.5 truncate transition">
                        <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">{basket.supplier.name}</span>
                      </div>
                      <div className="text-[10.5px] text-slate-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>{basket.itemsCount} صنف</span>
                        <span>•</span>
                        <span>{basket.totalPacks} علبة</span>
                        {canViewCost && (
                          <>
                            <span>•</span>
                            <b className="text-amber-300">
                              {basket.estimatedTotal.toFixed(2)} ر.س
                            </b>
                          </>
                        )}
                      </div>
                    </button>

                    {isFocused && (
                      <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-indigo-600/30 border border-indigo-500/60 text-indigo-200 shrink-0">
                        معروض
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      disabled={creatingOrders}
                      onClick={() => void handleCreateSingleBasket(basket)}
                      className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold py-1.5 px-2.5 rounded-lg text-[11px] inline-flex items-center justify-center gap-1 transition"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      اعتماد الأمر
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleCopySingleBasket(basket)}
                      className="bg-slate-800 hover:bg-emerald-700 border border-slate-700 hover:border-emerald-600 text-slate-200 hover:text-white font-bold py-1.5 px-2.5 rounded-lg text-[11px] inline-flex items-center gap-1 transition"
                    >
                      {isCopiedBasket ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          نُسخ
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          نسخ
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* الهيكل الموحّد للجدول (framed=false للحفاظ على البطاقة الخارجية الحالية) */}
      <DataTableShell
        framed={false}
        totalCount={shortageProducts.length}
        filteredCount={sortedShortages.length}
        searchQuery={searchQuery}
        onResetFilters={hasActiveFilters ? handleResetFilters : undefined}
        stickyHeader
        emptyState={{
          icon: ClipboardList,
          tone: "success",
          title: "ممتاز! لا توجد أي نواقص تحت حد الطلب في الصيدلية حالياً.",
        }}
        noResultsState={{
          description:
            "لا توجد أصناف ناقصة مطابقة لفلتر المستودع أو خيار الإخفاء أو عبارة البحث الحالية.",
        }}
        toolbar={
          shortageProducts.length > 0 ? (
            <DataTableToolbar
              accent="sky"
              searchSlot={
                <ProductSearchInput
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={setSearchQuery}
                  resultsCount={sortedShortages.length}
                  accent="sky"
                  inputBgClass="bg-slate-900"
                  shortcutHint="F2"
                  placeholder="ابحث في النواقص بالباركود أو الاسم والعيار معاً (مثلاً: pan 500 أو اموكس 1g) أو المادة الفعالة... (F2)"
                />
              }
              hasActiveFilters={hasActiveFilters}
              onResetFilters={handleResetFilters}
              actions={
                <>
                  <ColumnVisibilityMenu
                    columnsState={columnsState}
                    accent="sky"
                  />
                  <TableExportButton
                    items={sortedShortages}
                    columns={tableExportColumns}
                    isColumnVisible={columnsState.isVisible}
                    fileNamePrefix="Purchase_Shortages_Table"
                    itemLabel="صنف"
                  />
                  <button
                    type="button"
                    onClick={handleResetSuggested}
                    title="إعادة تعيين جميع الكميات للقيمة المقترحة تلقائياً"
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white px-2.5 py-2 rounded-xl font-bold flex items-center gap-1 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    الكميات المقترحة
                  </button>
                </>
              }
              visibleCount={pagination.visibleCount}
              filteredCount={sortedShortages.length}
              totalCount={shortageProducts.length}
              itemLabel="صنف"
              metaExtra={
                <span className="font-mono text-slate-400">
                  ضمن الطلبية:{" "}
                  <b className="text-sky-400">{activeOrderItems.length}</b>
                  <span className="text-slate-500 font-sans mr-2 hidden sm:inline">
                    • اضغط على رأس أي عمود للفرز
                  </span>
                </span>
              }
            />
          ) : undefined
        }
        aboveTable={
          /* شريط التوجيه الجماعي يظهر تلقائياً عند تحديد صنف واحد أو أكثر */
          selectedProductIdsList.length > 0 ? (
            <div className="bg-indigo-950/45 border border-indigo-700/80 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-indigo-200 font-bold">
                <CheckSquare className="w-4 h-4 text-indigo-400" />
                <span>
                  تم تحديد{" "}
                  <b className="font-mono text-white">
                    {selectedProductIdsList.length}
                  </b>{" "}
                  صنف — توجيهها دفعة واحدة إلى:
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={bulkSupplierId}
                  onChange={(e) => setBulkSupplierId(e.target.value)}
                  className="bg-slate-900 border border-indigo-700 rounded-lg px-3 py-1.5 text-white outline-none min-w-[200px]"
                >
                  <option value="">-- اختر المستودع --</option>
                  {activeSuppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                  <option value={UNASSIGNED_KEY}>
                    إلغاء التعيين (غير موزع)
                  </option>
                </select>

                <button
                  type="button"
                  disabled={!bulkSupplierId}
                  onClick={handleApplyBulkAssign}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold px-3.5 py-1.5 rounded-lg transition"
                >
                  تطبيق التوجيه
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedIds({})}
                  title="إلغاء التحديد"
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : undefined
        }
        header={
          <tr>
            <th className="py-2.5 px-3 w-9 text-center">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={handleToggleSelectAllVisible}
                title="تحديد كل الأصناف المعروضة حالياً"
                className="rounded accent-indigo-500 cursor-pointer"
              />
            </th>
            {columnsState.isVisible("name") && (
              <SortableTh
                direction={getSortDirection("name")}
                onSort={() => toggleSort("name")}
                accent="sky"
                className="px-2"
              >
                الدواء / المادة الفعالة
              </SortableTh>
            )}
            {columnsState.isVisible("stockPacks") && (
              <SortableTh
                direction={getSortDirection("stockPacks")}
                onSort={() => toggleSort("stockPacks")}
                align="center"
                accent="sky"
                className="px-2"
              >
                الرصيد / الحد
              </SortableTh>
            )}
            {columnsState.isVisible("supplierName") && (
              <SortableTh
                direction={getSortDirection("supplierName")}
                onSort={() => toggleSort("supplierName")}
                accent="sky"
                className="px-2 min-w-[190px]"
              >
                المستودع الموجه له الطلب
              </SortableTh>
            )}
            {canViewCost && columnsState.isVisible("weightedCostPrice") && (
              <SortableTh
                direction={getSortDirection("weightedCostPrice")}
                onSort={() => toggleSort("weightedCostPrice")}
                align="center"
                accent="sky"
                className="px-2"
              >
                آخر تكلفة
              </SortableTh>
            )}
            {columnsState.isVisible("orderQty") && (
              <SortableTh
                direction={getSortDirection("orderQty")}
                onSort={() => toggleSort("orderQty")}
                align="center"
                accent="sky"
                className="px-2"
              >
                الكمية المطلوبة (علبة)
              </SortableTh>
            )}
            {canViewCost && columnsState.isVisible("estimatedTotal") && (
              <SortableTh
                direction={getSortDirection("estimatedTotal")}
                onSort={() => toggleSort("estimatedTotal")}
                align="left"
                accent="sky"
              >
                الإجمالي التقديري
              </SortableTh>
            )}
          </tr>
        }
        footer={
          <TableLoadMoreFooter
            visibleCount={pagination.visibleCount}
            totalCount={pagination.totalCount}
            remainingCount={pagination.remainingCount}
            pageSize={pagination.pageSize}
            hasMore={pagination.hasMore}
            onLoadMore={pagination.loadMore}
            onShowAll={pagination.showAll}
            itemLabel="صنف"
            accent="sky"
            showSummaryWhenComplete
          />
        }
      >
        {pagination.visibleItems.map((p) => {
          const qty = getOrderQty(p);
          const assignedId = getAssignedSupplierId(p.id);
          const isChecked = Boolean(selectedIds[p.id]);
          const assignedSupplierObj = assignedId
            ? suppliersById.get(assignedId)
            : undefined;
          const productOpenOrders = openOrdersByProduct.get(p.id);

          return (
            <tr
              key={p.id}
              className={`transition ${
                isChecked ? "bg-indigo-950/30" : "hover:bg-slate-800/40"
              }`}
            >
              <td className="py-2.5 px-3 text-center">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) =>
                    setSelectedIds((prev) => ({
                      ...prev,
                      [p.id]: e.target.checked,
                    }))
                  }
                  className="rounded accent-indigo-500 cursor-pointer"
                />
              </td>

              {columnsState.isVisible("name") && (
                <td className="py-2.5 px-2">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    {p.stockPacks === 0 && (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    )}
                    {p.name}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {p.scientificName} |{" "}
                    <span className="font-mono">{p.barcode}</span>
                  </div>
                  {productOpenOrders && productOpenOrders.length > 0 && (
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      {productOpenOrders.map((entry) => {
                        const meta = OPEN_ORDER_STATUS_META[entry.status];
                        return (
                          <span
                            key={`${entry.orderId}-${entry.supplierName}`}
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${meta.cls}`}
                          >
                            {entry.status === "SENT" ? (
                              <Send className="w-3 h-3 shrink-0" />
                            ) : entry.status === "PARTIAL" ? (
                              <PackageCheck className="w-3 h-3 shrink-0" />
                            ) : (
                              <ClipboardCheck className="w-3 h-3 shrink-0" />
                            )}
                            <span>{meta.label}</span>
                            <span className="opacity-75">•</span>
                            <span>{entry.supplierName}</span>
                            <span className="font-mono opacity-80">
                              ({entry.orderId})
                            </span>
                            <span className="font-mono">
                              • متبقي {entry.remainingPacks} علبة
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </td>
              )}

              {columnsState.isVisible("stockPacks") && (
                <td className="py-2.5 px-2 text-center">
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                      p.stockPacks === 0
                        ? "bg-rose-950 text-rose-300 border border-rose-800"
                        : "bg-amber-950 text-amber-300 border border-amber-800"
                    }`}
                  >
                    {p.stockPacks} / {p.minLimit}
                  </span>
                </td>
              )}

              {columnsState.isVisible("supplierName") && (
                <td className="py-2.5 px-2">
                  <select
                    value={assignedId}
                    onChange={(e) => handleAssignSingle(p.id, e.target.value)}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs outline-none border transition ${
                      assignedId
                        ? "bg-indigo-950/40 border-indigo-700 text-indigo-100 font-bold"
                        : "bg-slate-900 border-slate-700 text-slate-300"
                    }`}
                  >
                    <option value="" className="bg-slate-900 text-slate-400">
                      — غير محدد —
                    </option>
                    {activeSuppliers.map((sup) => {
                      const alreadyOpenHere = hasOpenOrderForSupplier(
                        productOpenOrders,
                        sup,
                      );
                      return (
                        <option
                          key={sup.id}
                          value={sup.id}
                          className="bg-slate-900 text-white"
                        >
                          {sup.name}
                          {alreadyOpenHere ? " (أمر مفتوح)" : ""}
                        </option>
                      );
                    })}
                    {assignedSupplierObj && !assignedSupplierObj.isActive && (
                      <option
                        value={assignedSupplierObj.id}
                        className="bg-slate-900 text-slate-400"
                      >
                        {assignedSupplierObj.name} (مجمّد)
                      </option>
                    )}
                  </select>
                </td>
              )}

              {canViewCost && columnsState.isVisible("weightedCostPrice") && (
                <td className="py-2.5 px-2 text-center font-mono text-amber-400">
                  {p.weightedCostPrice.toFixed(2)}
                </td>
              )}

              {columnsState.isVisible("orderQty") && (
                <td className="py-2.5 px-2 text-center">
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={qty}
                    onChange={(e) =>
                      setOrderQtyMap((prev) => ({
                        ...prev,
                        [p.id]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-20 bg-slate-800 border border-sky-700 rounded-lg p-1.5 text-center font-mono font-bold text-white outline-none focus:border-sky-400"
                  />
                </td>
              )}

              {canViewCost && columnsState.isVisible("estimatedTotal") && (
                <td className="py-2.5 px-3 text-left font-mono font-bold text-emerald-400">
                  {(qty * p.weightedCostPrice).toFixed(2)}
                </td>
              )}
            </tr>
          );
        })}
      </DataTableShell>
    </div>
  );
};
