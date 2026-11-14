import React from "react";
import { ShiftSummaryEntity } from "../../../domain/entities";
import { History } from "lucide-react";

interface Props {
  closedShifts: ShiftSummaryEntity[];
}

export const ClosedShiftsTable: React.FC<Props> = ({ closedShifts }) => {
  if (closedShifts.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
      <h3 className="font-bold text-white text-sm flex items-center gap-2">
        <History className="w-4 h-4 text-slate-400" /> سجل تقارير تسليم الورديات
        السابقة (Z-Reports Archive)
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-right text-[11px]">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-2">رقم الوردية</th>
              <th className="py-2">الصيدلي</th>
              <th className="py-2">العهدة الافتتاحية</th>
              <th className="py-2">مبيعات الكاش</th>
              <th className="py-2">النقد المتوقع</th>
              <th className="py-2">الجرد الفعلي</th>
              <th className="py-2">الفارق (Variance)</th>
              <th className="py-2">المورّد للخزنة</th>
              <th className="py-2">العهدة المرحلة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {closedShifts.map((s) => (
              <tr key={s.id}>
                <td className="py-2 font-bold text-white">{s.id}</td>
                <td className="py-2 font-sans">{s.pharmacistName}</td>
                <td className="py-2">{s.openingBalance.toFixed(2)}</td>
                <td className="py-2 text-emerald-400">
                  {s.cashSalesTotal.toFixed(2)}
                </td>
                <td className="py-2 text-amber-400">
                  {s.expectedDrawerCash.toFixed(2)}
                </td>
                <td className="py-2 font-bold text-white">
                  {(s.actualDrawerCash ?? 0).toFixed(2)}
                </td>
                <td
                  className={`py-2 font-bold ${
                    (s.variance || 0) < 0
                      ? "text-rose-400"
                      : (s.variance || 0) > 0
                        ? "text-sky-400"
                        : "text-emerald-400"
                  }`}
                >
                  {(s.variance || 0) > 0
                    ? `+${(s.variance || 0).toFixed(2)}`
                    : (s.variance || 0).toFixed(2)}
                </td>
                <td className="py-2 text-purple-400">
                  {(s.safeDropAmount || 0).toFixed(2)}
                </td>
                <td className="py-2 text-slate-300">
                  {(s.nextShiftFloat || 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
