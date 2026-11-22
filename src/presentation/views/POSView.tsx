import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import { usePosStore } from "../../application/store/usePosStore";
import { ClinicalDecisionUseCase } from "../../application/use-cases/ClinicalDecisionUseCase";
import {
  buildProductSearchIndex,
  searchProductsFuzzy,
} from "../../domain/utils/fuzzySearch";
import { SoundFeedbackService } from "../../infrastructure/audio/SoundFeedbackService";
import { ProductCatalog } from "../components/pos/ProductCatalog";
import { CartView } from "../components/pos/CartView";
import { ControlledDrugModal } from "../components/pos/ControlledDrugModal";
import { AlternativesModal } from "../components/pos/AlternativesModal";
import { HeldInvoicesBar } from "../components/pos/HeldInvoicesBar";
import { ThermalReceiptModal } from "../components/pos/ThermalReceiptModal";
import { InvoicesHistoryModal } from "../components/pos/InvoicesHistoryModal";
import { ShiftLockOverlay } from "../components/pos/ShiftLockOverlay";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { usePosZeroMouseShortcuts } from "../hooks/usePosZeroMouseShortcuts";
import { useHeldInvoicesShortcuts } from "../hooks/useHeldInvoicesShortcuts";
import { ProductEntity, DrugInteractionAlert } from "../../domain/entities";
import { AlertTriangle, Inbox, ArrowRightLeft } from "lucide-react";

/**
 * شاشة نقطة البيع الموحدة (POS)
 * طبقة Presentation خالصة: تعرض الحالة وتستدعي إجراءات الـ Store فقط.
 */
