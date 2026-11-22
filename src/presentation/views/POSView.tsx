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
import { PosDropdownSearchBar } from "../components/pos/PosDropdownSearchBar";
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
import {
  AlertTriangle,
  Inbox,
  ArrowRightLeft,
  Columns2,
  PanelTop,
} from "lucide-react";

// أوضاع عرض نقطة البيع: الوضع المقسوم الكلاسيكي (جدول + سلة) أو وضع البحث المنسدل (سلة موسّعة)
type PosLayoutMode = "split" | "dropdown";
const POS_LAYOUT_STORAGE_KEY = "pharmacare_pos_layout_mode";

// قراءة تفضيل وضع العرض المحفوظ محلياً للجهاز مع الرجوع الآمن للوضع المقسوم عند أول تشغيل
const loadSavedPosLayoutMode = (): PosLayoutMode => {
  try {
    const saved = window.localStorage.getItem(POS_LAYOUT_STORAGE_KEY);
    return saved === "dropdown" ? "dropdown" : "split";
  } catch {
    return "split";
  }
};

/**
 * شاشة نقطة البيع الموحدة (POS)
 * طبقة Presentation خالصة: تعرض الحالة وتستدعي إجراءات الـ Store فقط.
 */
export const POSView: React.FC = () => {
  const store = usePosStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // حالة وضع عرض نقطة البيع المحفوظة محلياً (مقسوم أو بحث منسدل)
  const [layoutMode, setLayoutMode] = useState<PosLayoutMode>(
    loadSavedPosLayoutMode,
  );
  // تتبّع الصنف المظلّل حالياً داخل القائمة المنسدلة لربطه باختصار البدائل العلمية (F4)
  const [highlightedDropdownProduct, setHighlightedDropdownProduct] =
    useState<ProductEntity | null>(null);

  // التبديل بين وضعي العرض وحفظ التفضيل في localStorage مع إعادة التركيز تلقائياً لخانة البحث
  const handleToggleLayoutMode = useCallback(() => {
    setLayoutMode((prev) => {
      const next: PosLayoutMode = prev === "split" ? "dropdown" : "split";
      try {
        window.localStorage.setItem(POS_LAYOUT_STORAGE_KEY, next);
      } catch {
        // تجاهل خطأ التخزين في حال كان الوصول إلى localStorage مقيّداً
      }
      return next;
    });
    setHighlightedDropdownProduct(null);
    window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 40);
  }, []);

  // التحقق من حالة الوردية المفتوحة وآخر وردية مغلقة لحساب العهدة المرحلة
  const openShift = useMemo(
    () => store.shifts.find((s) => s.status === "OPEN"),
    [store.shifts],
  );
  const lastClosedShift = useMemo(
    () => store.shifts.find((s) => s.status === "CLOSED"),
    [store.shifts],
  );

  const isShiftLocked = !openShift;

  // اكتشاف ما إذا كان المستخدم النشط يختلف عن صاحب عهدة الدرج المفتوحة حالياً
  const isDifferentShiftOwner = Boolean(
    openShift &&
    store.currentUser &&
    ((openShift.openedByUserId &&
      openShift.openedByUserId !== store.currentUser.id) ||
      (!openShift.openedByUserId &&
        openShift.pharmacistName.trim() !== store.currentUser.name.trim())),
  );

  // تعطيل قارئ الباركود واختصارات لوحة المفاتيح عند فتح أي نافذة منبثقة أو عند قفل الوردية
  const isAnyModalOpen =
    isShiftLocked ||
    isHistoryOpen ||
    Boolean(store.pendingControlledItem) ||
    Boolean(store.selectedProductForAlternatives) ||
    Boolean(store.lastPrintedInvoice);

  // ربط قارئ الباركود الليزري وتنظيف حقل البحث بعد كل مسح ناجح
  useBarcodeScanner(!isAnyModalOpen, () => setSearchQuery(""));

  // اختصارات «صفر ماوس» (+ / - / Tab / Delete) للتحكم السريع بآخر صنف مضاف للسلة
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

  // اختصارات التبديل السريع بين الفواتير المعلّقة (Alt + 1 .. Alt + 9)
  useHeldInvoicesShortcuts({
    enabled: !isAnyModalOpen,
    heldInvoices: store.heldInvoices,
    onResumeInvoice: store.resumeInvoice,
  });

  // بناء فهرس البحث الضبابي والصوتي مرة واحدة عند تغيّر قائمة الأدوية
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

  // معالج الضغط على Enter داخل خانة البحث (مسح مباشر للباركود/الفاتورة أو إدراج أول مطابقة)
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

  // اختصارات الوظائف الأساسية لنقطة البيع (F1 إتمام البيع، F2 البحث، F4 البدائل، F5 تعليق، F6 مرتجع)
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
      // أولوية لآخر صنف في السلة، ثم الصنف المظلّل في القائمة المنسدلة، ثم أول نتيجة بحث
      const target =
        store.cart[0]?.product ||
        highlightedDropdownProduct ||
        filteredProducts[0] ||
        null;
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

  // زر تبديل وضع العرض المدمج بمحاذاة خانة البحث في كلا الوضعين دون استهلاك ارتفاع إضافي
  const layoutToggleButton = (
    <button
      type="button"
      onClick={handleToggleLayoutMode}
      title={
        layoutMode === "split"
          ? "التبديل إلى وضع البحث المنسدل (إخفاء الجدول وتوسيع السلة على كامل الشاشة)"
          : "العودة إلى الوضع الكلاسيكي المقسوم (جدول الأدوية + السلة)"
      }
      className="shrink-0 h-[42px] px-3 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 hover:border-blue-500/70 text-slate-200 hover:text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
    >
      {layoutMode === "split" ? (
        <>
          <PanelTop className="w-4 h-4 text-sky-400" />
          <span className="hidden xl:inline">بحث منسدل</span>
        </>
      ) : (
        <>
          <Columns2 className="w-4 h-4 text-sky-400" />
          <span className="hidden xl:inline">عرض مقسوم</span>
        </>
      )}
    </button>
  );

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      {/* شريط تنبيه عند اختلاف المستخدم النشط عن صاحب عهدة الوردية المفتوحة */}
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

      {/* شريط تحذيرات التداخلات الدوائية الحرجة بين أصناف السلة */}
      {store.interactionAlerts.length > 0 && (
        <InteractionAlertBar alerts={store.interactionAlerts} />
      )}

      {/* شريط الفواتير المعلّقة وسجل الفواتير السريع */}
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

      {/* تبديل التخطيط بين الوضع الكلاسيكي المقسوم (جدول + سلة) ووضع البحث المنسدل (سلة موسّعة) */}
      {layoutMode === "split" ? (
        <div className="flex-1 flex overflow-hidden">
          <ProductCatalog
            ref={searchInputRef}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearchEnter={handleSearchEnter}
            products={filteredProducts}
            onAddToCart={handleAddToCart}
            onShowAlternatives={(p) =>
              store.setSelectedProductForAlternatives(p)
            }
            invoiceMode={store.invoiceMode}
            layoutToggle={layoutToggleButton}
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
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <PosDropdownSearchBar
            ref={searchInputRef}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onDirectSearchEnter={handleSearchEnter}
            products={filteredProducts}
            allProducts={store.products}
            onAddToCart={handleAddToCart}
            onShowAlternatives={(p) =>
              store.setSelectedProductForAlternatives(p)
            }
            onHighlightedProductChange={setHighlightedDropdownProduct}
            invoiceMode={store.invoiceMode}
            layoutToggle={layoutToggleButton}
          />

          <CartView
            isExpanded
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
      )}

      {/* طبقة قفل نقطة البيع عند عدم وجود وردية مفتوحة */}
      {isShiftLocked && (
        <ShiftLockOverlay
          currentUser={store.currentUser}
          lastClosedShift={lastClosedShift}
          onOpenShift={store.openNewShift}
          onShiftOpenedFocus={() => searchInputRef.current?.focus()}
        />
      )}

      {/* نافذة توثيق صرف الأدوية المراقبة */}
      <ControlledDrugModal
        pendingItem={store.pendingControlledItem}
        onClose={() => store.setPendingControlledItem(null)}
        onConfirm={(product, unit, meta) =>
          store.addToCart(product, unit, meta)
        }
      />

      {/* نافذة البدائل العلمية المتوفرة (F4) */}
      <AlternativesModal
        targetProduct={store.selectedProductForAlternatives}
        alternatives={alternatives}
        onClose={() => store.setSelectedProductForAlternatives(null)}
        onSelectAlternative={(product, unit) => {
          store.requestAddToCart(product, unit);
          store.setSelectedProductForAlternatives(null);
        }}
      />

      {/* نافذة معاينة وطباعة الإيصال الحراري */}
      <ThermalReceiptModal
        invoice={store.lastPrintedInvoice}
        onClose={() => store.setLastPrintedInvoice(null)}
      />

      {/* نافذة سجل فواتير المبيعات والمرتجعات */}
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
