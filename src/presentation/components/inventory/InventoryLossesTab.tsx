import React, { useMemo, useState } from "react";
import { ClipboardCheck, Search } from "lucide-react";

export interface InventoryLossLog {
  id: string;
  title: string;
  notes?: string | null;
  createdAt: string;
  amount: number;
}

interface Props {
  logs: InventoryLossLog[];
}

/**
 * تبويب سجل التوالف والكسور والفروقات الجردية المقيدة مالياً
 */
export const InventoryLossesTab: React.FC<Props> = ({ logs }) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (log) =>
        log.id.toLowerCase().includes(q) ||
        log.title.toLowerCase().includes(q) ||
        (log.notes || "").toLowerCase().includes(q),
    );
  }, [logs, searchQuery]);

  const totalLossAmount = useMemo(
    () => logs.reduce((sum, e) => sum + e.amount, 0),
    [logs],
  );

  const filteredLossAmount = useMemo(
    () => filteredLogs.reduce((sum, e) => sum + e.amount, 0),
    [filteredLogs],
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* الترويسة وملخص الإحصائيات */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-rose-400" /> سجل التوالف
            والكسور والفروقات الجردية المقيدة مالياً
          </h3>
          <p className="text-slate-400 text-[11px] mt-0.5">
            جميع تسويات التلف والكسر والعجز الجردي المرحلة تلقائياً كقيود خسارة
            بالتكلفة.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-slate-400">عدد التسويات</div>
            <div className="font-mono font-bold text-white text-sm">
              {logs.length}
            </div>
          </div>
          <div className="bg-rose-950/35 border border-rose-800/70 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-rose-300/80">
              إجمالي خسائر التوالف والعجز
            </div>
            <div className="font-mono font-extrabold text-rose-400 text-sm">
              -{totalLossAmount.toFixed(2)} ر.س
            </div>
          </div>
        </div>
      </div>

      {/* شريط البحث داخل سجل التوالف */}
      {logs.length > 0 && (
        <div className="flex items-center justify-between gap-3 bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم التسوية، اسم الصنف، أو تفاصيل الملاحظات..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pr-9 pl-3 py-1.5 text-white outline-none focus:border-rose-500"
            />
          </div>
          <div className="text-slate-400 font-mono shrink-0">
            النتائج: <b className="text-white">{filteredLogs.length}</b> •
            المجموع:{" "}
            <b className="text-rose-400">
              -{filteredLossAmount.toFixed(2)} ر.س
            </b>
          </div>
        </div>
      )}

      {/* جدول السجلات أو الحالة الفارغة */}
      {logs.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-500 text-center gap-2">
          <ClipboardCheck className="w-9 h-9 text-slate-700 stroke-1" />
          <p className="font-bold text-slate-400">
            لا توجد توالف أو فروقات جردية مقيدة مالياً حتى الآن.
          </p>
          <p className="text-[11px] text-slate-500">
            عند إجراء أي تسوية عجز أو تلف من تبويب المخزون ستظهر هنا تلقائياً مع
            قيمتها بالتكلفة.
          </p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          لا توجد تسويات مطابقة لـ «{searchQuery.trim()}».
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 px-2">رقم التسوية</th>
                <th className="py-2 px-2">البيان والصنف</th>
                <th className="py-2 px-2">التفاصيل والملاحظات</th>
                <th className="py-2 px-2">التاريخ</th>
                <th className="py-2 px-2">قيمة الخسارة بالتكلفة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-2 font-bold text-white">{log.id}</td>
                  <td className="py-2.5 px-2 font-sans font-bold text-amber-300">
                    {log.title}
                  </td>
                  <td className="py-2.5 px-2 font-sans text-slate-400">
                    {log.notes || "—"}
                  </td>
                  <td className="py-2.5 px-2 text-slate-400">
                    {new Date(log.createdAt).toLocaleString("ar-SA")}
                  </td>
                  <td className="py-2.5 px-2 font-bold text-rose-400">
                    -{log.amount.toFixed(2)} ر.س
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
