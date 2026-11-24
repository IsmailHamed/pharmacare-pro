import React, { useEffect, useMemo, useRef, useState } from "react";
import { InvoiceEntity, ProductEntity } from "../../../domain/entities";
import {
  buildProductSearchIndex,
  searchProductsFuzzy,
} from "../../../domain/utils/fuzzySearch";
import { usePosStore } from "../../../application/store/usePosStore";
import { ProductSearchInput } from "../common/ProductSearchInput";
import { ProductDetailsModal } from "./ProductDetailsModal";
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
import {
  TableExportButton,
  TableExportColumn,
} from "../common/table/TableExportButton";
import { SortableTh } from "../common/table/SortableTh";
import { DataTableToolbar } from "../common/table/DataTableToolbar";
import { DataTableShell } from "../common/table/DataTableShell";
import { TableLoadMoreFooter } from "../common/table/TableLoadMoreFooter";
import {
  Flame,
  Clock,
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  Keyboard,
  Eye,
  ClipboardCheck,
  ShieldAlert,
  Package,
} from "lucide-react";

const PAGE_SIZE = 50;

type InventoryFilterMode =
  | "ALL"
  | "EXP_30"
  | "EXP_90"
  | "EXP_180"
  | "LOW_STOCK"
  | "DEAD_STOCK";

// مفاتيح الأعمدة القابلة للفرز والتحكم في الظهور في جدول المخزون ورادار الصلاحيات
type InventorySortKey =
  | "name"
  | "category"
  | "stockPacks"
  | "nearestExpiry"
  | "packPrice"
  | "weightedCostPrice";

// الاتجاه الابتدائي المفضّل لكل عمود عند النقر الأول (الأقل رصيداً والأقرب صلاحية أولاً)
const INVENTORY_DEFAULT_DIRECTIONS: Partial<
  Record<InventorySortKey, SortDirection>
> = {
  name: "asc",
  category: "asc",
  stockPacks: "asc",
  nearestExpiry: "asc",
  packPrice: "desc",
  weightedCostPrice: "desc",
};

interface NearestExpiryInfo {
  days: number;
  expiryDate: string | null;
  activeBatchesCount: number;
}

