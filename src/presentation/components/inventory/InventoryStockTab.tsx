import React, { useMemo, useState } from "react";
import { InvoiceEntity, ProductEntity } from "../../../domain/entities";
import { InventoryRadarBar, InventoryFilterMode } from "./InventoryRadarBar";
import { InventoryItemCard } from "./InventoryItemCard";
import { Search, ChevronDown } from "lucide-react";

const PAGE_SIZE = 50;

const getNearestExpiryDays = (product: ProductEntity): number => {
  if (!product.batches || product.batches.length === 0) return 9999;
  const nowMs = Date.now();
  const daysList = product.batches
    .filter((b) => b.qtyPacks > 0)
    .map((b) => {
      const expMs = new Date(b.expiryDate).getTime();
      return Math.ceil((expMs - nowMs) / (1000 * 60 * 60 * 24));
    });
  return daysList.length > 0 ? Math.min(...daysList) : 9999;
};

interface Props {
  products: ProductEntity[];
  invoices: InvoiceEntity[];
  onPrintBarcode: (product: ProductEntity) => void;
  onAdjustStock: (product: ProductEntity) => void;
}

/**
 * تبويب المخزون ورادار الصلاحيات: يعرض التنبيهات الاستباقية، البحث الفوري، والبطاقات المقسّمة
 */
export const InventoryStockTab: React.FC<Props> = ({
  products,
  invoices,
  onPrintBarcode,
  onAdjustStock,
}) => {
  const [filterMode, setFilterMode] = useState<InventoryFilterMode>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);

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

  const radarStats = useMemo(() => {
    let lowStockCount = 0;
    let exp30Count = 0;
    let exp90Count = 0;
    let exp180Count = 0;
    let deadStockCount = 0;

    products.forEach((p) => {
      if (p.stockPacks <= p.minLimit) lowStockCount++;
      const days = getNearestExpiryDays(p);
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
  }, [products, soldProductIdsLast60Days]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.scientificName.toLowerCase().includes(q) &&
        !p.barcode.toLowerCase().includes(q)
      ) {
        return false;
      }

      const days = getNearestExpiryDays(p);
      if (filterMode === "LOW_STOCK") return p.stockPacks <= p.minLimit;
      if (filterMode === "EXP_30") return days <= 30;
      if (filterMode === "EXP_90") return days > 30 && days <= 90;
      if (filterMode === "EXP_180") return days > 90 && days <= 180;
      if (filterMode === "DEAD_STOCK")
        return p.stockPacks > p.minLimit && !soldProductIdsLast60Days.has(p.id);
      return true;
    });
  }, [products, filterMode, soldProductIdsLast60Days, searchQuery]);

  // اقتصاص العناصر المرئية لمنع تجمّد الـ DOM عند وجود 10,000+ دواء
  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleLimit),
    [filteredProducts, visibleLimit],
  );

  const handleSelectFilter = (mode: InventoryFilterMode) => {
    setFilterMode(mode);
    setVisibleLimit(PAGE_SIZE);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setVisibleLimit(PAGE_SIZE);
  };

  return (
    <>
      {/* 1. شريط رادار الصلاحيات والرواكد */}
      <InventoryRadarBar
        totalProducts={products.length}
        filterMode={filterMode}
        radarStats={radarStats}
        onSelectFilter={handleSelectFilter}
      />

      {/* 2. شريط البحث الفوري في المخزون وعداد العناصر المعروضة */}
      <div className="mb-4 flex items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="ابحث في المخزون بالاسم التجاري، المادة الفعالة، أو الباركود..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pr-9 pl-3 py-2 text-white outline-none focus:border-amber-500"
          />
        </div>
        <div className="text-slate-400 font-mono shrink-0">
          يعرض <b className="text-white">{visibleProducts.length}</b> من أصل{" "}
          <b className="text-amber-400">{filteredProducts.length}</b> صنف مطابق
        </div>
      </div>

      {/* 3. قائمة بطاقات الأدوية (محدودة بـ visibleLimit لأداء فائق) */}
      <div className="space-y-3">
        {visibleProducts.map((p) => (
          <InventoryItemCard
            key={p.id}
            product={p}
            nearestDays={getNearestExpiryDays(p)}
            isDeadStock={
              p.stockPacks > p.minLimit && !soldProductIdsLast60Days.has(p.id)
            }
            onPrintBarcode={onPrintBarcode}
            onAdjustStock={onAdjustStock}
          />
        ))}
      </div>

      {/* زر تحميل المزيد عند وجود أصناف أكثر من الحد المعروض */}
      {filteredProducts.length > visibleLimit && (
        <div className="pt-4 text-center">
          <button
            type="button"
            onClick={() => setVisibleLimit((prev) => prev + PAGE_SIZE)}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold px-6 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-lg transition"
          >
            <ChevronDown className="w-4 h-4 text-amber-400" />
            عرض {PAGE_SIZE} صنفاً إضافياً (المتبقي:{" "}
            {filteredProducts.length - visibleLimit} صنف)
          </button>
        </div>
      )}
    </>
  );
};
