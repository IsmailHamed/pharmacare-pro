import React, { useEffect, useMemo, useRef, useState } from "react";
import { CartItemEntity, ProductEntity } from "../../../domain/entities";
import { InvoiceEntity } from "../../../domain/entities/Invoice";
import { usePosStore } from "../../../application/store/usePosStore";
import { buildLasaRiskGroupSet } from "../../../domain/utils/lasaFormatter";
import { ReturnInvoiceLookupBar } from "./cart/ReturnInvoiceLookupBar";
import { CartItemRow } from "./cart/CartItemRow";
import { CashChangeCalculatorPopover } from "./cart/CashChangeCalculatorPopover";
import { CartShortcutsHintPopover } from "./cart/CartShortcutsHintPopover";
import { Banknote, Pause, Printer, ShoppingCart, Undo2 } from "lucide-react";

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
  // تفعيل التخطيط الموسّع كامل العرض عند استخدام وضع البحث المنسدل (Dropdown POS)
  isExpanded?: boolean;
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
  isExpanded = false,
}) => {
  const [cashTenderedInput, setCashTenderedInput] = useState("");
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [isShortcutsHintOpen, setIsShortcutsHintOpen] = useState(false);

  const calcContainerRef = useRef<HTMLDivElement>(null);

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

  // اختصار F8 لفتح/إغلاق الحاسبة العائمة و Esc لإغلاقها أو إغلاق تلميح الاختصارات
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

  // إغلاق الحاسبة العائمة عند النقر خارج لوحة الدفع
  useEffect(() => {
    if (!isCalcOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        calcContainerRef.current &&
        !calcContainerRef.current.contains(e.target as Node)
      ) {
        setIsCalcOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isCalcOpen]);

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

  return (
    // في الوضع الموسّع (البحث المنسدل) تمتد السلة على كامل عرض الشاشة، بينما تحتفظ بـ w-5/12 في الوضع المقسوم
    <div
      className={
        isExpanded
          ? "flex-1 w-full p-4 flex flex-col bg-slate-900/20 overflow-hidden"
          : "w-5/12 p-3 flex flex-col bg-slate-900/20"
      }
    >
      {/* شريط استرداد الفاتورة الأصلية بالرقم أو الباركود — يظهر فقط لمن يملك صلاحية المرتجع */}
      {canProcessReturn &&
        invoiceMode === "RETURN" &&
        onLoadInvoiceForReturn && (
          <ReturnInvoiceLookupBar
            returnSourceInvoiceId={returnSourceInvoiceId}
            recentSaleInvoices={recentSaleInvoices}
            onLoadInvoiceForReturn={onLoadInvoiceForReturn}
          />
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

      {/* حاوية السلة ولوحة الدفع: تتوزع أفقياً (السلة يميناً ولوحة الدفع يساراً) في الوضع الموسّع، وتبقى عمودية في الوضع المقسوم */}
      <div
        className={
          isExpanded
            ? "flex-1 min-h-0 flex flex-col lg:flex-row gap-4"
            : "flex-1 min-h-0 flex flex-col"
        }
      >
        {/* قائمة السلة (بأقصى ارتفاع متاح بعد تحويل الاختصارات والحاسبة إلى نوافذ عائمة) */}
        <div
          className={`flex-1 overflow-y-auto border border-slate-800 rounded-xl bg-slate-900/60 space-y-2 no-scrollbar ${
            isExpanded ? "p-3.5" : "p-2.5"
          }`}
        >
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs text-center px-4">
              <ShoppingCart className="w-8 h-8 mb-2 stroke-1" />
              <p>السلة فارغة — ابدأ بإضافة الأدوية أو امسح الباركود بالليزر</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <CartItemRow
                key={item.cartKey}
                item={item}
                isActiveForKeyboard={idx === 0}
                cartLasaRiskGroups={cartLasaRiskGroups}
                onToggleUnit={onToggleUnit}
                onUpdateQty={updateQty}
                onRemove={removeFromCart}
              />
            ))
          )}
        </div>

        {/* منطقة الدفع السريع المدمجة + الحاسبة العائمة (Popover) — تتحول إلى عمود جانبي مريح في الوضع الموسّع */}
        <div
          ref={calcContainerRef}
          className={
            isExpanded
              ? "relative mt-2.5 lg:mt-0 lg:w-[410px] xl:w-[440px] shrink-0 lg:self-start bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 text-xs"
              : "relative mt-2.5 bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2 text-xs"
          }
        >
          {/* الطبقة العائمة لحاسبة الفئات النقدية والباقي */}
          {showCashCalculator && isCalcOpen && (
            <CashChangeCalculatorPopover
              total={total}
              isExpanded={isExpanded}
              cashTenderedInput={cashTenderedInput}
              hasCashInput={hasCashInput}
              isCashSufficient={isCashSufficient}
              changeDue={changeDue}
              remainingDue={remainingDue}
              onChangeCashInput={setCashTenderedInput}
              onExactCash={handleExactCash}
              onAddDenomination={handleAddDenomination}
              onClose={() => setIsCalcOpen(false)}
            />
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

            <CartShortcutsHintPopover
              isOpen={isShortcutsHintOpen}
              isExpanded={isExpanded}
              onToggle={() => setIsShortcutsHintOpen((prev) => !prev)}
              onClose={() => setIsShortcutsHintOpen(false)}
            />
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
              {/* تكبير خط الصافي النهائي تلقائياً في الوضع الموسّع لسهولة القراءة */}
              <span
                className={`font-extrabold font-mono text-emerald-400 ${
                  isExpanded ? "text-2xl" : "text-lg"
                }`}
              >
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
    </div>
  );
};
