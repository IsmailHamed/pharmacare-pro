import React, { useMemo, useRef, useState } from "react";
import { usePosStore } from "../../application/store/usePosStore";
import { ProductEntity } from "../../domain/entities";
import { ExcelService } from "../../infrastructure/excel/ExcelService";
import { BarcodeLabelModal } from "../components/BarcodeLabelModal";
import {
  InventoryRadarBar,
  InventoryFilterMode,
} from "../components/inventory/InventoryRadarBar";
import { InventoryItemCard } from "../components/inventory/InventoryItemCard";
import { AddProductModal } from "../components/inventory/AddProductModal";
import { Clock, Tag, FileSpreadsheet, Upload, Plus } from "lucide-react";

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

export const InventoryView: React.FC = () => {
  const {
    products,
    invoices,
    applyBulkPricing,
    addNewProduct,
    importProductsBatch,
  } = usePosStore();

  const [percent, setPercent] = useState(5);
  const [category, setCategory] = useState("ALL");
  const [filterMode, setFilterMode] = useState<InventoryFilterMode>("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<ProductEntity | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(
    () => [
      "ALL",
      ...Array.from(new Set(products.map((p) => p.category || "عام"))),
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
    return products.filter((p) => {
      const days = getNearestExpiryDays(p);
      if (filterMode === "LOW_STOCK") return p.stockPacks <= p.minLimit;
      if (filterMode === "EXP_30") return days <= 30;
      if (filterMode === "EXP_90") return days > 30 && days <= 90;
      if (filterMode === "EXP_180") return days > 90 && days <= 180;
      if (filterMode === "DEAD_STOCK")
        return p.stockPacks > p.minLimit && !soldProductIdsLast60Days.has(p.id);
      return true;
    });
  }, [products, filterMode, soldProductIdsLast60Days]);

  const handleBulkUpdate = () => {
    const scope = category === "ALL" ? "جميع الأدوية" : `فئة (${category})`;
    if (
      window.confirm(
        `هل أنت متأكد من ${percent >= 0 ? "زيادة" : "خفض"} أسعار ${scope} بنسبة ${percent}%؟`,
      )
    ) {
      void applyBulkPricing(percent, category);
    }
  };

  const handleExcelFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await ExcelService.importProductsFromExcel(file);
      await importProductsBatch(imported);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "فشل قراءة ملف الإكسل المرفوع",
      );
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-950 text-slate-200 text-xs">
      {/* شريط العنوان والإجراءات العليا */}
      <div className="mb-5 flex justify-between items-end flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" /> المخزون، رادار
            الصلاحيات، وطباعة الباركود (FIFO)
          </h2>
          <p className="text-slate-400 mt-1">
            تنبيهات الصلاحية الاستباقية (30 / 90 / 180 يوماً)، كشف الأدوية
            الراكدة، وتوليد لصاقات الباركود.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg"
          >
            <Plus className="w-4 h-4" /> إضافة دواء جديد
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => void handleExcelFileChange(e)}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg"
          >
            <Upload className="w-4 h-4" /> استيراد من Excel
          </button>

          <button
            onClick={() => ExcelService.exportInventoryReport(products)}
            className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg"
          >
            <FileSpreadsheet className="w-4 h-4" /> تصدير الجرد (Excel)
          </button>

          <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl flex items-center gap-2 shadow-lg">
            <Tag className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-slate-300">تسعير جماعي:</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded p-1.5 text-white outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "ALL" ? "جميع الفئات" : c}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value))}
              className="w-14 bg-slate-800 border border-slate-700 rounded p-1.5 text-center text-white font-mono"
            />
            <span className="text-slate-400">%</span>
            <button
              onClick={handleBulkUpdate}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg"
            >
              تطبيق
            </button>
          </div>
        </div>
      </div>

      {/* 1. شريط رادار الصلاحيات والرواكد */}
      <InventoryRadarBar
        totalProducts={products.length}
        filterMode={filterMode}
        radarStats={radarStats}
        onSelectFilter={setFilterMode}
      />

      {/* 2. قائمة بطاقات الأدوية */}
      <div className="space-y-3">
        {filteredProducts.map((p) => (
          <InventoryItemCard
            key={p.id}
            product={p}
            nearestDays={getNearestExpiryDays(p)}
            isDeadStock={
              p.stockPacks > p.minLimit && !soldProductIdsLast60Days.has(p.id)
            }
            onPrintBarcode={setBarcodeProduct}
          />
        ))}
      </div>

      {/* 3. النوافذ المنبثقة */}
      <BarcodeLabelModal
        product={barcodeProduct}
        onClose={() => setBarcodeProduct(null)}
      />

      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddProduct={addNewProduct}
      />
    </div>
  );
};
