import React, { useState, useRef, useMemo, useCallback } from "react";
import { usePosStore } from "../../application/store/usePosStore";
import { ClinicalDecisionUseCase } from "../../application/use-cases/ClinicalDecisionUseCase";
import { ProductCatalog } from "../components/ProductCatalog";
import { CartView } from "../components/CartView";
import { ControlledDrugModal } from "../components/ControlledDrugModal";
import { AlternativesModal } from "../components/AlternativesModal";
import { HeldInvoicesBar } from "../components/HeldInvoicesBar";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { ProductEntity, DrugInteractionAlert } from "../../domain/entities";
import { AlertTriangle, Inbox } from "lucide-react";
import { ThermalReceiptModal } from "../components/ThermalReceiptModal";
/**
 * شاشة نقطة البيع الموحدة (POS)
 * طبقة Presentation خالصة: تعرض الحالة وتستدعي إجراءات الـ Store فقط.
 */
export const POSView: React.FC = () => {
  const store = usePosStore();
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // البحث الذكي: باركود، اسم تجاري، أو مادة فعالة
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return store.products;
    return store.products.filter(
      (p) =>
        p.barcode.includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.scientificName.toLowerCase().includes(q),
    );
  }, [searchQuery, store.products]);

  const handleSearchEnter = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return;

      const exactBarcode = store.products.find((p) => p.barcode === q);
      if (exactBarcode) {
        store.requestAddToCart(exactBarcode, "pack");
        setSearchQuery("");
        return;
      }

      const firstMatch = filteredProducts[0];
      if (firstMatch) {
        store.requestAddToCart(firstMatch, "pack");
        setSearchQuery("");
      }
    },
    [searchQuery, filteredProducts, store],
  );

  const handleAddToCart = useCallback(
    (product: ProductEntity, unit: "pack" | "strip") => {
      store.requestAddToCart(product, unit);
    },
    [store],
  );

  // F4: عرض البدائل بنفس المادة الفعالة
  const alternatives = useMemo(() => {
    if (!store.selectedProductForAlternatives) return [];
    return ClinicalDecisionUseCase.findAlternatives(
      store.selectedProductForAlternatives,
      store.products,
    );
  }, [store.selectedProductForAlternatives, store.products]);

  useKeyboardShortcuts({
    onCheckout: () => void store.completeCheckout(),
    onFocusSearch: () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    },
    onAlternatives: () => {
      const target = store.cart[0]?.product || filteredProducts[0] || null;
      if (target) store.setSelectedProductForAlternatives(target);
    },
    onHoldResume: () => store.holdCurrentInvoice(),
    onReturn: () => store.toggleReturnMode(),
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* شريط التحذير الطبي الوامض (تداخل دوائي) */}
      {store.interactionAlerts.length > 0 && (
        <InteractionAlertBar alerts={store.interactionAlerts} />
      )}

      {/* شريط الفواتير المعلقة */}
      <HeldInvoicesBar
        heldInvoices={store.heldInvoices}
        onResume={(id) => store.resumeInvoice(id)}
      />

      <div className="flex-1 flex overflow-hidden">
        <ProductCatalog
          ref={searchInputRef}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchEnter={handleSearchEnter}
          products={filteredProducts}
          onAddToCart={handleAddToCart}
          onShowAlternatives={(p) => store.setSelectedProductForAlternatives(p)}
          invoiceMode={store.invoiceMode}
        />

        <CartView
          cart={store.cart}
          subtotal={store.cart.reduce(
            (sum, item) => sum + item.unitPrice * item.qty,
            0,
          )}
          discountPercent={store.discountPercent}
          paymentMode={store.paymentMode}
          customerName={store.customerName}
          invoiceMode={store.invoiceMode}
          heldCount={store.heldInvoices.length}
          onSetDiscount={store.setDiscountPercent}
          onSetPaymentMode={store.setPaymentMode}
          onSetCustomerName={store.setCustomerName}
          updateQty={store.updateCartQty}
          removeFromCart={store.removeFromCart}
          onCheckout={() => void store.completeCheckout()}
          onToggleReturn={store.toggleReturnMode}
          onHold={() => store.holdCurrentInvoice()}
        />
      </div>

      {/* نافذة توثيق الوصفة للأدوية المراقبة - متطابقة مع ControlledDrugModal.tsx */}
      <ControlledDrugModal
        pendingItem={store.pendingControlledItem}
        onClose={() => store.setPendingControlledItem(null)}
        onConfirm={(product, unit, meta) =>
          store.addToCart(product, unit, meta)
        }
      />

      {/* نافذة البدائل العلمية (F4) - متطابقة مع AlternativesModal.tsx */}
      <AlternativesModal
        targetProduct={store.selectedProductForAlternatives}
        alternatives={alternatives}
        onClose={() => store.setSelectedProductForAlternatives(null)}
        onSelectAlternative={(product, unit) => {
          store.requestAddToCart(product, unit);
          store.setSelectedProductForAlternatives(null);
        }}
      />
      <ThermalReceiptModal
        invoice={store.lastPrintedInvoice}
        onClose={() => store.setLastPrintedInvoice(null)}
      />
    </div>
  );
};

const InteractionAlertBar: React.FC<{ alerts: DrugInteractionAlert[] }> = ({
  alerts,
}) => (
  <div className="animate-pulse bg-rose-950 border-b-2 border-rose-600 px-4 py-2 flex items-start gap-3">
    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
    <div className="flex-1 space-y-1">
      {alerts.map((a) => (
        <div key={a.id} className="text-xs">
          <span className="font-extrabold text-rose-300">
            ⛔ تحذير طبي ({a.severity === "HIGH" ? "خطير" : "متوسط"}):{" "}
            {a.drugAName} + {a.drugBName}
          </span>
          <span className="text-rose-200"> — {a.description}</span>
        </div>
      ))}
    </div>
  </div>
);

export const EmptyCatalogHint: React.FC = () => (
  <div className="flex-1 flex items-center justify-center text-slate-600 text-xs gap-2">
    <Inbox className="w-5 h-5" /> لا توجد نتائج مطابقة للبحث
  </div>
);
