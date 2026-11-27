import React from "react";
import { PurchaseInvoiceEntity } from "../../../../domain/entities";
import { Package } from "lucide-react";

interface Props {
  invoice: PurchaseInvoiceEntity;
  colSpan: number;
}

/**
 * جدول بنود فاتورة الشراء التفصيلي بكافة المعلومات المحاسبية والمخزنية
 */
export const PurchaseInvoiceExpandedRow: React.FC<Props> = ({
  invoice,
  colSpan,
}) => (
  <tr className="bg-slate-950/90">
    <td colSpan={colSpan} className="p-3">
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
        <div className="px-3 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2 text-[11px]">
          <span className="font-bold text-slate-200 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-indigo-400" />
            تفاصيل بنود فاتورة الشراء ({invoice.id}) — المستودع:{" "}
            {invoice.supplierName}
          </span>
          <span className="font-mono text-slate-400 text-[10.5px]">
            الفرع: {invoice.branchId} • فاتورة المورد:{" "}
            {invoice.supplierInvoiceNumber || "غير مدخلة"}
            {invoice.purchaseOrderId && (
              <span className="text-amber-300 mr-2">
                • أمر الشراء: {invoice.purchaseOrderId}
              </span>
            )}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11px]">
            <thead>
              <tr className="border-b border-slate-800/80 text-slate-400 text-[10px]">
                <th className="py-2 px-3">الصنف والباركود</th>
                <th className="py-2 px-2">التشغيلة والصلاحية</th>
                <th className="py-2 px-2 text-center">المشترى</th>
                <th className="py-2 px-2 text-center">+ بونص</th>
                <th className="py-2 px-2 text-center">سعر الشراء</th>
                <th className="py-2 px-2 text-center">
                  الرصيد والتكلفة السابقة
                </th>
                <th className="py-2 px-2 text-center">
                  التكلفة المرجحة الجديدة
                </th>
                <th className="py-2 px-2 text-center">سعر البيع الجديد</th>
                <th className="py-2 px-3 text-left">إجمالي السطر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {invoice.items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/35">
                  <td className="py-2 px-3">
                    <div className="font-bold text-slate-100">
                      {item.productName}
                    </div>
                    <div className="text-[9.5px] font-mono text-slate-500">
                      {item.barcode}
                    </div>
                  </td>

                  <td className="py-2 px-2 font-mono">
                    <div className="text-slate-200 font-bold">
                      {item.batchNumber}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {item.expiryDate}
                    </div>
                  </td>

                  <td className="py-2 px-2 text-center font-mono font-bold text-white">
                    {item.purchasedPacks} علبة
                  </td>

                  <td className="py-2 px-2 text-center font-mono font-bold text-emerald-400">
                    {item.bonusPacks > 0 ? `+${item.bonusPacks}` : "0"}
                  </td>

                  <td className="py-2 px-2 text-center font-mono text-slate-200">
                    {item.purchasePricePerPack.toFixed(2)}
                  </td>

                  <td className="py-2 px-2 text-center font-mono text-slate-400">
                    <div>{item.previousStockPacks} علبة</div>
                    <div className="text-[10px]">
                      {item.previousWeightedCost.toFixed(2)} ر.س
                    </div>
                  </td>

                  <td className="py-2 px-2 text-center font-mono font-bold text-amber-400">
                    {item.newWeightedCost.toFixed(2)} ر.س
                  </td>

                  <td className="py-2 px-2 text-center font-mono text-sky-300">
                    {item.newPackSalePrice > 0
                      ? `${item.newPackSalePrice.toFixed(2)} ر.س`
                      : "بدون تغيير"}
                  </td>

                  <td className="py-2 px-3 text-left font-mono font-extrabold text-white">
                    {item.lineTotal.toFixed(2)} ر.س
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </td>
  </tr>
);
