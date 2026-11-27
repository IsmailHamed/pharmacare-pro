import React, { useState } from "react";
import { InvoiceEntity } from "../../../../domain/entities/Invoice";
import { FileSearch, SearchCheck } from "lucide-react";

interface Props {
  returnSourceInvoiceId?: string | null;
  recentSaleInvoices: InvoiceEntity[];
  onLoadInvoiceForReturn: (invoiceId: string) => boolean;
}

/**
 * شريط استرداد فاتورة المبيعات الأصلية بالرقم أو الباركود أو عبر أزرار آخر الفواتير لوضع المرتجع
 */
export const ReturnInvoiceLookupBar: React.FC<Props> = ({
  returnSourceInvoiceId,
  recentSaleInvoices,
  onLoadInvoiceForReturn,
}) => {
  const [lookupId, setLookupId] = useState("");

  const handleInvoiceLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupId.trim()) return;
    const ok = onLoadInvoiceForReturn(lookupId);
    if (ok) setLookupId("");
  };

  return (
    <div className="mb-2 p-2.5 bg-amber-950/30 border border-amber-800/70 rounded-xl space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold text-amber-300 flex items-center gap-1.5">
          <FileSearch className="w-3.5 h-3.5" /> استرداد فاتورة مبيعات للمرتجع
        </span>
        {returnSourceInvoiceId && (
          <span className="bg-amber-900/60 border border-amber-600 text-amber-200 text-[10px] font-mono px-2 py-0.5 rounded-full">
            مرجع: {returnSourceInvoiceId}
          </span>
        )}
      </div>

      <form onSubmit={handleInvoiceLookup} className="flex gap-1.5">
        <input
          type="text"
          value={lookupId}
          onChange={(e) => setLookupId(e.target.value)}
          placeholder="امسح باركود الفاتورة أو اكتب رقمها (INV-...)"
          className="flex-1 bg-slate-900 border border-amber-800/80 rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px] outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
        >
          <SearchCheck className="w-3.5 h-3.5" /> جلب
        </button>
      </form>

      {recentSaleInvoices.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="text-[10px] text-amber-300/80 shrink-0">
            آخر الفواتير:
          </span>
          {recentSaleInvoices.slice(0, 6).map((inv) => (
            <button
              key={inv.id}
              type="button"
              onClick={() => onLoadInvoiceForReturn(inv.id)}
              className="text-[10px] font-mono bg-slate-900 hover:bg-amber-900/50 border border-slate-700 text-slate-200 px-2 py-0.5 rounded shrink-0 transition"
            >
              {inv.id} ({inv.totalAmount.toFixed(0)})
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
