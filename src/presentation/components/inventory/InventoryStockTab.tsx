import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { InvoiceEntity, ProductEntity } from "../../../domain/entities";
import {
  buildProductSearchIndex,
  searchProductsFuzzy,
} from "../../../domain/utils/fuzzySearch";
import { usePosStore } from "../../../application/store/usePosStore";
import { ProductSearchInput } from "../common/ProductSearchInput";
import { ProductDetailsModal } from "./ProductDetailsModal";
import { FilterPills } from "../common/table/FilterPills";
import { useTableSort } from "../common/table/useTableSort";
import { useTablePagination } from "../common/table/useTablePagination";
import { useTableColumns } from "../common/table/useTableColumns";
import { ColumnVisibilityMenu } from "../common/table/ColumnVisibilityMenu";
import { TableExportButton } from "../common/table/TableExportButton";
import { SortableTh } from "../common/table/SortableTh";
import { DataTableToolbar } from "../common/table/DataTableToolbar";
import { DataTableShell } from "../common/table/DataTableShell";
import { TableLoadMoreFooter } from "../common/table/TableLoadMoreFooter";
import {
  INVENTORY_DEFAULT_DIRECTIONS,
  INVENTORY_PAGE_SIZE,
  InventoryFilterMode,
  NearestExpiryInfo,
  computeInventoryRadarStats,
  createInventorySortAccessors,
  getInventoryExportColumns,
  getInventoryFilterPillOptions,
  getInventoryTableColumns,
  getNearestExpiryInfo,
} from "./stock/inventoryStock.config";
import { InventoryStockRow } from "./stock/InventoryStockRow";
import { Keyboard, Package } from "lucide-react";

interface Props {
  products: ProductEntity[];
  invoices: InvoiceEntity[];
  isExternalModalOpen?: boolean;
  onPrintBarcode: (product: ProductEntity) => void;
  onAdjustStock: (product: ProductEntity, batchId?: string) => void;
}

const EMPTY_EXPIRY_INFO: NearestExpiryInfo = {
  days: 9999,
  expiryDate: null,
  activeBatchesCount: 0,
};

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

  const setRowRef = useCallback(
    (productId: string, el: HTMLTableRowElement | null) => {
      rowRefs.current[productId] = el;
    },
    [],
  );

  const inventoryColumns = useMemo(
    () => getInventoryTableColumns(canViewCost),
    [canViewCost],
  );

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

  const exportColumns = useMemo(
    () => getInventoryExportColumns(canViewCost, expiryInfoMap),
    [canViewCost, expiryInfoMap],
  );

  const radarStats = useMemo(
    () =>
      computeInventoryRadarStats(
        products,
        expiryInfoMap,
        soldProductIdsLast60Days,
      ),
    [products, expiryInfoMap, soldProductIdsLast60Days],
  );

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

  const sortAccessors = useMemo(
    () => createInventorySortAccessors(expiryInfoMap),
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
    pageSize: INVENTORY_PAGE_SIZE,
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

  const filterPillOptions = useMemo(
    () => getInventoryFilterPillOptions(products.length, radarStats),
    [products.length, radarStats],
  );

  const handleOpenProductDetails = useCallback((productId: string) => {
    setHighlightedProductId(productId);
    setDetailsProductId(productId);
  }, []);

  const handleQuickAdjustStock = useCallback(
    (product: ProductEntity) => {
      setHighlightedProductId(product.id);
      onAdjustStock(product);
    },
    [onAdjustStock],
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
        {visibleProducts.map((p) => (
          <InventoryStockRow
            key={p.id}
            product={p}
            isHighlighted={highlightedProduct?.id === p.id}
            isDeadStock={
              p.stockPacks > p.minLimit && !soldProductIdsLast60Days.has(p.id)
            }
            expiryInfo={expiryInfoMap.get(p.id) || EMPTY_EXPIRY_INFO}
            canViewCost={canViewCost}
            canAdjustStock={canAdjustStock}
            isColumnVisible={columnsState.isVisible}
            setRowRef={setRowRef}
            onOpenDetails={handleOpenProductDetails}
            onAdjustStock={handleQuickAdjustStock}
          />
        ))}
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
