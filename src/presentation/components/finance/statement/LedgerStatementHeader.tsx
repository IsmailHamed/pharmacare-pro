import React from "react";
import { PartyAccountSummary } from "../../../../domain/entities";
import {
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  HandCoins,
  Printer,
  Users,
} from "lucide-react";

interface Props {
  party: PartyAccountSummary;
  ageDays: number;
  movementsCount: number;
  copied: boolean;
  onOpenPayment: (party: PartyAccountSummary) => void;
  onCopyWhatsApp: () => void;
  onPrintStatement: () => void;
}

/**
 * رأس كشف الحساب: يعرض هوية الطرف، عمر المديونية، أزرار السند/واتساب/الطباعة، وبطاقات ملخص الأرصدة
 */
export const LedgerStatementHeader: React.FC<Props> = ({
  party,
  ageDays,
  movementsCount,
  copied,
  onOpenPayment,
  onCopyWhatsApp,
  onPrintStatement,
}) => {
  const isCustomer = party.partyType === "CUSTOMER";

  return (
    <>
      {/* رأس الحساب وأزرار الإجراء المباشرة */}
      <div className="flex items-start justify-between gap-3 flex-wrap border-b border-slate-800 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isCustomer ? (
              <Users className="w-4 h-4 text-sky-400 shrink-0" />
            ) : (
              <Building2 className="w-4 h-4 text-purple-400 shrink-0" />
            )}
            <h3 className="font-bold text-white text-sm truncate">
              {party.partyName}
            </h3>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isCustomer
                  ? "bg-sky-950/60 border-sky-800 text-sky-300"
                  : "bg-purple-950/60 border-purple-800 text-purple-300"
              }`}
            >
              {isCustomer ? "عميل آجل" : "مستودع / مورد"}
            </span>

            {party.remainingBalance > 0 ? (
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  ageDays > 60
                    ? "bg-rose-950/60 border-rose-800 text-rose-300"
                    : ageDays > 30
                      ? "bg-amber-950/60 border-amber-800 text-amber-300"
                      : "bg-emerald-950/50 border-emerald-800 text-emerald-300"
                }`}
              >
                <Clock className="w-3 h-3" />
                {ageDays === 0 ? "حركة اليوم" : `منذ ${ageDays} يوم`}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800 text-emerald-300">
                <CheckCircle2 className="w-3 h-3" /> مسدد بالكامل
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            آخر حركة:{" "}
            {new Date(party.lastTransactionAt).toLocaleString("ar-SA")} •{" "}
            {movementsCount} حركة مسجلة
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {party.remainingBalance > 0 && (
            <button
              type="button"
              onClick={() => onOpenPayment(party)}
              className={`px-3.5 py-2 rounded-xl text-white font-bold flex items-center gap-1.5 shadow transition ${
                isCustomer
                  ? "bg-sky-600 hover:bg-sky-500"
                  : "bg-purple-600 hover:bg-purple-500"
              }`}
            >
              <HandCoins className="w-4 h-4" />
              {isCustomer ? "تسجيل سند قبض" : "تسجيل سند صرف"}
            </button>
          )}

          <button
            type="button"
            onClick={onCopyWhatsApp}
            title="نسخ كشف الحساب المنسّق للواتساب مع أسماء الأدوية"
            className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold flex items-center gap-1.5 transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" /> تم النسخ
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> واتساب
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onPrintStatement}
            title="طباعة كشف الحساب الكامل مع الأصناف"
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold flex items-center gap-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5" /> طباعة كشف
          </button>
        </div>
      </div>

      {/* ملخص الأرصدة (بدون شريط نسبة التسديد) */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
          <div className="text-[10px] text-slate-400">
            {isCustomer ? "صافي المبيعات الآجلة" : "إجمالي فواتير الشراء"}
          </div>
          <div className="font-mono font-bold text-sm text-white mt-0.5">
            {party.totalCreditAmount.toFixed(2)} ر.س
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
          <div className="text-[10px] text-slate-400">إجمالي المسدد</div>
          <div className="font-mono font-bold text-sm text-emerald-400 mt-0.5">
            {party.totalPaidAmount.toFixed(2)} ر.س
          </div>
        </div>

        <div
          className={`rounded-xl p-2.5 border ${
            party.remainingBalance > 0
              ? isCustomer
                ? "bg-amber-950/25 border-amber-800/70"
                : "bg-rose-950/25 border-rose-800/70"
              : "bg-emerald-950/25 border-emerald-800/70"
          }`}
        >
          <div className="text-[10px] text-slate-400">
            {isCustomer ? "المتبقي على العميل" : "المتبقي للمستودع"}
          </div>
          <div
            className={`font-mono font-extrabold text-sm mt-0.5 ${
              party.remainingBalance > 0
                ? isCustomer
                  ? "text-amber-400"
                  : "text-rose-400"
                : "text-emerald-400"
            }`}
          >
            {party.remainingBalance.toFixed(2)} ر.س
          </div>
        </div>
      </div>
    </>
  );
};
