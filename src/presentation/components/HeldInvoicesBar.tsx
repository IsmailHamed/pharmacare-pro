import React from "react";
import { HeldInvoiceEntity } from "../../domain/entities";
import { PauseCircle } from "lucide-react";

interface Props {
  heldInvoices: HeldInvoiceEntity[];
  onResume: (id: string) => void;
}

/** شريط الفواتير المعلقة (F5) — استئناف فوري بضغطة واحدة */
export const HeldInvoicesBar: React.FC<Props> = ({
  heldInvoices,
  onResume,
}) => {
  if (heldInvoices.length === 0) return null;

  return (
    <div className="bg-slate-900/80 border-b border-slate-800 px-4 py-2 flex items-center gap-2 overflow-x-auto">
      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 shrink-0">
        <PauseCircle className="w-3.5 h-3.5" /> فواتير معلقة (F5 للاستئناف):
      </span>
      {heldInvoices.map((inv) => (
        <button
          key={inv.id}
          onClick={() => onResume(inv.id)}
          className="shrink-0 bg-amber-950/60 hover:bg-amber-900 border border-amber-800 text-amber-200 text-[10px] font-bold px-3 py-1 rounded-full transition"
        >
          {inv.customerName} ({inv.items.length} صنف)
        </button>
      ))}
    </div>
  );
};
