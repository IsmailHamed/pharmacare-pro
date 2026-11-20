import React, { useEffect, useMemo, useRef, useState } from "react";
import { CartItemEntity, ProductEntity } from "../../domain/entities";
import { InvoiceEntity } from "../../domain/entities/Invoice";
import { usePosStore } from "../../application/store/usePosStore";
import {
  buildLasaRiskGroupSet,
  parseLasaDisplay,
} from "../../domain/utils/lasaFormatter";
import {
  Printer,
  ShoppingCart,
  Pause,
  Undo2,
  FileSearch,
  SearchCheck,
  Keyboard,
  AlertTriangle,
  Banknote,
  RotateCcw,
  X,
} from "lucide-react";

const CASH_DENOMINATIONS = [10, 50, 100, 200, 500] as const;

interface Props {
  cart: CartItemEntity[];
  subtotal: number;
  discountPercent: number;
  paymentMode: "CASH" | "CREDIT";
  customerName: string;
  invoiceMode: "SALE" | "RETURN";
  heldCount: number;
  returnSourceInvoiceId?: string | null;
  recentSaleInvoices?: InvoiceEntity[];
  isShortcutsPaused?: boolean;
  onLoadInvoiceForReturn?: (invoiceId: string) => boolean;
  onSetDiscount: (percent: number) => void;
  onSetPaymentMode: (mode: "CASH" | "CREDIT") => void;
  onSetCustomerName: (name: string) => void;
  updateQty: (key: string, delta: number) => void;
  onToggleUnit: (key: string) => void;
  removeFromCart: (key: string) => void;
  onCheckout: () => void;
  onToggleReturn: () => void;
  onHold: () => void;
}

