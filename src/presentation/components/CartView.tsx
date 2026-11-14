import React from "react";
import { CartItemEntity } from "../../domain/entities";
import { Printer, ShoppingCart, Pause, Undo2 } from "lucide-react";

interface Props {
  cart: CartItemEntity[];
  subtotal: number;
  discountPercent: number;
  paymentMode: "CASH" | "CREDIT";
  customerName: string;
  invoiceMode: "SALE" | "RETURN";
  heldCount: number;
  onSetDiscount: (percent: number) => void;
  onSetPaymentMode: (mode: "CASH" | "CREDIT") => void;
  onSetCustomerName: (name: string) => void;
  updateQty: (key: string, delta: number) => void;
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
  onSetDiscount,
  onSetPaymentMode,
  onSetCustomerName,
  updateQty,
  removeFromCart,
  onCheckout,
  onToggleReturn,
  onHold,
}) => {
  const discountAmount = (subtotal * discountPercent) / 100;
  const total = subtotal - discountAmount;

  return (
    <div className="w-5/12 p-4 flex flex-col bg-slate-900/20">
      {/* قائمة السلة */}
      <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl bg-slate-900/60 p-2.5 space-y-2 no-scrollbar">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
            <ShoppingCart className="w-8 h-8 mb-2 stroke-1" />
            <p>السلة فارغة — ابدأ بإضافة الأدوية</p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.cartKey}
              className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2.5 flex items-center justify-between text-xs"
            >
              <div>
                <div className="font-bold text-white flex items-center gap-1.5">
                  {item.product.name}
                  <span
                    className={`text-[10px] px-1.5 rounded ${
                      item.unit === "pack"
                        ? "bg-blue-950 text-blue-300"
                        : "bg-indigo-950 text-indigo-300"
                    }`}
                  >
                    {item.unit === "pack" ? "علبة" : "شريط"}
                  </span>
                  {item.isControlled && (
                    <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800 px-1.5 rounded">
                      🔒 موثق
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {item.unitPrice.toFixed(2)} للوحدة
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-900 border border-slate-700 rounded">
                  <button
                    onClick={() => updateQty(item.cartKey, -1)}
                    className="px-2 py-0.5 hover:bg-slate-800"
                  >
                    −
                  </button>
                  <span className="px-2.5 font-mono font-bold">{item.qty}</span>
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
          ))
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
            title="تبديل وضع المرتجع (F6)"
            className={`px-3 py-1.5 rounded-lg font-bold border transition ${
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
            آجل (آجل)
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
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 shadow"
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
