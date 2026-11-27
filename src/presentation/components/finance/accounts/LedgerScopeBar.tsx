import React from "react";
import { LedgerScope } from "./ledgerAccounts.config";
import { Building2, Keyboard, Receipt, Users } from "lucide-react";

interface Props {
  activeScope: LedgerScope;
  hasSuppliersAccess: boolean;
  openCustomersCount: number;
  totalReceivables: number;
  openSuppliersCount: number;
  totalPayables: number;
  accessibleVouchersCount: number;
  onSwitchScope: (nextScope: LedgerScope) => void;
}

/**
 * شريط المبدّل العلوي المدمج (العملاء / المستودعات / سجل السندات) مع تلميح اختصارات لوحة المفاتيح
 */
export const LedgerScopeBar: React.FC<Props> = ({
  activeScope,
  hasSuppliersAccess,
  openCustomersCount,
  totalReceivables,
  openSuppliersCount,
  totalPayables,
  accessibleVouchersCount,
  onSwitchScope,
}) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between gap-3 flex-wrap">
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => onSwitchScope("customers")}
        className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition ${
          activeScope === "customers"
            ? "bg-sky-600 text-white shadow-md"
            : "bg-slate-950/60 text-slate-300 hover:bg-slate-800 border border-slate-800"
        }`}
      >
        <Users className="w-4 h-4" />
        <span>ذمم العملاء (لنا)</span>
        <span
          className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
            activeScope === "customers"
              ? "bg-sky-950/60 text-sky-100"
              : "bg-slate-800 text-sky-300"
          }`}
        >
          {openCustomersCount}
        </span>
        <span
          className={`font-mono text-[11px] font-extrabold ${
            activeScope === "customers" ? "text-sky-100" : "text-sky-400"
          }`}
        >
          {totalReceivables.toFixed(2)} ر.س
        </span>
      </button>

      {hasSuppliersAccess && (
        <button
          type="button"
          onClick={() => onSwitchScope("suppliers")}
          className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition ${
            activeScope === "suppliers"
              ? "bg-purple-600 text-white shadow-md"
              : "bg-slate-950/60 text-slate-300 hover:bg-slate-800 border border-slate-800"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>ذمم المستودعات (علينا)</span>
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
              activeScope === "suppliers"
                ? "bg-purple-950/60 text-purple-100"
                : "bg-slate-800 text-purple-300"
            }`}
          >
            {openSuppliersCount}
          </span>
          <span
            className={`font-mono text-[11px] font-extrabold ${
              activeScope === "suppliers"
                ? "text-purple-100"
                : "text-purple-400"
            }`}
          >
            {totalPayables.toFixed(2)} ر.س
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={() => onSwitchScope("vouchers")}
        className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition ${
          activeScope === "vouchers"
            ? "bg-emerald-600 text-white shadow-md"
            : "bg-slate-950/60 text-slate-300 hover:bg-slate-800 border border-slate-800"
        }`}
      >
        <Receipt className="w-4 h-4" />
        <span>سجل السندات</span>
        <span
          className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
            activeScope === "vouchers"
              ? "bg-emerald-950/60 text-emerald-100"
              : "bg-slate-800 text-emerald-300"
          }`}
        >
          {accessibleVouchersCount}
        </span>
      </button>
    </div>

    {/* تلميح اختصارات لوحة المفاتيح المدمج */}
    {activeScope !== "vouchers" && (
      <div className="hidden xl:flex items-center gap-2 text-[10px] text-slate-400 font-mono bg-slate-950/70 border border-slate-800 px-2.5 py-1.5 rounded-xl">
        <Keyboard className="w-3.5 h-3.5 text-sky-400" />
        <span>↑/↓ تنقل</span>
        <span>•</span>
        <span>Enter تفاصيل العمليات</span>
        <span>•</span>
        <span>F2 / بحث</span>
      </div>
    )}
  </div>
);
