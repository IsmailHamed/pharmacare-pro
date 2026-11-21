import React, { useEffect, useMemo, useState } from "react";
import { usePosStore } from "../../application/store/usePosStore";
import { ProductEntity } from "../../domain/entities";
import { BarcodeLabelModal } from "../components/BarcodeLabelModal";
import { AddProductModal } from "../components/inventory/AddProductModal";
import { StockAdjustmentModal } from "../components/inventory/StockAdjustmentModal";
import { InventoryHeaderActions } from "../components/inventory/InventoryHeaderActions";
import { InventoryStockTab } from "../components/inventory/InventoryStockTab";
import { InventoryLossesTab } from "../components/inventory/InventoryLossesTab";
import { ClipboardCheck, Package } from "lucide-react";

type InventorySubTab = "stock" | "losses";

interface AdjustmentTarget {
  product: ProductEntity;
  batchId?: string;
}

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
  const [adjustmentTarget, setAdjustmentTarget] =
    useState<AdjustmentTarget | null>(null);

  // إغلاق آمن: العودة تلقائياً لتبويب المخزون إذا تم تبديل المستخدم لحساب لا يملك صلاحية عرض التكلفة والخسائر
  useEffect(() => {
    if (!canViewCost && activeSubTab === "losses") {
      setActiveSubTab("stock");
    }
  }, [canViewCost, activeSubTab]);

  // سجل التوالف والفروقات الجردية المقيدة مالياً
  const inventoryLossLogs = useMemo(
    () => expenses.filter((e) => e.shiftId === "INVENTORY-LOSS"),
    [expenses],
  );

  const isExternalModalOpen =
    showAddModal || Boolean(barcodeProduct) || Boolean(adjustmentTarget);

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-950 text-slate-200 text-xs">
      {/* الترويسة العليا المدمجة: زر إضافة رئيسي + قائمة أدوات المخزون المنسدلة */}
      <InventoryHeaderActions
        products={products}
        canBulkPricing={canBulkPricing}
        onOpenAddModal={() => setShowAddModal(true)}
        onImportProductsBatch={importProductsBatch}
        onApplyBulkPricing={applyBulkPricing}
      />

      {/* شريط التبويبات الداخلية: المخزون + سجل التوالف (وفق الصلاحيات) */}
      <div className="mb-4 flex items-center gap-2 flex-wrap bg-slate-900 p-1.5 rounded-xl border border-slate-800 w-fit">
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

      {/* التبويب الأول: المخزون ورادار الصلاحيات بالجدول الكامل ونافذة التفاصيل */}
      {activeSubTab === "stock" && (
        <InventoryStockTab
          products={products}
          invoices={invoices}
          isExternalModalOpen={isExternalModalOpen}
          onPrintBarcode={setBarcodeProduct}
          onAdjustStock={(product, batchId) =>
            setAdjustmentTarget({ product, batchId })
          }
        />
      )}

      {/* التبويب الثاني: سجل التوالف والكسور والفروقات الجردية المقيدة مالياً */}
      {canViewCost && activeSubTab === "losses" && (
        <InventoryLossesTab logs={inventoryLossLogs} />
      )}

      {/* النوافذ المنبثقة */}
      <BarcodeLabelModal
        product={barcodeProduct}
        onClose={() => setBarcodeProduct(null)}
      />

      <StockAdjustmentModal
        product={adjustmentTarget?.product ?? null}
        initialBatchId={adjustmentTarget?.batchId}
        onClose={() => setAdjustmentTarget(null)}
      />

      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddProduct={addNewProduct}
      />
    </div>
  );
};