export const POSView: React.FC = () => {
  const store = usePosStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const openShift = useMemo(
    () => store.shifts.find((s) => s.status === "OPEN"),
    [store.shifts],
  );
  const lastClosedShift = useMemo(
    () => store.shifts.find((s) => s.status === "CLOSED"),
    [store.shifts],
  );

  const isShiftLocked = !openShift;

  const isDifferentShiftOwner = Boolean(
    openShift &&
    store.currentUser &&
    ((openShift.openedByUserId &&
      openShift.openedByUserId !== store.currentUser.id) ||
      (!openShift.openedByUserId &&
        openShift.pharmacistName.trim() !== store.currentUser.name.trim())),
  );

  const isAnyModalOpen =
    isShiftLocked ||
    isHistoryOpen ||
    Boolean(store.pendingControlledItem) ||
    Boolean(store.selectedProductForAlternatives) ||
    Boolean(store.lastPrintedInvoice);

  useBarcodeScanner(!isAnyModalOpen, () => setSearchQuery(""));

  usePosZeroMouseShortcuts({
    enabled: !isAnyModalOpen,
    searchQuery,
    searchInputRef,
    activeCartItem: store.cart[0],
    scannerMaxIntervalMs: store.settings.scannerMaxIntervalMs || 45,
    onIncrementQty: store.updateCartQty,
    onToggleUnit: store.toggleCartItemUnit,
    onRemoveItem: store.removeFromCart,
  });

  useHeldInvoicesShortcuts({
    enabled: !isAnyModalOpen,
    heldInvoices: store.heldInvoices,
    onResumeInvoice: store.resumeInvoice,
  });

  const productSearchIndex = useMemo(
    () => buildProductSearchIndex(store.products),
    [store.products],
  );

  const filteredProducts = useMemo(
    () => searchProductsFuzzy(productSearchIndex, searchQuery, 60),
    [productSearchIndex, searchQuery],
  );

  const cartSubtotal = useMemo(
    () => store.cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0),
    [store.cart],
  );

  const cartNetTotal = useMemo(
    () => cartSubtotal - (cartSubtotal * store.discountPercent) / 100,
    [cartSubtotal, store.discountPercent],
  );

  const handleSearchEnter = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter" || isShiftLocked) return;
      const q = searchQuery.trim();
      if (!q) return;

      const isDirectScanQuery =
        q.toUpperCase().startsWith("INV-") ||
        q.toUpperCase().endsWith("-S") ||
        store.products.some((p) => p.barcode.toLowerCase() === q.toLowerCase());

      if (isDirectScanQuery) {
        const handled = store.handleBarcodeScan(q);
        if (handled) {
          setSearchQuery("");
        }
        return;
      }

      const firstMatch = filteredProducts[0];
      if (firstMatch) {
        store.requestAddToCart(firstMatch, "pack");
        setSearchQuery("");
      } else {
        SoundFeedbackService.playWarningBuzzer();
        store.setNotification({
          type: "warning",
          message: `لم يتم العثور على صنف دوائي مطابق لـ (${q})`,
        });
      }
    },
    [searchQuery, filteredProducts, store, isShiftLocked],
  );

  const handleAddToCart = useCallback(
    (product: ProductEntity, unit: "pack" | "strip") => {
      if (isShiftLocked) return;
      store.requestAddToCart(product, unit);
    },
    [store, isShiftLocked],
  );

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
    onCheckout: () => {
      if (isShiftLocked) return;
      void store.completeCheckout();
    },
    onFocusSearch: () => {
      if (isShiftLocked) return;
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    },
    onAlternatives: () => {
      if (isShiftLocked) return;
      const target = store.cart[0]?.product || filteredProducts[0] || null;
      if (target) store.setSelectedProductForAlternatives(target);
    },
    onHoldResume: () => {
      if (isShiftLocked) return;
      store.holdCurrentInvoice();
    },
    onReturn: () => {
      if (isShiftLocked) return;
      store.toggleReturnMode();
    },
  });

  // تركيز تلقائي على خانة البحث عند دخول شاشة نقطة البيع والوردية مفتوحة
  useEffect(() => {
    if (!isAnyModalOpen) {
      const timer = window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 40);
      return () => window.clearTimeout(timer);
    }
  }, [isAnyModalOpen]);

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      {isDifferentShiftOwner && openShift && store.currentUser && (
        <div className="bg-amber-950/60 border-b border-amber-700/70 px-4 py-1.5 flex items-center justify-between gap-3 text-[11px] text-amber-200">
          <div className="flex items-center gap-2 min-w-0">
            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">
              عهدة الدرج المفتوحة باسم{" "}
              <b className="text-white">{openShift.pharmacistName}</b> •
              المستخدم النشط الآن:{" "}
              <b className="text-amber-300">{store.currentUser.name}</b>
            </span>
          </div>
          <span className="text-[10px] text-amber-300/80 shrink-0 hidden md:inline">
            تبقى الفواتير مرتبطة بالدرج المفتوح حتى إغلاق الوردية يدوياً
          </span>
        </div>
      )}

      {store.interactionAlerts.length > 0 && (
        <InteractionAlertBar alerts={store.interactionAlerts} />
      )}

      <HeldInvoicesBar
        heldInvoices={store.heldInvoices}
        onResume={(id) => store.resumeInvoice(id)}
        activeCustomerName={store.customerName}
        activeCartCount={store.cart.length}
        activeCartTotal={cartNetTotal}
        onHoldCurrent={() => store.holdCurrentInvoice()}
        invoicesCount={store.invoices.length}
        onOpenHistory={() => setIsHistoryOpen(true)}
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
          subtotal={cartSubtotal}
          discountPercent={store.discountPercent}
          paymentMode={store.paymentMode}
          customerName={store.customerName}
          invoiceMode={store.invoiceMode}
          heldCount={store.heldInvoices.length}
          returnSourceInvoiceId={store.returnSourceInvoiceId}
          recentSaleInvoices={recentSaleInvoices}
          isShortcutsPaused={isAnyModalOpen}
          onLoadInvoiceForReturn={store.loadInvoiceForReturn}
          onSetDiscount={store.setDiscountPercent}
          onSetPaymentMode={store.setPaymentMode}
          onSetCustomerName={store.setCustomerName}
          updateQty={store.updateCartQty}
          onToggleUnit={store.toggleCartItemUnit}
          removeFromCart={store.removeFromCart}
          onCheckout={() => void store.completeCheckout()}
          onToggleReturn={store.toggleReturnMode}
          onHold={() => store.holdCurrentInvoice()}
        />
      </div>

      {isShiftLocked && (
        <ShiftLockOverlay
          currentUser={store.currentUser}
          lastClosedShift={lastClosedShift}
          onOpenShift={store.openNewShift}
          onShiftOpenedFocus={() => searchInputRef.current?.focus()}
        />
      )}

      <ControlledDrugModal
        pendingItem={store.pendingControlledItem}
        onClose={() => store.setPendingControlledItem(null)}
        onConfirm={(product, unit, meta) =>
          store.addToCart(product, unit, meta)
        }
      />

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

      <InvoicesHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
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