export const CartView: React.FC<Props> = ({
  cart,
  subtotal,
  discountPercent,
  paymentMode,
  customerName,
  invoiceMode,
  heldCount,
  returnSourceInvoiceId,
  recentSaleInvoices = [],
  isShortcutsPaused = false,
  onLoadInvoiceForReturn,
  onSetDiscount,
  onSetPaymentMode,
  onSetCustomerName,
  updateQty,
  onToggleUnit,
  removeFromCart,
  onCheckout,
  onToggleReturn,
  onHold,
}) => {
  const [lookupId, setLookupId] = useState("");
  const [cashTenderedInput, setCashTenderedInput] = useState("");
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [isShortcutsHintOpen, setIsShortcutsHintOpen] = useState(false);

  const calcContainerRef = useRef<HTMLDivElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);
  const shortcutsRef = useRef<HTMLDivElement>(null);

  // التحقق من صلاحية المستخدم الحالي لإجراء مرتجعات المبيعات (القيمة الافتراضية الآمنة: false)
  const canProcessReturn = usePosStore(
    (s) => s.currentUser?.permissions.canProcessReturn ?? false,
  );

  // اكتشاف وجود أكثر من صنف مختلف بنفس الاسم الأساسي (LASA) داخل نفس السلة (مع استثناء نفس الصنف كعلبة وشريط)
  const cartLasaRiskGroups = useMemo(() => {
    const uniqueById = new Map<string, ProductEntity>();
    for (const item of cart) {
      if (!uniqueById.has(item.product.id)) {
        uniqueById.set(item.product.id, item.product);
      }
    }
    return buildLasaRiskGroupSet(Array.from(uniqueById.values()));
  }, [cart]);

  const discountAmount = Number(
    ((subtotal * discountPercent) / 100).toFixed(2),
  );
  const total = Number(Math.max(0, subtotal - discountAmount).toFixed(2));

  const showCashCalculator =
    paymentMode === "CASH" &&
    invoiceMode === "SALE" &&
    cart.length > 0 &&
    total > 0;

  // تصفير وإغلاق حاسبة الباقي تلقائياً عند إفراغ السلة أو التبديل لوضع آجل/مرتجع
  useEffect(() => {
    if (!showCashCalculator) {
      setCashTenderedInput("");
      setIsCalcOpen(false);
    }
  }, [showCashCalculator]);

  // اختصار F8 لفتح/إغلاق الحاسبة العائمة و Esc لإغلاقها
  useEffect(() => {
    const handleCalcKeyDown = (e: KeyboardEvent) => {
      if (isShortcutsPaused) return;

      if (
        e.key === "F8" &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        !e.shiftKey
      ) {
        if (!showCashCalculator) return;
        e.preventDefault();
        setIsCalcOpen((prev) => !prev);
        return;
      }

      if (e.key === "Escape") {
        if (isCalcOpen) {
          e.preventDefault();
          setIsCalcOpen(false);
        } else if (isShortcutsHintOpen) {
          e.preventDefault();
          setIsShortcutsHintOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleCalcKeyDown);
    return () => window.removeEventListener("keydown", handleCalcKeyDown);
  }, [isShortcutsPaused, showCashCalculator, isCalcOpen, isShortcutsHintOpen]);

  // تركيز تلقائي على خانة المبلغ المدفوع فور فتح الحاسبة العائمة عبر F8
  useEffect(() => {
    if (isCalcOpen) {
      const timer = window.setTimeout(() => {
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
      }, 20);
      return () => window.clearTimeout(timer);
    }
  }, [isCalcOpen]);

  // إغلاق الحاسبة العائمة أو نافذة تلميح الاختصارات عند النقر خارجها
  useEffect(() => {
    if (!isCalcOpen && !isShortcutsHintOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        isCalcOpen &&
        calcContainerRef.current &&
        !calcContainerRef.current.contains(target)
      ) {
        setIsCalcOpen(false);
      }
      if (
        isShortcutsHintOpen &&
        shortcutsRef.current &&
        !shortcutsRef.current.contains(target)
      ) {
        setIsShortcutsHintOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isCalcOpen, isShortcutsHintOpen]);

  const hasCashInput = cashTenderedInput.trim() !== "";
  const tenderedAmount = hasCashInput
    ? Math.max(0, Number(cashTenderedInput) || 0)
    : 0;
  const diffHalalas =
    Math.round(tenderedAmount * 100) - Math.round(total * 100);
  const isCashSufficient = diffHalalas >= 0;
  const changeDue = Math.max(0, diffHalalas) / 100;
  const remainingDue = Math.max(0, -diffHalalas) / 100;

  const handleAddDenomination = (noteValue: number) => {
    const current = Math.max(0, Number(cashTenderedInput) || 0);
    const next = Number((current + noteValue).toFixed(2));
    setCashTenderedInput(String(next));
  };

  const handleExactCash = () => {
    setCashTenderedInput(total.toFixed(2));
  };

  // منع تفعيل وضع المرتجع لغير المخولين، مع السماح دائماً بالعودة من وضع المرتجع إلى وضع البيع
  const isReturnToggleDisabled = !canProcessReturn && invoiceMode === "SALE";
  // منع اعتماد الفاتورة إذا كان النظام في وضع المرتجع وتم تبديل المستخدم لحساب غير مخول
  const isReturnCheckoutBlocked = invoiceMode === "RETURN" && !canProcessReturn;

  const handleInvoiceLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProcessReturn || !lookupId.trim() || !onLoadInvoiceForReturn) {
      return;
    }
    const ok = onLoadInvoiceForReturn(lookupId);
    if (ok) setLookupId("");
  };

  return (
    <div className="w-5/12 p-3 flex flex-col bg-slate-900/20">
      {/* شريط استرداد الفاتورة الأصلية بالرقم أو الباركود — يظهر فقط لمن يملك صلاحية المرتجع */}
      {canProcessReturn &&
        invoiceMode === "RETURN" &&
        onLoadInvoiceForReturn && (
          <div className="mb-2 p-2.5 bg-amber-950/30 border border-amber-800/70 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <FileSearch className="w-3.5 h-3.5" /> استرداد فاتورة مبيعات
                للمرتجع
              </span>
              {returnSourceInvoiceId && (
                <span className="bg-amber-900/60 border border-amber-600 text-amber-200 text-[10px] font-mono px-2 py-0.5 rounded-full">
                  مرجع: {returnSourceInvoiceId}
                </span>
              )}
            </div>

            <form onSubmit={handleInvoiceLookup} className="flex gap-1.5">
              <input
                type="text"
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
                placeholder="امسح باركود الفاتورة أو اكتب رقمها (INV-...)"
                className="flex-1 bg-slate-900 border border-amber-800/80 rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
              >
                <SearchCheck className="w-3.5 h-3.5" /> جلب
              </button>
            </form>

            {recentSaleInvoices.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                <span className="text-[10px] text-amber-300/80 shrink-0">
                  آخر الفواتير:
                </span>
                {recentSaleInvoices.slice(0, 6).map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => onLoadInvoiceForReturn(inv.id)}
                    className="text-[10px] font-mono bg-slate-900 hover:bg-amber-900/50 border border-slate-700 text-slate-200 px-2 py-0.5 rounded shrink-0 transition"
                  >
                    {inv.id} ({inv.totalAmount.toFixed(0)})
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

      {/* تنبيه في حال تبديل المستخدم لحساب غير مخول أثناء وجود فاتورة مرتجع مفتوحة */}
      {isReturnCheckoutBlocked && (
        <div className="mb-2 p-2.5 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-xs font-bold flex items-center justify-between gap-2">
          <span>
            المستخدم الحالي لا يملك صلاحية اعتماد المرتجع. أعد الوضع إلى البيع
            أو بدّل المستخدم.
          </span>
          <button
            type="button"
            onClick={onToggleReturn}
            className="bg-rose-800 hover:bg-rose-700 text-white px-2.5 py-1 rounded-lg shrink-0"
          >
            عودة للبيع
          </button>
        </div>
      )}

      {/* قائمة السلة (بأقصى ارتفاع متاح بعد تحويل الاختصارات والحاسبة إلى نوافذ عائمة) */}
      <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl bg-slate-900/60 p-2.5 space-y-2 no-scrollbar">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs text-center px-4">
            <ShoppingCart className="w-8 h-8 mb-2 stroke-1" />
            <p>السلة فارغة — ابدأ بإضافة الأدوية أو امسح الباركود بالليزر</p>
          </div>
        ) : (
          cart.map((item, idx) => {
            const isActiveForKeyboard = idx === 0;
            const canSplitToStrips = item.product.stripsPerPack > 1;
            const lasa = parseLasaDisplay(
              item.product.name,
              item.product.category,
            );
            const isLasaRisk =
              lasa.lasaGroupKey.length >= 3 &&
              cartLasaRiskGroups.has(lasa.lasaGroupKey);

            return (
              <div
                key={item.cartKey}
                className={`rounded-lg p-2.5 flex items-center justify-between gap-2 text-xs transition ${
                  isActiveForKeyboard
                    ? "bg-slate-800 border-2 border-sky-500/70 shadow-[0_0_12px_rgba(14,165,233,0.12)]"
                    : isLasaRisk
                      ? "bg-amber-950/20 border border-amber-600/70"
                      : "bg-slate-800/80 border border-slate-700/70"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12.5px] tracking-tight">
                      {lasa.baseName}
                    </span>

                    {/* شارات العيار الدوائي البارزة (LASA) */}
                    {lasa.strengths.map((strength) => (
                      <span
                        key={strength.text}
                        dir="ltr"
                        className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[11px] font-black font-mono tracking-wide ${strength.badgeClass}`}
                      >
                        {strength.text}
                      </span>
                    ))}

                    {/* الصفات الفارقة الحرجة (XR / Forte / Extra / أطفال...) */}
                    {lasa.modifiers.map((mod) => (
                      <span
                        key={mod}
                        className="inline-flex items-center px-1.5 py-0.2 rounded border bg-yellow-500/15 text-yellow-200 border-yellow-400/70 text-[10px] font-extrabold"
                      >
                        {mod}
                      </span>
                    ))}

                    {/* الشكل الصيدلاني */}
                    {lasa.dosageForm && (
                      <span
                        className={`inline-flex items-center px-1.5 py-0.2 rounded border text-[10px] ${lasa.dosageForm.badgeClass}`}
                      >
                        {lasa.dosageForm.label}
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={!canSplitToStrips}
                      onClick={() => onToggleUnit(item.cartKey)}
                      title={
                        canSplitToStrips
                          ? "اضغط أو استخدم زر Tab للتبديل بين علبة وشريط"
                          : "هذا الصنف يُباع كعلبة كاملة فقط"
                      }
                      className={`text-[10px] px-1.5 py-0.5 rounded transition ${
                        item.unit === "pack"
                          ? "bg-blue-950 text-blue-300 border border-blue-800/70"
                          : "bg-indigo-950 text-indigo-300 border border-indigo-700/80"
                      } ${
                        canSplitToStrips
                          ? "hover:brightness-125 cursor-pointer"
                          : "cursor-default"
                      }`}
                    >
                      {item.unit === "pack" ? "علبة" : "شريط"}
                    </button>

                    {item.isControlled && (
                      <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800 px-1.5 rounded">
                        🔒 موثق
                      </span>
                    )}

                    {isLasaRisk && (
                      <span
                        title="تحذير LASA: يوجد عياران أو شكلان متشابهان لنفس الدواء في هذه السلة"
                        className="inline-flex items-center gap-0.5 bg-amber-950 text-amber-300 border border-amber-600/80 text-[9px] font-extrabold px-1.5 py-0.2 rounded"
                      >
                        <AlertTriangle className="w-2.5 h-2.5" />
                        LASA
                      </span>
                    )}

                    {isActiveForKeyboard && (
                      <span className="text-[9px] bg-sky-950 text-sky-300 border border-sky-700/80 px-1.5 py-0.2 rounded-full">
                        نشط
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {item.unitPrice.toFixed(2)} للوحدة
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center bg-slate-900 border border-slate-700 rounded">
                    <button
                      type="button"
                      onClick={() => updateQty(item.cartKey, -1)}
                      className="px-2 py-0.5 hover:bg-slate-800"
                    >
                      −
                    </button>
                    <span className="px-2.5 font-mono font-bold">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.cartKey, 1)}
                      className="px-2 py-0.5 hover:bg-slate-800"
                    >
                      +
                    </button>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 w-16 text-left">
                    {(item.unitPrice * item.qty).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.cartKey)}
                    className="text-slate-500 hover:text-rose-400 px-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* منطقة الدفع السريع المدمجة + الحاسبة العائمة (Popover) */}
      <div
        ref={calcContainerRef}
        className="relative mt-2.5 bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2 text-xs"
      >
        {/* الطبقة العائمة لحاسبة الفئات النقدية والباقي (تفتح فوق السلة عبر F8 دون تقليصها) */}
        {showCashCalculator && isCalcOpen && (
          <div className="absolute bottom-full left-0 right-0 mb-2 z-30 bg-slate-900 border-2 border-emerald-600/80 rounded-xl p-3 shadow-2xl space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
                <Banknote className="w-4 h-4" />
                حاسبة الفئات النقدية والباقي
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-400">
                  الصافي: <b className="text-emerald-300">{total.toFixed(2)}</b>
                </span>
                <button
                  type="button"
                  onClick={() => setIsCalcOpen(false)}
                  title="إغلاق (Esc أو F8)"
                  className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1 rounded-md transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-300 shrink-0">
                المدفوع نقداً:
              </span>
              <div className="flex items-center gap-1.5 flex-1 justify-end">
                <input
                  ref={cashInputRef}
                  type="number"
                  min={0}
                  step="any"
                  value={cashTenderedInput}
                  onChange={(e) => setCashTenderedInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setIsCalcOpen(false);
                    }
                  }}
                  placeholder="0.00"
                  dir="ltr"
                  className="w-32 bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-left font-mono font-bold text-sm text-white outline-none"
                />
                {hasCashInput && (
                  <button
                    type="button"
                    onClick={() => setCashTenderedInput("")}
                    title="تصفير المبلغ المدفوع"
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white p-1.5 rounded-lg transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* أزرار الفئات النقدية السريعة */}
            <div className="grid grid-cols-6 gap-1.5">
              <button
                type="button"
                onClick={handleExactCash}
                title="تعيين المبلغ المستلم مطابقاً للصافي تماماً"
                className="py-1.5 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-800/80 text-sky-300 font-bold text-[10.5px] transition"
              >
                تماماً
              </button>
              {CASH_DENOMINATIONS.map((note) => (
                <button
                  key={note}
                  type="button"
                  onClick={() => handleAddDenomination(note)}
                  title={`إضافة ورقة فئة ${note} ر.س للمبلغ المستلم`}
                  className="py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-950 hover:border-emerald-700 border border-slate-700 text-slate-200 hover:text-emerald-300 font-mono font-bold text-xs transition"
                >
                  +{note}
                </button>
              ))}
            </div>

            {/* شاشة عرض الباقي للزبون بخط ضخم */}
            {hasCashInput && (
              <div
                className={`rounded-lg px-3 py-2 border flex items-center justify-between ${
                  isCashSufficient
                    ? "bg-emerald-950/60 border-emerald-600/80"
                    : "bg-amber-950/50 border-amber-600/80"
                }`}
              >
                <span
                  className={`font-bold text-xs ${
                    isCashSufficient ? "text-emerald-200" : "text-amber-200"
                  }`}
                >
                  {isCashSufficient ? "الباقي للزبون:" : "المتبقي على الزبون:"}
                </span>
                <span
                  dir="ltr"
                  className={`font-mono font-black tracking-tight ${
                    isCashSufficient
                      ? "text-2xl text-emerald-300"
                      : "text-lg text-amber-300"
                  }`}
                >
                  {(isCashSufficient ? changeDue : remainingDue).toFixed(2)} ر.س
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-0.5">
              <span>Enter إغلاق • Esc إلغاء</span>
              <span>F1 إتمام البيع والطباعة</span>
            </div>
          </div>
        )}

        {/* السطر الأول: العميل + زر المرتجع + أيقونة تلميح اختصارات الكيبورد */}
        <div className="flex gap-1.5 items-center">
          <input
            type="text"
            value={customerName}
            onChange={(e) => onSetCustomerName(e.target.value)}
            placeholder="اسم العميل (اختياري)"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={onToggleReturn}
            disabled={isReturnToggleDisabled}
            title={
              isReturnToggleDisabled
                ? "لا تملك صلاحية إجراء مرتجعات المبيعات"
                : "تبديل وضع المرتجع (F6)"
            }
            className={`px-2.5 py-1.5 rounded-lg font-bold border transition disabled:opacity-40 disabled:cursor-not-allowed ${
              invoiceMode === "RETURN"
                ? "bg-amber-950 text-amber-300 border-amber-700 animate-pulse"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
            }`}
          >
            <Undo2 className="w-3.5 h-3.5 inline ml-1" />
            {invoiceMode === "RETURN" ? "مرتجع" : "بيع"}
          </button>

          {/* أيقونة اختصارات لوحة المفاتيح المدمجة (بدلاً من الشريط الأفقي فوق السلة) */}
          <div ref={shortcutsRef} className="relative">
            <button
              type="button"
              onClick={() => setIsShortcutsHintOpen((prev) => !prev)}
              title="اختصارات لوحة المفاتيح السريعة (+ / - / Tab / Del / F8)"
              className={`p-1.5 rounded-lg border transition ${
                isShortcutsHintOpen
                  ? "bg-sky-950 border-sky-600 text-sky-300"
                  : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-sky-400"
              }`}
            >
              <Keyboard className="w-4 h-4" />
            </button>

            {isShortcutsHintOpen && (
              <div className="absolute bottom-full left-0 mb-2 z-30 w-60 bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl space-y-1.5 text-[11px]">
                <div className="font-bold text-sky-300 border-b border-slate-800 pb-1.5 flex items-center justify-between">
                  <span>اختصارات «صفر ماوس»</span>
                  <button
                    type="button"
                    onClick={() => setIsShortcutsHintOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>زيادة / إنقاص كمية آخر صنف</span>
                  <span className="font-mono text-sky-300">+ / -</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>تبديل علبة / شريط فرط</span>
                  <kbd className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                    Tab
                  </kbd>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>حذف آخر صنف مضاف</span>
                  <kbd className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                    Del
                  </kbd>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>حاسبة الباقي العائمة</span>
                  <kbd className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
                    F8
                  </kbd>
                </div>
                <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-800 text-[10px] font-mono">
                  <span>F1 بيع</span>
                  <span>F4 بدائل</span>
                  <span>F5 تعليق</span>
                  <span>F6 مرتجع</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* السطر الثاني: طريقة الدفع + الخصم */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSetPaymentMode("CASH")}
            className={`flex-1 py-1.5 rounded-lg font-bold transition ${
              paymentMode === "CASH"
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            نقدي
          </button>
          <button
            type="button"
            onClick={() => onSetPaymentMode("CREDIT")}
            className={`flex-1 py-1.5 rounded-lg font-bold transition ${
              paymentMode === "CREDIT"
                ? "bg-amber-600 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            آجل (ذمم)
          </button>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={100}
              value={discountPercent}
              onChange={(e) => onSetDiscount(Number(e.target.value) || 0)}
              className="w-14 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-white font-mono outline-none"
              title="خصم %"
            />
            <span className="text-slate-500">%خصم</span>
          </div>
        </div>

        {/* تفاصيل الفرعي والخصم عند الحاجة فقط لتوفير المساحة */}
        {discountPercent > 0 && (
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>
              الفرعي: <b className="font-mono">{subtotal.toFixed(2)}</b>
            </span>
            <span className="text-rose-400">
              الخصم ({discountPercent}%):{" "}
              <b className="font-mono">-{discountAmount.toFixed(2)}</b>
            </span>
          </div>
        )}

        {/* سطر الصافي المطلوب + زر تشغيل الحاسبة العائمة [F8] */}
        <div className="flex justify-between items-center gap-2 pt-1.5 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">الصافي:</span>
            <span className="text-lg font-extrabold font-mono text-emerald-400">
              {total.toFixed(2)} ر.س
            </span>
          </div>

          {showCashCalculator && (
            <button
              type="button"
              onClick={() => setIsCalcOpen((prev) => !prev)}
              title="فتح/إغلاق حاسبة الفئات النقدية والباقي (F8)"
              className={`px-2.5 py-1 rounded-lg border font-bold text-[11px] flex items-center gap-1.5 transition ${
                isCalcOpen
                  ? "bg-emerald-700 border-emerald-400 text-white shadow"
                  : hasCashInput
                    ? isCashSufficient
                      ? "bg-emerald-950/70 hover:bg-emerald-900/70 border-emerald-600/80 text-emerald-300"
                      : "bg-amber-950/60 hover:bg-amber-900/60 border-amber-600/80 text-amber-300"
                    : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
              }`}
            >
              <Banknote className="w-3.5 h-3.5" />
              {hasCashInput ? (
                <span className="font-mono">
                  {isCashSufficient ? "الباقي" : "المتبقي"}:{" "}
                  {(isCashSufficient ? changeDue : remainingDue).toFixed(2)}
                </span>
              ) : (
                <span>حاسبة الباقي</span>
              )}
              <kbd className="bg-slate-950/70 border border-current/25 px-1 rounded text-[9.5px] font-mono">
                F8
              </kbd>
            </button>
          )}
        </div>

        {/* أزرار التنفيذ السريع */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onHold}
            title="تعليق الفاتورة (F5)"
            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg font-bold flex items-center gap-1.5"
          >
            <Pause className="w-4 h-4" />
            {heldCount > 0 ? `(${heldCount})` : ""}
          </button>
          <button
            type="button"
            onClick={onCheckout}
            disabled={isReturnCheckoutBlocked}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 shadow"
          >
            <Printer className="w-4 h-4" />
            {invoiceMode === "RETURN"
              ? "تسجيل المرتجع وطباعة"
              : "بيع وطباعة"}{" "}
            [F1]
          </button>
        </div>
      </div>
    </div>
  );
};
