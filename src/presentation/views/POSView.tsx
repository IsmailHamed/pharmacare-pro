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
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import {
  ProductEntity,
  DrugInteractionAlert,
  UserRole,
} from "../../domain/entities";
import {
  AlertTriangle,
  Inbox,
  Lock,
  UserCheck,
  ArrowRightLeft,
  PlayCircle,
} from "lucide-react";

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "مدير النظام",
  PHARMACIST: "صيدلي",
  CASHIER: "كاشير",
};

/**
 * شاشة نقطة البيع الموحدة (POS)
 * طبقة Presentation خالصة: تعرض الحالة وتستدعي إجراءات الـ Store فقط.
 */
export const POSView: React.FC = () => {
  const store = usePosStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [quickOpeningCash, setQuickOpeningCash] = useState<string>("500");
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastScannerCharAtRef = useRef<number>(0);

  const openShift = useMemo(
    () => store.shifts.find((s) => s.status === "OPEN"),
    [store.shifts],
  );
  const lastClosedShift = useMemo(
    () => store.shifts.find((s) => s.status === "CLOSED"),
    [store.shifts],
  );

  const isShiftLocked = !openShift;

  // تهيئة العهدة الافتتاحية تلقائياً من العهدة المرحلة لآخر وردية مغلقة
  useEffect(() => {
    if (isShiftLocked) {
      const carriedFloat = lastClosedShift?.nextShiftFloat ?? 500;
      setQuickOpeningCash(String(carriedFloat));
    }
  }, [isShiftLocked, lastClosedShift]);

  // اكتشاف ما إذا كان المستخدم النشط (PIN) يختلف عن صاحب عهدة الدرج المفتوحة
  const isDifferentShiftOwner = Boolean(
    openShift &&
    store.currentUser &&
    ((openShift.openedByUserId &&
      openShift.openedByUserId !== store.currentUser.id) ||
      (!openShift.openedByUserId &&
        openShift.pharmacistName.trim() !== store.currentUser.name.trim())),
  );

  // إيقاف لقط الباركود التلقائي والاختصارات عند إغلاق الوردية أو فتح أي نافذة منبثقة فرعية
  const isAnyModalOpen =
    isShiftLocked ||
    isHistoryOpen ||
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

      // لا نتدخل إذا كان المستخدم يكتب داخل حقل آخر (مثل اسم العميل أو نسبة الخصم أو حاسبة الباقي)
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

  const handleQuickOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOpeningShift) return;

    const amount = Number(quickOpeningCash);
    if (!Number.isFinite(amount) || amount < 0) return;

    const activeUserName = store.currentUser?.name?.trim() || "د. صيدلي مناوب";
    setIsOpeningShift(true);
    try {
      await store.openNewShift(activeUserName, amount);
      window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
    } finally {
      setIsOpeningShift(false);
    }
  };

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

  const activeUserName = store.currentUser?.name?.trim() || "د. صيدلي مناوب";

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      {/* شريط تنبيه رفيع عند اختلاف المستخدم النشط (PIN) عن صاحب عهدة الوردية المفتوحة */}
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

      {/* شريط التحذير الطبي الوامض (تداخل دوائي) */}
      {store.interactionAlerts.length > 0 && (
        <InteractionAlertBar alerts={store.interactionAlerts} />
      )}

      {/* شريط تبويبات الزبائن والفواتير المعلقة (Alt+1..9) + زر سجل الفواتير المدمج */}
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

      {/* طبقة قفل نقطة البيع وفتح الوردية السريع عند إغلاق الوردية (تبقي الشريط العلوي وتبديل PIN متاحين) */}
      {isShiftLocked && (
        <div className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 text-xs">
          <form
            onSubmit={(e) => void handleQuickOpenShift(e)}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-950/70 border border-amber-700/80 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">
                  الوردية مغلقة — افتح وردية لبدء البيع
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  لضمان مطابقة الدرج وتقرير Z-Report، لا يمكن إصدار فواتير قبل
                  استلام العهدة.
                </p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-400">
                    صاحب العهدة (المستخدم النشط حالياً)
                  </div>
                  <div className="font-bold text-white truncate">
                    {activeUserName}
                  </div>
                </div>
              </div>
              {store.currentUser && (
                <span className="text-[10px] font-bold bg-slate-800 border border-slate-700 text-sky-300 px-2 py-0.5 rounded-full shrink-0">
                  {ROLE_LABELS[store.currentUser.role]}
                </span>
              )}
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                الرصيد الافتتاحي للدرج (العهدة المستلمة)
              </label>
              <input
                type="number"
                step="any"
                min={0}
                required
                autoFocus
                value={quickOpeningCash}
                onChange={(e) => setQuickOpeningCash(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-xl p-2.5 text-white font-mono font-bold text-sm outline-none"
              />
              {lastClosedShift && (
                <p className="text-[10.5px] text-slate-400 mt-1 font-mono">
                  العهدة المرحلة من آخر وردية ({lastClosedShift.id}):{" "}
                  <b className="text-emerald-400">
                    {(lastClosedShift.nextShiftFloat ?? 0).toFixed(2)} ر.س
                  </b>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={
                isOpeningShift ||
                quickOpeningCash === "" ||
                Number(quickOpeningCash) < 0
              }
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition"
            >
              <PlayCircle className="w-4 h-4" />
              {isOpeningShift
                ? "جارٍ فتح الوردية..."
                : "فتح الوردية واستلام العهدة وبدء البيع"}
            </button>

            <p className="text-[10.5px] text-slate-500 text-center">
              إذا كنت موظفاً آخر، يمكنك تبديل الحساب عبر رمز PIN من الشريط
              العلوي قبل استلام العهدة.
            </p>
          </form>
        </div>
      )}

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
