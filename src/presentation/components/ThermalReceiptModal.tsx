import React, { useState } from "react";
import { InvoiceEntity } from "../../domain/entities/Invoice";
import { Printer, X, Tag, Receipt } from "lucide-react";

interface Props {
  invoice: InvoiceEntity | null;
  onClose: () => void;
}

export const ThermalReceiptModal: React.FC<Props> = ({ invoice, onClose }) => {
  const [viewMode, setViewMode] = useState<"receipt" | "labels">("receipt");
  // تخزين نص الجرعة المخصص لكل صنف في الفاتورة
  const [dosages, setDosages] = useState<Record<string, string>>({});

  if (!invoice) return null;

  const discountAmount = (invoice.subtotal * invoice.discountPercent) / 100;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        {/* شريط التحكم العلوي */}
        <div className="p-3.5 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewMode("receipt")}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                viewMode === "receipt"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" /> إيصال حراري (80mm)
            </button>
            <button
              onClick={() => setViewMode("labels")}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                viewMode === "labels"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              <Tag className="w-3.5 h-3.5" /> لصاقات الجرعات (
              {invoice.items.length})
            </button>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-900 p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* منطقة المعاينة القابلة للطباعة */}
        <div className="flex-1 overflow-y-auto p-5 flex justify-center bg-slate-950/60">
          {viewMode === "receipt" ? (
            /* قالب ورق الطابعة الحرارية 80mm */
            <div className="bg-white text-slate-950 w-[302px] p-4 rounded shadow-lg font-mono text-[11px] leading-relaxed">
              <div className="text-center border-b-2 border-dashed border-slate-400 pb-2.5 mb-2.5">
                <div className="font-extrabold text-sm">
                  فارماكير برو - PharmaCare Pro
                </div>
                <div className="text-[10px] text-slate-600">
                  الفرع: {invoice.branchId} | نظام إدارة الصيدلية
                </div>
                <div className="text-[10px] mt-1 font-bold">
                  {invoice.type === "RETURN"
                    ? "*** إشعار مرتجع مبيعات ***"
                    : "فاتورة مبيعات ضريبية مبسطة"}
                </div>
              </div>

              <div className="space-y-0.5 text-[10px] border-b border-dashed border-slate-400 pb-2 mb-2">
                <div className="flex justify-between">
                  <span>رقم الفاتورة:</span>
                  <span className="font-bold">{invoice.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>التاريخ:</span>
                  <span>
                    {invoice.createdAt.slice(0, 19).replace("T", " ")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>العميل:</span>
                  <span>{invoice.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>طريقة الدفع:</span>
                  <span className="font-bold">
                    {invoice.paymentMode === "CASH"
                      ? "نقدي (CASH)"
                      : "آجل (CREDIT)"}
                  </span>
                </div>
              </div>

              {/* جدول الأصناف */}
              <table className="w-full text-right border-b border-dashed border-slate-400 pb-2 mb-2 text-[10px]">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-600">
                    <th className="py-1">الصنف</th>
                    <th className="py-1 text-center">الكمية</th>
                    <th className="py-1 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoice.items.map((item) => (
                    <tr key={item.cartKey}>
                      <td className="py-1.5">
                        <div className="font-bold">{item.product.name}</div>
                        <div className="text-[9px] text-slate-500">
                          {item.unit === "pack" ? "علبة" : "شريط"} ×{" "}
                          {item.unitPrice.toFixed(2)}
                          {item.fifoAllocations?.[0] &&
                            ` | دفعة: ${item.fifoAllocations[0].batchNumber}`}
                        </div>
                      </td>
                      <td className="py-1.5 text-center font-bold">
                        {item.qty}
                      </td>
                      <td className="py-1.5 text-left font-bold">
                        {(item.unitPrice * item.qty).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* الإجماليات */}
              <div className="space-y-1 text-[11px] border-b-2 border-dashed border-slate-400 pb-2.5 mb-2.5">
                <div className="flex justify-between">
                  <span>الإجمالي الفرعي:</span>
                  <span>{invoice.subtotal.toFixed(2)}</span>
                </div>
                {invoice.discountPercent > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>الخصم ({invoice.discountPercent}%):</span>
                    <span>-{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-slate-300">
                  <span>الصافي المطلوب:</span>
                  <span>{invoice.totalAmount.toFixed(2)} ر.س</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-600 space-y-0.5">
                <div>شكراًلزيارتكم — مع تمنياتنا لكم بالشفاء العاجل</div>
                <div className="font-mono text-[9px]">{invoice.id}</div>
              </div>
            </div>
          ) : (
            /* قالب لصاقات الجرعات وطريقة الاستعمال (38mm x 25mm) */
            <div className="w-full space-y-3">
              {invoice.items.map((item) => {
                const defaultDosage =
                  dosages[item.cartKey] ??
                  "قرص واحد / كبسولة (صباحاً ومساءً) بعد الطعام";
                return (
                  <div
                    key={item.cartKey}
                    className="bg-white text-slate-950 p-3 rounded-lg border-2 border-slate-400 shadow space-y-1.5"
                  >
                    <div className="flex justify-between items-center border-b border-slate-300 pb-1 text-[10px] font-bold">
                      <span>صيدلية فارماكير برو</span>
                      <span>المريض: {invoice.customerName}</span>
                    </div>
                    <div className="font-extrabold text-xs text-blue-900">
                      {item.product.name}
                    </div>
                    <div>
                      <input
                        type="text"
                        value={defaultDosage}
                        onChange={(e) =>
                          setDosages((prev) => ({
                            ...prev,
                            [item.cartKey]: e.target.value,
                          }))
                        }
                        className="w-full bg-amber-50 border border-amber-300 rounded px-2 py-1 text-[11px] font-bold text-slate-900 outline-none"
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500 pt-0.5 font-mono">
                      <span>يحفظ بعيداً عن متناول الأطفال</span>
                      <span>{invoice.createdAt.slice(0, 10)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* أزرار الإجراءات السفلية */}
        <div className="p-3.5 bg-slate-800/90 border-t border-slate-700 flex gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg"
          >
            <Printer className="w-4 h-4" />
            {viewMode === "receipt"
              ? "طباعة الإيصال الحراري"
              : "طباعة لصاقات الجرعات"}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl"
          >
            إغلاق (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
