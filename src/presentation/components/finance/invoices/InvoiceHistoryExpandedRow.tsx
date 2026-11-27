import React from "react";
import { InvoiceEntity } from "../../../../domain/entities/Invoice";
import { Lock, Package, Printer, Undo2, UserCheck } from "lucide-react";

interface Props {
  invoice: InvoiceEntity;
  colSpan: number;
  canProcessReturn: boolean;
  onReprint: (invoice: InvoiceEntity) => void;
  onReturnInvoice: (invoice: InvoiceEntity) => void;
}

/**
 * تفاصيل الفاتورة الموسّعة (التوثيق الرقابي + جدول الأدوية المصروفة + الملخص المالي وأزرار الإجراء)
 */
export const InvoiceHistoryExpandedRow: React.FC<Props> = ({
  invoice,
  colSpan,
  canProcessReturn,
  onReprint,
  onReturnInvoice,
}) => {
  const isSale = invoice.type === "SALE";

  return (
    <tr className="bg-slate-950/90">
      <td colSpan={colSpan} className="p-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
          {/* شريط التوثيق الرقابي للفاتورة */}
          <div className="px-3.5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3 text-[11px]">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-400" />
                الأدوية المصروفة في الفاتورة ({invoice.items.length})
              </span>
              <span className="inline-flex items-center gap-1 text-sky-400">
                <UserCheck className="w-3.5 h-3.5" />
                المنفّذ:{" "}
                <b className="text-slate-100">
                  {invoice.performedByName || "غير موثّق"}
                </b>
              </span>
              <span className="inline-flex items-center gap-1 text-purple-400 font-mono">
                <Lock className="w-3.5 h-3.5" />
                الوردية:{" "}
                <b className="text-slate-200">{invoice.shiftId || "—"}</b>
              </span>
            </div>

            <div className="font-mono text-slate-400 text-[10.5px]">
              {new Date(invoice.createdAt).toLocaleString("ar-SA")}
            </div>
          </div>

          {/* جدول أصناف الفاتورة */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-[11px]">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400 text-[10px]">
                  <th className="py-2 px-3">الدواء والباركود</th>
                  <th className="py-2 px-2 text-center">الوحدة</th>
                  <th className="py-2 px-2 text-center">سعر الوحدة</th>
                  <th className="py-2 px-2 text-center">الكمية</th>
                  <th className="py-2 px-3 text-left">إجمالي السطر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {invoice.items.map((item) => (
                  <tr key={item.cartKey} className="hover:bg-slate-800/35">
                    <td className="py-2 px-3">
                      <div className="font-bold text-slate-100">
                        {item.product.name}
                      </div>
                      <div className="text-[9.5px] font-mono text-slate-500">
                        {item.product.barcode}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center text-slate-300">
                      {item.unit === "pack" ? "علبة كاملة" : "شريط فرط"}
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-slate-200">
                      {item.unitPrice.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-center font-mono font-bold text-white">
                      {item.qty}
                    </td>
                    <td className="py-2 px-3 text-left font-mono font-bold text-emerald-400">
                      {(item.unitPrice * item.qty).toFixed(2)} ر.س
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* الملخص المالي وأزرار الطباعة والاسترداد */}
          <div className="px-3.5 py-2.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 flex-wrap font-mono text-[11px]">
              <span className="text-slate-400">
                الإجمالي الفرعي:{" "}
                <b className="text-slate-200">{invoice.subtotal.toFixed(2)}</b>
              </span>
              <span className="text-slate-400">
                الخصم:{" "}
                <b className="text-amber-300">{invoice.discountPercent}%</b>
              </span>
              <span className="text-slate-300">
                الصافي النهائي:{" "}
                <b
                  className={`text-sm ${
                    isSale ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {invoice.totalAmount.toFixed(2)} ر.س
                </b>
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onReprint(invoice)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition"
              >
                <Printer className="w-3.5 h-3.5" /> معاينة وإعادة طباعة الفاتورة
                ولصاقات الجرعات
              </button>

              {canProcessReturn && isSale && (
                <button
                  type="button"
                  onClick={() => onReturnInvoice(invoice)}
                  className="bg-amber-600/20 hover:bg-amber-600 border border-amber-600/60 text-amber-300 hover:text-white font-bold px-3.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition"
                >
                  <Undo2 className="w-3.5 h-3.5" /> استرداد الفاتورة بالكامل
                  لشاشة المرتجع
                </button>
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
};
