import React from "react";
import { StatementRow } from "./ledgerStatement.config";
import { Pill } from "lucide-react";

interface Props {
  row: StatementRow;
}

/**
 * صف التفاصيل القابل للتوسيع: يعرض جدول الأدوية المصروفة أو المشتراة داخل الفاتورة
 */
export const LedgerStatementExpandedRow: React.FC<Props> = ({ row }) => {
  if (!row.items || row.items.length === 0) return null;

  return (
    <tr className="bg-slate-950/90">
      <td colSpan={6} className="p-3 font-sans">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden">
          <div className="px-3 py-1.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap text-[10.5px] text-slate-400">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Pill className="w-3.5 h-3.5 text-emerald-400" />
              الأدوية المسجلة في{" "}
              {row.kind === "RETURN" ? "فاتورة المرتجع" : "الفاتورة"} (
              {row.referenceId})
            </span>

            <div className="flex items-center gap-3 font-mono">
              {row.discountPercent !== undefined && row.discountPercent > 0 && (
                <span className="text-amber-300">
                  الفرعي: {(row.subtotal ?? 0).toFixed(2)} • خصم:{" "}
                  {row.discountPercent}%
                </span>
              )}
              {row.performedByName && (
                <span className="font-sans text-sky-400">
                  المنفّذ: {row.performedByName}
                </span>
              )}
            </div>
          </div>

          <table className="w-full text-right text-[11px]">
            <thead>
              <tr className="border-b border-slate-800/80 text-slate-400 text-[10px]">
                <th className="py-1.5 px-3">اسم الدواء</th>
                <th className="py-1.5 px-2 text-center">الوحدة</th>
                <th className="py-1.5 px-2 text-center">الكمية</th>
                <th className="py-1.5 px-2 text-center">سعر الوحدة</th>
                <th className="py-1.5 px-3 text-left">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {row.items.map((item) => (
                <tr key={item.key}>
                  <td className="py-1.5 px-3">
                    <div className="font-bold text-slate-100">{item.name}</div>
                    {item.barcode && (
                      <div className="text-[9.5px] font-mono text-slate-500">
                        {item.barcode}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-center text-slate-300">
                    {item.unitLabel}
                  </td>
                  <td className="py-1.5 px-2 text-center font-mono font-bold text-white">
                    {item.qty}
                    {item.bonusQty ? (
                      <span className="text-emerald-400 text-[10px] mr-1">
                        (+{item.bonusQty} بونص)
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 px-2 text-center font-mono text-slate-300">
                    {item.unitPrice.toFixed(2)}
                  </td>
                  <td className="py-1.5 px-3 text-left font-mono font-bold text-emerald-400">
                    {item.lineTotal.toFixed(2)} ر.س
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
};
