import React, { useState, useRef, useMemo, useCallback } from "react";
import { usePosStore } from "../../application/store/usePosStore";
import { ClinicalDecisionUseCase } from "../../application/use-cases/ClinicalDecisionUseCase";
import { ProductCatalog } from "../components/ProductCatalog";
import { CartView } from "../components/CartView";
import { ControlledDrugModal } from "../components/ControlledDrugModal";
import { AlternativesModal } from "../components/AlternativesModal";
import { HeldInvoicesBar } from "../components/HeldInvoicesBar";
import { ThermalReceiptModal } from "../components/ThermalReceiptModal";
import { SettingsModal } from "../components/SettingsModal";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { ProductEntity, DrugInteractionAlert } from "../../domain/entities";
import { AlertTriangle, Inbox, Settings, Barcode } from "lucide-react";

/**
 * شاشة نقطة البيع الموحدة (POS)
 * طبقة Presentation خالصة: تعرض الحالة وتستدعي إجراءات الـ Store فقط.
 */
export const POSView: React.FC = () => {
  const store = usePosStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // الخطوة 1: تشغيل مستمع قارئ الباركود الليزري العالمي مع تفريغ حقل البحث تلقائياً عند اللقط
  useBarcodeScanner(!isSettingsOpen, () => setSearchQuery(""));

  // البحث الذكي: باركود، اسم تجاري، أو مادة فعالة
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return store.products;
    const baseBarcode = q.endsWith("-s") ? q.slice(0, -2) : q;
    return store.products.filter(
      (p) =>
        p.barcode.includes(baseBarcode) ||
        p.name.toLowerCase().includes(q) ||
        p.scientificName.toLowerCase().includes(q),
    );
  }, [searchQuery, store.products]);

  const handleSearchEnter = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      const q = searchQuery.trim();
      if (!q) return;

      // إذا أدخل رقم فاتورة (INV-...) أو باركود شريط فرط (-S) أو باركود علبة قياسي
      if (
        q.toUpperCase().startsWith("INV-") ||
        q.toUpperCase().endsWith("-S") ||
        store.products.some((p) => p.barcode.toLowerCase() === q.toLowerCase())
      ) {
        const handled = store.handleBarcodeScan(q);
        if (handled) {
          setSearchQuery("");
          return;
        }
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

  const recentSaleInvoices = useMemo(
    () => store.invoices.filter((inv) => inv.type === "SALE").slice(0, 8),
    [store.invoices],
  );

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
      {/* شريط حالة القارئ الليزري وزر إعدادات الصيدلية والطابعة */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-1.5 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="bg-emerald-950 border border-emerald-800 text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
            <Barcode className="w-3.5 h-3.5" /> قارئ الليزر التلقائي نشط
          </span>
          <span className="text-slate-400">
            ({store.settings.pharmacyName} — الطابعة:{" "}
            <b className="font-mono text-slate-300">
              {store.settings.thermalPrinterName}
            </b>
            )
          </span>
        </div>

        <button
          onClick={() => setIsSettingsOpen(true)}
          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition"
        >
          <Settings className="w-3.5 h-3.5 text-emerald-400" />
          إعدادات الصيدلية والطابعة
        </button>
      </div>

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
          returnSourceInvoiceId={store.returnSourceInvoiceId}
          recentSaleInvoices={recentSaleInvoices}
          onLoadInvoiceForReturn={store.loadInvoiceForReturn}
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

      {/* نافذة الإيصال الحراري ولصاقات الجرعات */}
      <ThermalReceiptModal
        invoice={store.lastPrintedInvoice}
        onClose={() => store.setLastPrintedInvoice(null)}
      />

      {/* نافذة إعدادات الصيدلية والطابعة والمزامنة (الخطوة 4) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
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
