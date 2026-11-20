import React, { useMemo, useState } from "react";
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
} from "lucide-react";

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

  const discountAmount = (subtotal * discountPercent) / 100;
  const total = subtotal - discountAmount;

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
    <div className="w-5/12 p-4 flex flex-col bg-slate-900/20">
      {/* شريط استرداد الفاتورة الأصلية بالرقم أو الباركود — يظهر فقط لمن يملك صلاحية المرتجع */}
      {canProcessReturn &&
        invoiceMode === "RETURN" &&
        onLoadInvoiceForReturn && (
          <div className="mb-2.5 p-2.5 bg-amber-950/30 border border-amber-800/70 rounded-xl space-y-2 text-xs">
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
        <div className="mb-2.5 p-2.5 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-xs font-bold flex items-center justify-between gap-2">
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

      {/* شريط تلميح اختصارات "صفر ماوس" لآخر صنف مضاف للسلة */}
      {cart.length > 0 && (
        <div className="mb-2 px-2.5 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1 font-bold text-sky-400">
            <Keyboard className="w-3.5 h-3.5" /> تحكم سريع بآخر صنف:
          </span>
          <div className="flex items-center gap-2 font-mono">
            <span>
              <kbd className="bg-slate-800 border border-slate-700 text-slate-200 px-1 py-0.5 rounded">
                +
              </kbd>
              /
              <kbd className="bg-slate-800 border border-slate-700 text-slate-200 px-1 py-0.5 rounded">
                -
              </kbd>{" "}
              كمية
            </span>
            <span>
              <kbd className="bg-slate-800 border border-slate-700 text-slate-200 px-1 py-0.5 rounded">
                Tab
              </kbd>{" "}
              علبة/شريط
            </span>
            <span>
              <kbd className="bg-slate-800 border border-slate-700 text-slate-200 px-1 py-0.5 rounded">
                Del
              </kbd>{" "}
              حذف
            </span>
          </div>
        </div>
      )}

      {/* قائمة السلة */}
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
                      onClick={() => updateQty(item.cartKey, -1)}
                      className="px-2 py-0.5 hover:bg-slate-800"
                    >
                      −
                    </button>
                    <span className="px-2.5 font-mono font-bold">
                      {item.qty}
                    </span>
                    <button
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

      {/* منطقة الدفع السريع */}
      <div className="mt-3 bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs">
        <div className="flex gap-2">
          <input
            type="text"
            value={customerName}
            onChange={(e) => onSetCustomerName(e.target.value)}
            placeholder="اسم العميل (اختياري)"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-blue-500"
          />
          <button
            onClick={onToggleReturn}
            disabled={isReturnToggleDisabled}
            title={
              isReturnToggleDisabled
                ? "لا تملك صلاحية إجراء مرتجعات المبيعات"
                : "تبديل وضع المرتجع (F6)"
            }
            className={`px-3 py-1.5 rounded-lg font-bold border transition disabled:opacity-40 disabled:cursor-not-allowed ${
              invoiceMode === "RETURN"
                ? "bg-amber-950 text-amber-300 border-amber-700 animate-pulse"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
            }`}
          >
            <Undo2 className="w-3.5 h-3.5 inline ml-1" />
            {invoiceMode === "RETURN" ? "وضع المرتجع" : "بيع"}
          </button>
        </div>

        <div className="flex gap-2">
          <button
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

        <div className="flex justify-between text-slate-400">
          <span>الإجمالي الفرعي:</span>
          <span className="font-mono">{subtotal.toFixed(2)}</span>
        </div>
        {discountPercent > 0 && (
          <div className="flex justify-between text-rose-400">
            <span>الخصم ({discountPercent}%):</span>
            <span className="font-mono">-{discountAmount.toFixed(2)}</span>
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-slate-800">
          <span className="font-bold text-sm">الصافي المطلوب:</span>
          <span className="text-lg font-extrabold font-mono text-emerald-400">
            {total.toFixed(2)} ر.س
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onHold}
            title="تعليق الفاتورة (F5)"
            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2.5 rounded-lg font-bold flex items-center gap-1.5"
          >
            <Pause className="w-4 h-4" />
            {heldCount > 0 ? `(${heldCount})` : ""}
          </button>
          <button
            onClick={onCheckout}
            disabled={isReturnCheckoutBlocked}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 shadow"
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
