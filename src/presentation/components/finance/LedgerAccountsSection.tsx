import React, { useEffect, useMemo, useState } from "react";
import { PartyAccountSummary } from "../../../domain/entities";
import {
  Users,
  Building2,
  HandCoins,
  Search,
  Filter,
  CheckCircle2,
  X,
} from "lucide-react";

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

const sortLedgerAccounts = (
  accounts: PartyAccountSummary[],
): PartyAccountSummary[] =>
  [...accounts].sort((a, b) => {
    if (b.remainingBalance !== a.remainingBalance) {
      return b.remainingBalance - a.remainingBalance;
    }
    return b.lastTransactionAt.localeCompare(a.lastTransactionAt);
  });

/**
 * تبويب الذمم والآجل: دفتر ديون العملاء (Accounts Receivable) وذمم المستودعات والموردين (Accounts Payable)
 * مع بحث فوري وفلترة الأرصدة المفتوحة ونافذة سند القبض/الصرف
 */
export const LedgerAccountsSection: React.FC<Props> = ({
  customerAccounts,
  supplierAccounts,
  onRecordPayment,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyOpenBalances, setOnlyOpenBalances] = useState(false);

  const [selectedParty, setSelectedParty] =
    useState<PartyAccountSummary | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // إغلاق نافذة السند عبر مفتاح Escape
  useEffect(() => {
    if (!selectedParty) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        setSelectedParty(null);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [selectedParty, isSubmitting]);

  const totalReceivables = useMemo(
    () => customerAccounts.reduce((s, a) => s + a.remainingBalance, 0),
    [customerAccounts],
  );

  const totalPayables = useMemo(
    () => supplierAccounts.reduce((s, a) => s + a.remainingBalance, 0),
    [supplierAccounts],
  );

  const openCustomersCount = useMemo(
    () => customerAccounts.filter((a) => a.remainingBalance > 0).length,
    [customerAccounts],
  );

  const openSuppliersCount = useMemo(
    () => supplierAccounts.filter((a) => a.remainingBalance > 0).length,
    [supplierAccounts],
  );

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortLedgerAccounts(
      customerAccounts.filter((acc) => {
        if (onlyOpenBalances && acc.remainingBalance <= 0) return false;
        if (q && !acc.partyName.toLowerCase().includes(q)) return false;
        return true;
      }),
    );
  }, [customerAccounts, searchQuery, onlyOpenBalances]);

  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortLedgerAccounts(
      supplierAccounts.filter((acc) => {
        if (onlyOpenBalances && acc.remainingBalance <= 0) return false;
        if (q && !acc.partyName.toLowerCase().includes(q)) return false;
        return true;
      }),
    );
  }, [supplierAccounts, searchQuery, onlyOpenBalances]);

  const handleOpenVoucher = (acc: PartyAccountSummary) => {
    setSelectedParty(acc);
    setPaymentAmount(String(acc.remainingBalance));
    setPaymentNotes("");
  };

  const handleSettlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty || isSubmitting) return;
    const val = Number(paymentAmount);
    if (!Number.isFinite(val) || val <= 0) return;

    setIsSubmitting(true);
    try {
      await onRecordPayment(
        selectedParty.partyType,
        selectedParty.partyName,
        val,
        paymentNotes.trim() || undefined,
      );
      setSelectedParty(null);
      setPaymentAmount("");
      setPaymentNotes("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* شريط الملخص والبحث والفلترة */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث في الذمم باسم العميل أو المستودع..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl pr-9 pl-3 py-2 text-white outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setOnlyOpenBalances((prev) => !prev)}
            className={`px-3 py-2 rounded-xl border font-bold flex items-center gap-1.5 transition ${
              onlyOpenBalances
                ? "bg-amber-950/60 border-amber-700 text-amber-300"
                : "bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {onlyOpenBalances ? "الأرصدة المفتوحة فقط" : "عرض جميع الحسابات"}
          </button>

          <div className="bg-sky-950/35 border border-sky-800/70 rounded-xl px-3 py-1.5 text-center">
            <div className="text-[10px] text-sky-300/80">
              لنا عند العملاء ({openCustomersCount})
            </div>
            <div className="font-mono font-extrabold text-sky-400">
              {totalReceivables.toFixed(2)} ر.س
            </div>
          </div>

          <div className="bg-purple-950/35 border border-purple-800/70 rounded-xl px-3 py-1.5 text-center">
            <div className="text-[10px] text-purple-300/80">
              علينا للمستودعات ({openSuppliersCount})
            </div>
            <div className="font-mono font-extrabold text-purple-400">
              {totalPayables.toFixed(2)} ر.س
            </div>
          </div>
        </div>
      </div>

      {/* جدولا العملاء والمستودعات بملء ارتفاع التبويب */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* ذمم العملاء (Accounts Receivable) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" /> دفتر ديون العملاء
              (مبيعات آجلة صافية)
            </h3>
            <span className="font-mono font-bold text-sky-400">
              {filteredCustomers.length} حساب
            </span>
          </div>

          {customerAccounts.length === 0 ? (
            <div className="text-slate-500 py-10 text-center">
              لا توجد فواتير مبيعات آجلة مسجلة على العملاء حالياً.
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-slate-500 py-8 text-center">
              لا توجد حسابات عملاء مطابقة للبحث أو الفلترة الحالية.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCustomers.map((acc) => (
                <div
                  key={acc.partyName}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex items-center justify-between gap-3 transition"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate">
                      {acc.partyName}
                    </div>
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
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      آخر حركة:{" "}
                      {new Date(acc.lastTransactionAt).toLocaleDateString(
                        "ar-SA",
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-left">
                      <div className="text-[10px] text-slate-400">
                        المتبقي عليه
                      </div>
                      <div
                        className={`font-mono font-extrabold text-sm ${
                          acc.remainingBalance > 0
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {acc.remainingBalance.toFixed(2)}
                      </div>
                    </div>
                    {acc.remainingBalance > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleOpenVoucher(acc)}
                        className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                      >
                        <HandCoins className="w-3.5 h-3.5" /> سند قبض
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-[10px] font-bold px-2 py-1 rounded-lg">
                        <CheckCircle2 className="w-3 h-3" /> مسدد
                      </span>
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
              {filteredSuppliers.length} مستودع
            </span>
          </div>

          {supplierAccounts.length === 0 ? (
            <div className="text-slate-500 py-10 text-center">
              لا توجد فواتير شراء آجلة مستحقة للمستودعات حالياً.
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-slate-500 py-8 text-center">
              لا توجد حسابات مستودعات مطابقة للبحث أو الفلترة الحالية.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSuppliers.map((acc) => (
                <div
                  key={acc.partyName}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex items-center justify-between gap-3 transition"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate">
                      {acc.partyName}
                    </div>
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
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      آخر حركة:{" "}
                      {new Date(acc.lastTransactionAt).toLocaleDateString(
                        "ar-SA",
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-left">
                      <div className="text-[10px] text-slate-400">
                        المتبقي للمستودع
                      </div>
                      <div
                        className={`font-mono font-extrabold text-sm ${
                          acc.remainingBalance > 0
                            ? "text-rose-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {acc.remainingBalance.toFixed(2)}
                      </div>
                    </div>
                    {acc.remainingBalance > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleOpenVoucher(acc)}
                        className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                      >
                        <HandCoins className="w-3.5 h-3.5" /> سند صرف
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-[10px] font-bold px-2 py-1 rounded-lg">
                        <CheckCircle2 className="w-3 h-3" /> مسدد
                      </span>
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
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) {
              setSelectedParty(null);
            }
          }}
        >
          <form
            onSubmit={(e) => void handleSettlePayment(e)}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-3 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-white">
                {selectedParty.partyType === "CUSTOMER"
                  ? `سند قبض دفعة من العميل: ${selectedParty.partyName}`
                  : `سند صرف دفعة للمستودع: ${selectedParty.partyName}`}
              </h3>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setSelectedParty(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-slate-400">
              الرصيد المتبقي الحالي:{" "}
              <b className="font-mono text-amber-400">
                {selectedParty.remainingBalance.toFixed(2)} ر.س
              </b>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">المبلغ المسدد</label>
              <input
                type="number"
                step="any"
                min={0.01}
                required
                autoFocus
                max={selectedParty.remainingBalance}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-lg p-2 text-white font-mono outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">ملاحظات السند</label>
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="مثال: دفعة نقدية من الحساب الجاري"
                className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-lg p-2 text-white outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || Number(paymentAmount) <= 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold py-2 rounded-lg transition"
              >
                {isSubmitting ? "جارٍ الترحيل..." : "تأكيد السند وتحديث الرصيد"}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setSelectedParty(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold transition"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