const getNearestExpiryInfo = (product: ProductEntity): NearestExpiryInfo => {
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

interface Props {
  products: ProductEntity[];
  invoices: InvoiceEntity[];
  isExternalModalOpen?: boolean;
  onPrintBarcode: (product: ProductEntity) => void;
  onAdjustStock: (product: ProductEntity, batchId?: string) => void;
}

/**
 * تبويب المخزون ورادار الصلاحيات بتصميم الجدول الكامل الموحّد (Full-Width Table)
 * يستخدم نفس محرك البحث الضبابي والصوتي (fuzzySearch) وشريط البحث الموحّد في نقطة البيع،
 * ومبني على نواة الجداول الموحّدة (حبوب الفلترة، فرز الأعمدة، إظهار/إخفاء الأعمدة، والتصدير)
 */
export const InventoryStockTab: React.FC<Props> = ({
  products,
  invoices,
  isExternalModalOpen = false,
  onPrintBarcode,
  onAdjustStock,
}) => {
  const canViewCost = usePosStore(
    (s) => s.currentUser?.permissions.canViewCostAndProfit ?? false,
  );
  const canAdjustStock = usePosStore(
    (s) => s.currentUser?.permissions.canAdjustStock ?? false,
  );

  const [filterMode, setFilterMode] = useState<InventoryFilterMode>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedProductId, setHighlightedProductId] = useState<
    string | null
  >(null);
  const [detailsProductId, setDetailsProductId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  // تعريف أعمدة الجدول القابلة للإظهار/الإخفاء مع احترام صلاحية عرض التكلفة
  const inventoryColumns = useMemo<TableColumnDef<InventorySortKey>[]>(() => {
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
  }, [canViewCost]);

  // إدارة إظهار وإخفاء الأعمدة مع حفظ تفضيلات المستخدم في localStorage
  const columnsState = useTableColumns("inventory_stock", inventoryColumns);

  // بناء فهرس البحث الضبابي والصوتي مرة واحدة عند تغيّر قائمة الأدوية
  const productSearchIndex = useMemo(
    () => buildProductSearchIndex(products),
    [products],
  );

  const categories = useMemo(
    () => [
      "ALL",
      ...Array.from(new Set(products.map((p) => p.category || "عام"))).sort(),
    ],
    [products],
  );

  const soldProductIdsLast60Days = useMemo(() => {
    const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const set = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.type === "SALE" && new Date(inv.createdAt).getTime() >= cutoff) {
        inv.items.forEach((item) => set.add(item.product.id));
      }
    });
    return set;
  }, [invoices]);

  // حساب أقرب صلاحية مرة واحدة لكل دواء لتسريع الفلترة والفرز وعرض الجدول
  const expiryInfoMap = useMemo(() => {
    const map = new Map<string, NearestExpiryInfo>();
    products.forEach((p) => {
      map.set(p.id, getNearestExpiryInfo(p));
    });
    return map;
  }, [products]);

  // أعمدة التصدير إلى Excel / CSV مرتبطة بمعرّفات الأعمدة لتصدير الحقول الظاهرة فقط واحترام صلاحية التكلفة
  const exportColumns = useMemo<
    TableExportColumn<ProductEntity, InventorySortKey>[]
  >(() => {
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
  }, [canViewCost, expiryInfoMap]);

  const radarStats = useMemo(() => {
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
  }, [products, expiryInfoMap, soldProductIdsLast60Days]);

  // دمج البحث الضبابي والصوتي (مع الحفاظ على ترتيب الدقة) مع فلاتر التصنيف والرادار
  const filteredProducts = useMemo(() => {
    const baseList = searchQuery.trim()
      ? searchProductsFuzzy(
          productSearchIndex,
          searchQuery,
          Math.max(products.length, 60),
        )
      : products;

    return baseList.filter((p) => {
      if (
        selectedCategory !== "ALL" &&
        (p.category || "عام") !== selectedCategory
      ) {
        return false;
      }

      const days = expiryInfoMap.get(p.id)?.days ?? 9999;
      if (filterMode === "LOW_STOCK") return p.stockPacks <= p.minLimit;
      if (filterMode === "EXP_30") return days <= 30;
      if (filterMode === "EXP_90") return days > 30 && days <= 90;
      if (filterMode === "EXP_180") return days > 90 && days <= 180;
      if (filterMode === "DEAD_STOCK") {
        return p.stockPacks > p.minLimit && !soldProductIdsLast60Days.has(p.id);
      }
      return true;
    });
  }, [
    products,
    productSearchIndex,
    selectedCategory,
    searchQuery,
    filterMode,
    expiryInfoMap,
    soldProductIdsLast60Days,
  ]);

  // دوال استخراج قيم الأعمدة للفرز (مع إبقاء الأصناف بدون صلاحية مسجلة في الأسفل تلقائياً)
  const sortAccessors = useMemo<SortAccessors<ProductEntity, InventorySortKey>>(
    () => ({
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
    }),
    [expiryInfoMap],
  );

  // فرز الأعمدة التفاعلي: defaultSort=null للحفاظ على ترتيب دقة البحث الضبابي ما لم يُختَر عمود للفرز
  const {
    sortedItems: sortedProducts,
    sortState,
    toggleSort,
    resetSort,
    getSortDirection,
  } = useTableSort(filteredProducts, {
    accessors: sortAccessors,
    defaultSort: null,
    defaultDirections: INVENTORY_DEFAULT_DIRECTIONS,
    allowClear: true,
  });

  // اقتصاص العناصر المرئية عبر التحميل التدريجي الموحّد (50 صفاً) لمنع تجمّد الـ DOM عند وجود 10,000+ دواء
  const pagination = useTablePagination(sortedProducts, {
    pageSize: PAGE_SIZE,
    resetDeps: [
      filterMode,
      selectedCategory,
      searchQuery,
      sortState?.key,
      sortState?.direction,
    ],
  });

  const visibleProducts = pagination.visibleItems;

  // ربط نافذة التفاصيل بـ id الصنف لضمان تحديث الرصيد والتشغيلات لحظياً بعد أي تسوية
  const detailsProduct = useMemo(() => {
    if (!detailsProductId) return null;
    return products.find((p) => p.id === detailsProductId) || null;
  }, [products, detailsProductId]);

  const highlightedProduct = useMemo(() => {
    if (visibleProducts.length === 0) return null;
    if (highlightedProductId) {
      const match = visibleProducts.find((p) => p.id === highlightedProductId);
      if (match) return match;
    }
    return visibleProducts[0];
  }, [visibleProducts, highlightedProductId]);

  // تمرير الصف المظلل تلقائياً أثناء التنقل بالأسهم
  useEffect(() => {
    if (!highlightedProduct) return;
    rowRefs.current[highlightedProduct.id]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [highlightedProduct]);

  // اختصارات «صفر ماوس»: F2 أو / للبحث، ↑ و ↓ للتنقل، Enter لفتح بطاقة تفاصيل الدواء
  useEffect(() => {
    if (Boolean(detailsProduct) || isExternalModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const target = e.target as HTMLElement | null;
      const isSearchInput = target === searchInputRef.current;
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
        return;
      }

      if (visibleProducts.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (isEditable && !isSearchInput) return;
        e.preventDefault();

        const currentIndex = highlightedProduct
          ? visibleProducts.findIndex((p) => p.id === highlightedProduct.id)
          : -1;
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const nextIndex =
          currentIndex === -1
            ? 0
            : (currentIndex + delta + visibleProducts.length) %
              visibleProducts.length;

        setHighlightedProductId(visibleProducts[nextIndex].id);
        return;
      }

      if (e.key === "Enter") {
        if (
          target &&
          (target.tagName === "BUTTON" ||
            target.tagName === "A" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT")
        ) {
          return;
        }
        if (isEditable && !isSearchInput) return;
        if (highlightedProduct) {
          e.preventDefault();
          setDetailsProductId(highlightedProduct.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    detailsProduct,
    isExternalModalOpen,
    visibleProducts,
    highlightedProduct,
  ]);

  const hasActiveFilters =
    filterMode !== "ALL" ||
    selectedCategory !== "ALL" ||
    Boolean(searchQuery.trim());

  // إعادة ضبط فلاتر الرادار والتصنيف والبحث والفرز بضغطة واحدة
  const handleResetFilters = () => {
    setFilterMode("ALL");
    setSelectedCategory("ALL");
    setSearchQuery("");
    resetSort();
  };

  // بناء خيارات حبوب رادار الصلاحيات والمخزون الممرّرة إلى المكوّن الموحّد FilterPills
  const filterPillOptions = useMemo<FilterPillOption<InventoryFilterMode>[]>(
    () => [
      {
        id: "ALL",
        label: "الكل",
        count: products.length,
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
    ],
    [products.length, radarStats],
  );

  return (
    <>
      {/* الهيكل الموحّد لجدول المخزون ورادار الصلاحيات مع شريط الفلاتر والتصفح التدريجي */}
      <DataTableShell
        totalCount={products.length}
        filteredCount={sortedProducts.length}
        searchQuery={searchQuery}
        onResetFilters={hasActiveFilters ? handleResetFilters : undefined}
        stickyHeader
        emptyState={{
          icon: Package,
          title: "لا توجد أصناف مسجلة في المخزون حالياً",
          description:
            "عند إضافة أصناف جديدة أو اعتماد فواتير شراء ستظهر هنا مع متابعة الصلاحيات والتشغيلات.",
        }}
        noResultsState={{
          icon: Package,
          description: "لا توجد أصناف مطابقة لخيارات البحث أو الفلترة الحالية.",
        }}
        toolbar={
          <DataTableToolbar
            accent="amber"
            searchSlot={
              /* شريط البحث الضبابي والصوتي الموحّد */
              <ProductSearchInput
                ref={searchInputRef}
                value={searchQuery}
                onChange={setSearchQuery}
                resultsCount={sortedProducts.length}
                accent="amber"
                inputBgClass="bg-slate-950"
                shortcutHint="F2"
                placeholder="ابحث في المخزون بالباركود أو الاسم والعيار معاً (مثلاً: pan 500 أو اموكس 1g) أو المادة الفعالة... (F2)"
              />
            }
            filters={
              /* فلتر التصنيف الصيدلاني */
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2.5 text-slate-200 outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === "ALL" ? "كل التصنيفات" : cat}
                  </option>
                ))}
              </select>
            }
            actions={
              /* تلميح اختصارات لوحة المفاتيح السريعة داخل المخزون */
              <div className="hidden xl:flex items-center gap-2 text-[10px] text-slate-400 font-mono bg-slate-950/70 border border-slate-800 px-2.5 py-2.5 rounded-xl">
                <Keyboard className="w-3.5 h-3.5 text-amber-400" />
                <span>↑/↓ تنقل</span>
                <span>•</span>
                <span>Enter تفاصيل</span>
                <span>•</span>
                <span>F2 بحث</span>
              </div>
            }
            secondaryFilters={
              /* شريط حبوب فلاتر الرادار الموحّد */
              <FilterPills
                variant="chips"
                options={filterPillOptions}
                value={filterMode}
                onChange={setFilterMode}
                ariaLabel="تصفية المخزون ورادار الصلاحيات"
              />
            }
            secondaryActions={
              <>
                <ColumnVisibilityMenu
                  columnsState={columnsState}
                  accent="amber"
                />
                <TableExportButton
                  items={sortedProducts}
                  columns={exportColumns}
                  isColumnVisible={columnsState.isVisible}
                  fileNamePrefix="Inventory_Stock"
                  itemLabel="صنف"
                />
              </>
            }
            hasActiveFilters={hasActiveFilters}
            onResetFilters={handleResetFilters}
            visibleCount={pagination.visibleCount}
            filteredCount={sortedProducts.length}
            totalCount={products.length}
            itemLabel="صنف"
            metaExtra={
              <span className="text-[10.5px] text-slate-500 hidden sm:inline">
                اضغط على رأس أي عمود للفرز، أو على الصف لفتح بطاقة الدواء
              </span>
            }
          />
        }
        header={
          <tr>
            {columnsState.isVisible("name") && (
              <SortableTh
                direction={getSortDirection("name")}
                onSort={() => toggleSort("name")}
                accent="amber"
              >
                الدواء / المادة الفعالة
              </SortableTh>
            )}
            {columnsState.isVisible("category") && (
              <SortableTh
                direction={getSortDirection("category")}
                onSort={() => toggleSort("category")}
                accent="amber"
              >
                التصنيف
              </SortableTh>
            )}
            {columnsState.isVisible("stockPacks") && (
              <SortableTh
                direction={getSortDirection("stockPacks")}
                onSort={() => toggleSort("stockPacks")}
                align="center"
                accent="amber"
              >
                الرصيد المتاح
              </SortableTh>
            )}
            {columnsState.isVisible("nearestExpiry") && (
              <SortableTh
                direction={getSortDirection("nearestExpiry")}
                onSort={() => toggleSort("nearestExpiry")}
                accent="amber"
              >
                أقرب صلاحية (FEFO)
              </SortableTh>
            )}
            {columnsState.isVisible("packPrice") && (
              <SortableTh
                direction={getSortDirection("packPrice")}
                onSort={() => toggleSort("packPrice")}
                align="center"
                accent="amber"
              >
                سعر البيع
              </SortableTh>
            )}
            {canViewCost && columnsState.isVisible("weightedCostPrice") && (
              <SortableTh
                direction={getSortDirection("weightedCostPrice")}
                onSort={() => toggleSort("weightedCostPrice")}
                align="center"
                accent="amber"
              >
                التكلفة / الهامش
              </SortableTh>
            )}
            <th className="py-2.5 px-3 text-left">إجراءات</th>
          </tr>
        }
        footer={
          /* تذييل التحميل التدريجي الموحّد (50 صفاً في الدفعة) */
          <TableLoadMoreFooter
            visibleCount={pagination.visibleCount}
            totalCount={pagination.totalCount}
            remainingCount={pagination.remainingCount}
            pageSize={pagination.pageSize}
            hasMore={pagination.hasMore}
            onLoadMore={pagination.loadMore}
            onShowAll={pagination.showAll}
            itemLabel="صنف"
            accent="amber"
            showSummaryWhenComplete
          />
        }
      >
        {visibleProducts.map((p) => {
          const isHighlighted = highlightedProduct?.id === p.id;
          const expiryInfo = expiryInfoMap.get(p.id) || {
            days: 9999,
            expiryDate: null,
            activeBatchesCount: 0,
          };
          const isLowStock = p.stockPacks <= p.minLimit;
          const isDeadStock =
            p.stockPacks > p.minLimit && !soldProductIdsLast60Days.has(p.id);
          const profitMarginPercent = (
            ((p.packPrice - p.weightedCostPrice) /
              Math.max(0.01, p.weightedCostPrice)) *
            100
          ).toFixed(0);
          const stripsPerPack = Math.max(1, p.stripsPerPack);

          return (
            <tr
              key={p.id}
              ref={(el) => {
                rowRefs.current[p.id] = el;
              }}
              onClick={() => {
                setHighlightedProductId(p.id);
                setDetailsProductId(p.id);
              }}
              className={`cursor-pointer transition ${
                isHighlighted
                  ? "bg-amber-950/25"
                  : "bg-slate-950/40 hover:bg-slate-800/60"
              }`}
            >
              {/* الاسم والمادة الفعالة والباركود */}
              {columnsState.isVisible("name") && (
                <td className="py-3 px-3">
                  <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                    <span>{p.name}</span>
                    {p.isControlled && (
                      <span
                        title="دواء مراقب / نفسي"
                        className="inline-flex items-center gap-0.5 text-[9.5px] bg-rose-950 border border-rose-800 text-rose-300 px-1.5 py-0.2 rounded-full"
                      >
                        <ShieldAlert className="w-2.5 h-2.5" /> مراقب
                      </span>
                    )}
                    {isDeadStock && (
                      <span className="text-[9.5px] bg-purple-950 border border-purple-800 text-purple-300 px-1.5 py-0.2 rounded-full">
                        راكد
                      </span>
                    )}
                  </div>
                  <div className="text-[10.5px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{p.scientificName}</span>
                    <span className="font-mono text-slate-500">
                      • {p.barcode}
                    </span>
                  </div>
                </td>
              )}

              {/* التصنيف */}
              {columnsState.isVisible("category") && (
                <td className="py-3 px-3">
                  <span className="text-[10.5px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded-md">
                    {p.category || "عام"}
                  </span>
                </td>
              )}

              {/* الرصيد المتاح */}
              {columnsState.isVisible("stockPacks") && (
                <td className="py-3 px-3 text-center">
                  <div
                    className={`font-mono font-extrabold ${
                      p.stockPacks === 0
                        ? "text-rose-400"
                        : isLowStock
                          ? "text-amber-400"
                          : "text-white"
                    }`}
                  >
                    {p.stockPacks} علبة
                    {p.stockLooseStrips > 0 && (
                      <span className="text-[10.5px] text-sky-400 mr-1">
                        +{p.stockLooseStrips} ش
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {isLowStock ? (
                      <span className="text-sky-400 font-sans font-bold">
                        تحت الحد ({p.minLimit})
                      </span>
                    ) : (
                      `الحد: ${p.minLimit}`
                    )}
                  </div>
                </td>
              )}

              {/* أقرب صلاحية (FEFO) */}
              {columnsState.isVisible("nearestExpiry") && (
                <td className="py-3 px-3">
                  {!expiryInfo.expiryDate ? (
                    <span className="text-[11px] text-slate-500">—</span>
                  ) : (
                    <div className="space-y-0.5">
                      <div>
                        {expiryInfo.days <= 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-950 border border-rose-700 text-rose-300 px-2 py-0.5 rounded-full">
                            <Flame className="w-3 h-3" /> منتهية الصلاحية
                          </span>
                        ) : expiryInfo.days <= 30 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-rose-950/80 border border-rose-800 text-rose-300 px-2 py-0.5 rounded-full">
                            <Flame className="w-3 h-3" /> {expiryInfo.days} يوم
                          </span>
                        ) : expiryInfo.days <= 90 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-orange-950/80 border border-orange-800 text-orange-300 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" /> {expiryInfo.days} يوم
                          </span>
                        ) : expiryInfo.days <= 180 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-amber-950/70 border border-amber-800 text-amber-300 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" /> {expiryInfo.days} يوم
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-emerald-950/50 border border-emerald-800 text-emerald-300 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />{" "}
                            {expiryInfo.expiryDate}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {expiryInfo.days <= 180
                          ? `${expiryInfo.expiryDate} • `
                          : ""}
                        {expiryInfo.activeBatchesCount} تشغيلة
                      </div>
                    </div>
                  )}
                </td>
              )}

              {/* سعر البيع */}
              {columnsState.isVisible("packPrice") && (
                <td className="py-3 px-3 text-center">
                  <div className="font-mono font-extrabold text-emerald-400">
                    {p.packPrice.toFixed(2)}
                  </div>
                  {stripsPerPack > 1 && (
                    <div className="text-[10px] font-mono text-slate-500">
                      الشريط: {(p.packPrice / stripsPerPack).toFixed(2)}
                    </div>
                  )}
                </td>
              )}

              {/* التكلفة والهامش (محمي بصلاحية canViewCostAndProfit) */}
              {canViewCost && columnsState.isVisible("weightedCostPrice") && (
                <td className="py-3 px-3 text-center">
                  <div className="font-mono font-bold text-amber-400">
                    {p.weightedCostPrice.toFixed(2)}
                  </div>
                  <div className="text-[10px] font-mono text-sky-400">
                    +{profitMarginPercent}%
                  </div>
                </td>
              )}

              {/* إجراءات مدمجة غير مزدحمة */}
              <td className="py-3 px-3">
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHighlightedProductId(p.id);
                      setDetailsProductId(p.id);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-[11px] inline-flex items-center gap-1 transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    التفاصيل
                  </button>

                  {canAdjustStock && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHighlightedProductId(p.id);
                        onAdjustStock(p);
                      }}
                      title="تسوية جرد / تالف سريعة"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-600 border border-slate-700 text-amber-400 hover:text-white transition"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </DataTableShell>

      {/* نافذة بطاقة تفاصيل الدواء والتشغيلات */}
      <ProductDetailsModal
        product={detailsProduct}
        isDeadStock={
          detailsProduct
            ? detailsProduct.stockPacks > detailsProduct.minLimit &&
              !soldProductIdsLast60Days.has(detailsProduct.id)
            : false
        }
        isChildModalOpen={isExternalModalOpen}
        onClose={() => setDetailsProductId(null)}
        onPrintBarcode={onPrintBarcode}
        onAdjustStock={onAdjustStock}
      />
    </>
  );
};
