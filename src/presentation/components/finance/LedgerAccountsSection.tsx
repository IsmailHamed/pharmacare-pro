import React, { useState } from "react";
import { PartyAccountSummary } from "../../../domain/entities";
import { Users, Building2, HandCoins } from "lucide-react";

interface Props {
  customerAccounts: PartyAccountSummary[];
  supplierAccounts: PartyAccountSummary[];
  onRecordPayment: (
    partyType: "CUSTOMER" | "SUPPLIER",
    partyName: string,
    amount: number,
    notes?: string,
  ) => Promise<void>;
}

export const LedgerAccountsSection: React.FC<Props> = ({
  customerAccounts,
  supplierAccounts,
  onRecordPayment,
}) => {
  const [selectedParty, setSelectedParty] =
    useState<PartyAccountSummary | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const handleSettlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty) return;
    const val = Number(paymentAmount);
    if (val <= 0) return;
    await onRecordPayment(
      selectedParty.partyType,
      selectedParty.partyName,
      val,
      paymentNotes,
    );
    setSelectedParty(null);
    setPaymentAmount("");
    setPaymentNotes("");
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-6">
        {/* ذمم العملاء (Accounts Receivable) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" /> دفتر ديون العملاء
              (مبيعات آجلة صافية)
            </h3>
            <span className="font-mono font-bold text-sky-400">
              إجمالي الديون:{" "}
              {customerAccounts
                .reduce((s, a) => s + a.remainingBalance, 0)
                .toFixed(2)}
            </span>
          </div>

          {customerAccounts.length === 0 ? (
            <div className="text-slate-500 py-6 text-center">
              لا توجد فواتير مبيعات آجلة مسجلة على العملاء حالياً.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {customerAccounts.map((acc) => (
                <div
                  key={acc.partyName}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-white">{acc.partyName}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      صافي الآجل:{" "}
                      <span className="font-mono">
                        {acc.totalCreditAmount.toFixed(2)}
                      </span>
                      {" | "}المدفوع:{" "}
                      <span className="font-mono text-emerald-400">
                        {acc.totalPaidAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <div className="text-[10px] text-slate-400">
                        المتبقي عليه
                      </div>
                      <div className="font-mono font-extrabold text-sm text-amber-400">
                        {acc.remainingBalance.toFixed(2)}
                      </div>
                    </div>
                    {acc.remainingBalance > 0 && (
                      <button
                        onClick={() => {
                          setSelectedParty(acc);
                          setPaymentAmount(String(acc.remainingBalance));
                        }}
                        className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
                      >
                        <HandCoins className="w-3.5 h-3.5" /> سند قبض
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ذمم المستودعات والموردين (Accounts Payable) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-400" /> ذمم المستودعات
              والموردين (مشتريات آجلة)
            </h3>
            <span className="font-mono font-bold text-purple-400">
              إجمالي المستحق للمستودعات:{" "}
              {supplierAccounts
                .reduce((s, a) => s + a.remainingBalance, 0)
                .toFixed(2)}
            </span>
          </div>

          {supplierAccounts.length === 0 ? (
            <div className="text-slate-500 py-6 text-center">
              لا توجد فواتير شراء آجلة مستحقة للمستودعات حالياً.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {supplierAccounts.map((acc) => (
                <div
                  key={acc.partyName}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-white">{acc.partyName}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      إجمالي الفواتير:{" "}
                      <span className="font-mono">
                        {acc.totalCreditAmount.toFixed(2)}
                      </span>
                      {" | "}المسدد:{" "}
                      <span className="font-mono text-emerald-400">
                        {acc.totalPaidAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <div className="text-[10px] text-slate-400">
                        المتبقي للمستودع
                      </div>
                      <div className="font-mono font-extrabold text-sm text-rose-400">
                        {acc.remainingBalance.toFixed(2)}
                      </div>
                    </div>
                    {acc.remainingBalance > 0 && (
                      <button
                        onClick={() => {
                          setSelectedParty(acc);
                          setPaymentAmount(String(acc.remainingBalance));
                        }}
                        className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
                      >
                        <HandCoins className="w-3.5 h-3.5" /> سند صرف
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* نافذة تسجيل سند قبض / سند صرف */}
      {selectedParty && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={(e) => void handleSettlePayment(e)}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-3 shadow-2xl"
          >
            <h3 className="font-bold text-sm text-white border-b border-slate-800 pb-2">
              {selectedParty.partyType === "CUSTOMER"
                ? `سند قبض دفعة من العميل: ${selectedParty.partyName}`
                : `سند صرف دفعة للمستودع: ${selectedParty.partyName}`}
            </h3>
            <div className="text-slate-400">
              الرصيد المتبقي الحالي:{" "}
              <b className="font-mono text-amber-400">
                {selectedParty.remainingBalance.toFixed(2)}
              </b>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">المبلغ المسدد</label>
              <input
                type="number"
                step="0.5"
                required
                max={selectedParty.remainingBalance}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">ملاحظات السند</label>
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="مثال: دفعة نقدية من الحساب الجاري"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg"
              >
                تأكيد السند وتحديث الرصيد
              </button>
              <button
                type="button"
                onClick={() => setSelectedParty(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-bold"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
