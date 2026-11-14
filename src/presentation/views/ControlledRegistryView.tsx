import React, { useMemo } from "react";
import { usePosStore } from "../../application/store/usePosStore";
import { ExcelService } from "../../infrastructure/excel/ExcelService";
import { ShieldAlert, FileSpreadsheet } from "lucide-react";

/**
 * دفتر الأدوية المراقبة والنفسية
 * سجل رسمي جاهز للتصدير للجهات الصحية عبر ExcelService المعزولة.
 */
export const ControlledRegistryView: React.FC = () => {
  const { controlledLogs } = usePosStore();
  const [search, setSearch] = React.useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return controlledLogs;
    return controlledLogs.filter(
      (l) =>
        l.patientName.toLowerCase().includes(q) ||
        l.nationalId.includes(q) ||
        l.productName.toLowerCase().includes(q) ||
        l.prescriptionId.toLowerCase().includes(q),
    );
  }, [controlledLogs, search]);

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-950 text-slate-200 text-xs">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" /> دفتر الأدوية
            المراقبة والنفسية
          </h2>
          <p className="text-slate-400 mt-1">
            سجل رسمي لكل عملية صرف دواء مراقب — إجباري التوثيق قبل البيع.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالمريض، الرقم الوطني، الوصفة..."
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-rose-500 w-72"
          />
          <button
            onClick={() => ExcelService.exportControlledLogs(filtered)}
            className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" /> تصدير تقرير رسمي (Excel)
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-slate-800 text-slate-400">
            <tr>
              <th className="py-3 px-3">التاريخ</th>
              <th className="py-3 px-3">الدواء</th>
              <th className="py-3 px-3">الكمية</th>
              <th className="py-3 px-3">الدفعة</th>
              <th className="py-3 px-3">المريض</th>
              <th className="py-3 px-3">الرقم الوطني</th>
              <th className="py-3 px-3">الطبيب</th>
              <th className="py-3 px-3">الوصفة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-slate-500 py-10">
                  لا توجد عمليات صرف أدوية مراقبة مسجلة بعد
                </td>
              </tr>
            )}
            {filtered.map((l) => (
              <tr key={l.id} className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-mono text-slate-400">
                  {l.dispensedAt.slice(0, 16).replace("T", " ")}
                </td>
                <td className="py-2.5 px-3 font-bold text-white">
                  {l.productName}
                </td>
                <td className="py-2.5 px-3 font-mono">
                  {l.qty} {l.unit === "pack" ? "علبة" : "شريط"}
                </td>
                <td className="py-2.5 px-3 font-mono text-slate-400">
                  {l.batchNumber}
                </td>
                <td className="py-2.5 px-3">{l.patientName}</td>
                <td className="py-2.5 px-3 font-mono">{l.nationalId}</td>
                <td className="py-2.5 px-3">{l.doctorName}</td>
                <td className="py-2.5 px-3 font-mono text-rose-300">
                  {l.prescriptionId}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
