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
import { ProductCatalog } from "../components/ProductCatalog";
import { CartView } from "../components/CartView";
import { ControlledDrugModal } from "../components/ControlledDrugModal";
import { AlternativesModal } from "../components/AlternativesModal";
import { HeldInvoicesBar } from "../components/HeldInvoicesBar";
import { ThermalReceiptModal } from "../components/ThermalReceiptModal";
import { InvoicesHistoryModal } from "../components/InvoicesHistoryModal";
import { ShortagesOrderModal } from "../components/ShortagesOrderModal";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { ProductEntity, DrugInteractionAlert } from "../../domain/entities";
import {
  AlertTriangle,
  Inbox,
  Barcode,
  FileText,
  ClipboardList,
  Volume2,
  VolumeX,
} from "lucide-react";

/**
 * شاشة نقطة البيع الموحدة (POS)
 * طبقة Presentation خالصة: تعرض الحالة وتستدعي إجراءات الـ Store فقط.
 */
export const POSView: React.FC = () => {
  const store = usePosStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isShortagesOpen, setIsShortagesOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() =>
    SoundFeedbackService.isEnabled(),
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastScannerCharAtRef = useRef<number>(0);

  // إيقاف لقط الباركود التلقائي والاختصارات عند فتح أي نافذة منبثقة فرعية
  const isAnyModalOpen =
    isHistoryOpen ||
    isShortagesOpen ||
    Boolean(store.pendingControlledItem) ||
    Boolean(store.selectedProductForAlternatives) ||
    Boolean(store.lastPrintedInvoice);

  useBarcodeScanner(!isAnyModalOpen, () => setSearchQuery(""));

  // اختصارات "صفر ماوس" (Zero-Mouse POS) للتحكم المباشر بآخر صنف مضاف للسلة (cart[0])
  useEffect(() => {
    const handleZeroMouseKeyDown = (e: KeyboardEvent) => {
      if (isAnyModalOpen) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // تتبع النبضات السريعة لقارئ الباركود لتفادي تداخل علامة "-" في باركودات (INV- / -S)
      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        lastScannerCharAtRef.current = performance.now();
        return;
      }

      const activeCartItem = store.cart[0];
      if (!activeCartItem) return;

      const target = e.target as HTMLElement | null;
      const isSearchInput = target === searchInputRef.current;
      const isOtherEditable =
        target &&
        !isSearchInput &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      // لا نتدخل إذا كان المستخدم يكتب داخل حقل آخر (مثل اسم العميل أو نسبة الخصم)
      if (isOtherEditable) return;

      // إذا كان المؤشر داخل خانة البحث وفيها نص قيد الكتابة، نترك المفاتيح تعمل بشكلها الطبيعي
      if (isSearchInput && searchQuery.trim().length > 0) return;

      const isPlus = e.key === "+" || e.code === "NumpadAdd";
      const isMinus = e.key === "-" || e.code === "NumpadSubtract";
      const isTabToggle = e.key === "Tab" && !e.shiftKey;
      const isDelete = e.key === "Delete";

      if (!isPlus && !isMinus && !isTabToggle && !isDelete) return;

      // تجاهل علامة "-" إذا جاءت ضمن تدفق سريع من قارئ الباركود الليزري
      if (e.key === "-" && e.code !== "NumpadSubtract") {
        const scannerGuardMs = Math.max(
          120,
          (store.settings.scannerMaxIntervalMs || 45) * 2,
        );
        if (performance.now() - lastScannerCharAtRef.current < scannerGuardMs) {
          return;
        }
      }

      e.preventDefault();

      if (isPlus) {
        store.updateCartQty(activeCartItem.cartKey, 1);
      } else if (isMinus) {
        store.updateCartQty(activeCartItem.cartKey, -1);
      } else if (isTabToggle) {
        store.toggleCartItemUnit(activeCartItem.cartKey);
      } else if (isDelete) {
        store.removeFromCart(activeCartItem.cartKey);
      }
    };

    window.addEventListener("keydown", handleZeroMouseKeyDown);
    return () => window.removeEventListener("keydown", handleZeroMouseKeyDown);
  }, [
    isAnyModalOpen,
    searchQuery,
    store.cart,
    store.settings.scannerMaxIntervalMs,
    store.updateCartQty,
    store.toggleCartItemUnit,
    store.removeFromCart,
  ]);

  // اختصارات التبديل السريع بين تبويبات الزبائن المعلقين (Alt + 1 .. Alt + 9)
  useEffect(() => {
    const handleHeldTabShortcuts = (e: KeyboardEvent) => {
      if (isAnyModalOpen) return;
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;

      let digit: number | null = null;

      // الاعتماد على e.code أولاً لضمان العمل مع لوحة المفاتيح العربية والإنجليزية والـ Numpad
      const codeMatch = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (codeMatch) {
        digit = Number(codeMatch[1]);
      } else if (/^[1-9]$/.test(e.key)) {
        digit = Number(e.key);
      }

      if (digit === null) return;

      const targetHeld = store.heldInvoices[digit - 1];
      if (!targetHeld) return;

      e.preventDefault();
      store.resumeInvoice(targetHeld.id);
    };

    window.addEventListener("keydown", handleHeldTabShortcuts);
    return () => window.removeEventListener("keydown", handleHeldTabShortcuts);
  }, [isAnyModalOpen, store.heldInvoices, store.resumeInvoice]);

  // بناء فهرس البحث الصوتي والضبابي مسبقاً لمرة واحدة عند تغيّر قائمة الأدوية
  const productSearchIndex = useMemo(
    () => buildProductSearchIndex(store.products),
    [store.products],
  );

  // البحث الضبابي والصوتي الفائق السرعة (يدعم 10,000+ دواء والبحث المزدوج مثل "pan 500")
  const filteredProducts = useMemo(
    () => searchProductsFuzzy(productSearchIndex, searchQuery, 60),
    [productSearchIndex, searchQuery],
  );

  // حساب الإجمالي الفرعي والصافي للسلة النشطة مرة واحدة
  const cartSubtotal = useMemo(
    () => store.cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0),
    [store.cart],
  );

  const cartNetTotal = useMemo(
    () => cartSubtotal - (cartSubtotal * store.discountPercent) / 100,
    [cartSubtotal, store.discountPercent],
  );

  // حساب عدد النواقص تحت حد الطلب لعرضها على زر دفتر النواقص
  const shortagesCount = useMemo(
    () => store.products.filter((p) => p.stockPacks <= p.minLimit).length,
    [store.products],
  );

  const handleToggleSound = useCallback(() => {
    const nextEnabled = SoundFeedbackService.toggle();
    setSoundEnabled(nextEnabled);
    store.setNotification({
      type: "info",
      message: nextEnabled
        ? "تم تفعيل النغمات الصوتية لنقطة البيع."
        : "تم كتم النغمات الصوتية لنقطة البيع.",
    });
  }, [store]);

  const handleSearchEnter = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
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
      {/* شريط الأدوات العلوي لنقطة البيع: حالة الليزر + الصوت + سجل الفواتير + دفتر النواقص */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-1.5 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="bg-emerald-950 border border-emerald-800 text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
            <Barcode className="w-3.5 h-3.5" /> قارئ الليزر التلقائي نشط
          </span>

          {/* زر كتم أو تفعيل النغمات الصوتية لنقطة البيع */}
          <button
            type="button"
            onClick={handleToggleSound}
            title={
              soundEnabled
                ? "إيقاف النغمات الصوتية (البيع والشريط والتحذير)"
                : "تفعيل النغمات الصوتية لنقطة البيع"
            }
            className={`px-2 py-0.5 rounded-full border flex items-center gap-1 font-bold transition ${
              soundEnabled
                ? "bg-sky-950/80 hover:bg-sky-900 border-sky-800 text-sky-300"
                : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400"
            }`}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5" /> الصوت مفعل
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-rose-400" /> الصوت مكتوم
              </>
            )}
          </button>

          <span className="text-slate-400">
            ({store.settings.pharmacyName} — الطابعة:{" "}
            <b className="font-mono text-slate-300">
              {store.settings.thermalPrinterName}
            </b>
            )
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* زر سجل الفواتير السابقة وإعادة الطباعة */}
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition"
          >
            <FileText className="w-3.5 h-3.5 text-sky-400" />
            سجل الفواتير ({store.invoices.length})
          </button>

          {/* زر دفتر النواقص الذكي وتوليد طلبية المستودع */}
          <button
            onClick={() => setIsShortagesOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition"
          >
            <ClipboardList className="w-3.5 h-3.5 text-amber-400" />
            دفتر النواقص والطلبيات
            {shortagesCount > 0 && (
              <span className="bg-rose-600 text-white font-mono text-[10px] px-1.5 rounded-full">
                {shortagesCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* شريط التحذير الطبي الوامض (تداخل دوائي) */}
      {store.interactionAlerts.length > 0 && (
        <InteractionAlertBar alerts={store.interactionAlerts} />
      )}

      {/* شريط تبويبات الزبائن والفواتير المعلقة (Alt+1 .. Alt+9) */}
      <HeldInvoicesBar
        heldInvoices={store.heldInvoices}
        onResume={(id) => store.resumeInvoice(id)}
        activeCustomerName={store.customerName}
        activeCartCount={store.cart.length}
        activeCartTotal={cartNetTotal}
        onHoldCurrent={() => store.holdCurrentInvoice()}
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

      {/* نافذة توثيق الوصفة للأدوية المراقبة */}
      <ControlledDrugModal
        pendingItem={store.pendingControlledItem}
        onClose={() => store.setPendingControlledItem(null)}
        onConfirm={(product, unit, meta) =>
          store.addToCart(product, unit, meta)
        }
      />

      {/* نافذة البدائل العلمية (F4) */}
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

      {/* نافذة سجل الفواتير السابقة وإعادة الطباعة */}
      <InvoicesHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* نافذة دفتر النواقص الذكي وتوليد طلبية المستودع */}
      <ShortagesOrderModal
        isOpen={isShortagesOpen}
        onClose={() => setIsShortagesOpen(false)}
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
