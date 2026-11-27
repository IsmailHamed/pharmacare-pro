import React from "react";
import { SupplierEntity } from "../../../../domain/entities";
import { UNASSIGNED_KEY } from "./shortages.config";
import { CheckSquare, X } from "lucide-react";

interface Props {
  selectedCount: number;
  bulkSupplierId: string;
  activeSuppliers: SupplierEntity[];
  onBulkSupplierChange: (supplierId: string) => void;
  onApplyBulkAssign: () => void;
  onClearSelection: () => void;
}

/**
 * شريط التوجيه الجماعي الذي يظهر تلقائياً عند تحديد صنف واحد أو أكثر في دفتر النواقص
 */
export const ShortageBulkAssignBar: React.FC<Props> = ({
  selectedCount,
  bulkSupplierId,
  activeSuppliers,
  onBulkSupplierChange,
  onApplyBulkAssign,
  onClearSelection,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-indigo-950/45 border border-indigo-700/80 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-indigo-200 font-bold">
        <CheckSquare className="w-4 h-4 text-indigo-400" />
        <span>
          تم تحديد <b className="font-mono text-white">{selectedCount}</b> صنف —
          توجيهها دفعة واحدة إلى:
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={bulkSupplierId}
          onChange={(e) => onBulkSupplierChange(e.target.value)}
          className="bg-slate-900 border border-indigo-700 rounded-lg px-3 py-1.5 text-white outline-none min-w-[200px]"
        >
          <option value="">-- اختر المستودع --</option>
          {activeSuppliers.map((sup) => (
            <option key={sup.id} value={sup.id}>
              {sup.name}
            </option>
          ))}
          <option value={UNASSIGNED_KEY}>إلغاء التعيين (غير موزع)</option>
        </select>

        <button
          type="button"
          disabled={!bulkSupplierId}
          onClick={onApplyBulkAssign}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold px-3.5 py-1.5 rounded-lg transition"
        >
          تطبيق التوجيه
        </button>

        <button
          type="button"
          onClick={onClearSelection}
          title="إلغاء التحديد"
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
