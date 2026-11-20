import React, { useEffect, useMemo, useState } from "react";
import { usePosStore } from "../../application/store/usePosStore";
import { ProductEntity } from "../../domain/entities";
import { BarcodeLabelModal } from "../components/BarcodeLabelModal";
import { AddProductModal } from "../components/inventory/AddProductModal";
import { StockAdjustmentModal } from "../components/inventory/StockAdjustmentModal";
import { InventoryHeaderActions } from "../components/inventory/InventoryHeaderActions";
import { InventoryStockTab } from "../components/inventory/InventoryStockTab";
import { InventoryShortagesTab } from "../components/inventory/InventoryShortagesTab";
import { InventoryLossesTab } from "../components/inventory/InventoryLossesTab";
import { ClipboardCheck, ClipboardList, Package } from "lucide-react";

type InventorySubTab = "stock" | "shortages" | "losses";

export const InventoryView: React.FC = () => {
  const {
    products,
    invoices,
    expenses,
    applyBulkPricing,
    addNewProduct,
    importProductsBatch,
  } = usePosStore();

  const canBulkPricing = usePosStore(
    (s) => s.currentUser?.permissions.canBulkPricing ?? false,
  );
  const canViewCost = usePosStore(
    (s) => s.currentUser?.permissions.canViewCostAndProfit ?? false,
  );

  const [activeSubTab, setActiveSubTab] = useState<InventorySubTab>("stock");
  const [showAddModal, setShowAddModal] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<ProductEntity | null>(
    null,
  );
  const [adjustmentProduct, setAdjustmentProduct] =
    useState<ProductEntity | null>(null);

  // إغلاق آمن: العودة تلقائياً لتبويب المخزون إذا تم تبديل المستخدم لحساب لا يملك صلاحية عرض التكلفة والخسائر
  useEffect(() => {
    if (!canViewCost && activeSubTab === "losses") {
      setActiveSubTab("stock");
    }
  }, [canViewCost, activeSubTab]);

  // استخراج وترتيب الأصناف الواقعة عند أو تحت حد الطلب لتبويب دفتر النواقص والطلبيات
  const shortageProducts = useMemo(
    () =>
      products
        .filter((p) => p.stockPacks <= p.minLimit)
        .sort((a, b) => a.stockPacks - b.stockPacks),
    [products],
  );

  // سجل التوالف والفروقات الجردية المقيدة مالياً
  const inventoryLossLogs = useMemo(
    () => expenses.filter((e) => e.shiftId === "INVENTORY-LOSS"),
    [expenses],
  );

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-950 text-slate-200 text-xs">
      {/* الترويسة العليا وإجراءات الإضافة والإكسل والتسعير الجماعي */}
      <InventoryHeaderActions
        products={products}
        canBulkPricing={canBulkPricing}
        onOpenAddModal={() => setShowAddModal(true)}
        onImportProductsBatch={importProductsBatch}
        onApplyBulkPricing={applyBulkPricing}
      />

      {/* شريط التبويبات الداخلية: المخزون + دفتر النواقص + سجل التوالف (وفق الصلاحيات) */}
      <div className="mb-5 flex items-center gap-2 flex-wrap bg-slate-900 p-1.5 rounded-xl border border-slate-800 w-fit">
        <button
          type="button"
          onClick={() => setActiveSubTab("stock")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition ${
            activeSubTab === "stock"
              ? "bg-amber-600 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Package className="w-4 h-4" />
          المخزون ورادار الصلاحيات
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
              activeSubTab === "stock"
                ? "bg-amber-950/50 text-amber-100"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            {products.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("shortages")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition ${
            activeSubTab === "shortages"
              ? "bg-sky-600 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          دفتر النواقص والطلبيات
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
              activeSubTab === "shortages"
                ? "bg-sky-950/60 text-sky-100"
                : shortageProducts.length > 0
                  ? "bg-rose-600 text-white"
                  : "bg-slate-800 text-slate-400"
            }`}
          >
            {shortageProducts.length}
          </span>
        </button>

        {canViewCost && (
          <button
            type="button"
            onClick={() => setActiveSubTab("losses")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition ${
              activeSubTab === "losses"
                ? "bg-rose-700 text-white shadow-md"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            سجل التوالف والكسور والفروقات الجردية
            <span
              className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                activeSubTab === "losses"
                  ? "bg-rose-950/60 text-rose-100"
                  : inventoryLossLogs.length > 0
                    ? "bg-rose-950 text-rose-300 border border-rose-800/70"
                    : "bg-slate-800 text-slate-400"
              }`}
            >
              {inventoryLossLogs.length}
            </span>
          </button>
        )}
      </div>

      {/* التبويب الأول: المخزون ورادار الصلاحيات */}
      {activeSubTab === "stock" && (
        <InventoryStockTab
          products={products}
          invoices={invoices}
          onPrintBarcode={setBarcodeProduct}
          onAdjustStock={setAdjustmentProduct}
        />
      )}

      {/* التبويب الثاني: دفتر النواقص الذكي وتوليد طلبية المستودع */}
      {activeSubTab === "shortages" && (
        <InventoryShortagesTab
          shortageProducts={shortageProducts}
          canViewCost={canViewCost}
        />
      )}

      {/* التبويب الثالث: سجل التوالف والكسور والفروقات الجردية المقيدة مالياً */}
      {canViewCost && activeSubTab === "losses" && (
        <InventoryLossesTab logs={inventoryLossLogs} />
      )}

      {/* النوافذ المنبثقة */}
      <BarcodeLabelModal
        product={barcodeProduct}
        onClose={() => setBarcodeProduct(null)}
      />

      <StockAdjustmentModal
        product={adjustmentProduct}
        onClose={() => setAdjustmentProduct(null)}
      />

      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddProduct={addNewProduct}
      />
    </div>
  );
};
