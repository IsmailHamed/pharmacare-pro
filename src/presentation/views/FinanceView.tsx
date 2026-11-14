import React, { useMemo, useState } from "react";
import { usePosStore } from "../../application/store/usePosStore";
import { PartyAccountSummary } from "../../domain/entities";
import {
  Wallet,
  TrendingUp,
  Lock,
  PlusCircle,
  Users,
  Building2,
  HandCoins,
} from "lucide-react";

export const FinanceView: React.FC = () => {
  const {
    invoices,
    purchaseInvoices,
    expenses,
    shifts,
    ledgerPayments,
    addCashExpense,
    closeCurrentShift,
    openNewShift,
    recordLedgerPayment,
  } = usePosStore();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<
    "RENT" | "ELECTRICITY" | "SALARIES" | "SUPPLIES" | "OTHER"
  >("SUPPLIES");
  const [amount, setAmount] = useState(0);
  const [actualCash, setActualCash] = useState(0);
  const [pharmacist, setPharmacist] = useState("د. عمر الصيدلي");
  const [opening, setOpening] = useState(500);

  // حالة تسديد دفعة دين (سند قبض / سند صرف)
  const [selectedParty, setSelectedParty] =
    useState<PartyAccountSummary | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const openShift = shifts.find((s) => s.status === "OPEN");

  const totalSalesProfit = invoices
    .filter((i) => i.type === "SALE")
    .reduce((s, i) => s + (i.netProfit || 0), 0);

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  // تجميع حسابات ذمم العملاء (Accounts Receivable)
  const customerAccounts = useMemo<PartyAccountSummary[]>(() => {
    const map = new Map<string, PartyAccountSummary>();

    invoices
      .filter((inv) => inv.paymentMode === "CREDIT" && inv.type === "SALE")
      .forEach((inv) => {
        const name = inv.customerName.trim() || "عميل آجل عام";
        const current = map.get(name) || {
          partyName: name,
          partyType: "CUSTOMER",
          totalCreditAmount: 0,
          totalPaidAmount: 0,
          remainingBalance: 0,
          lastTransactionAt: inv.createdAt,
        };
        current.totalCreditAmount += inv.totalAmount;
        if (inv.createdAt > current.lastTransactionAt) {
          current.lastTransactionAt = inv.createdAt;
        }
        map.set(name, current);
      });

    (ledgerPayments || [])
      .filter((p) => p.partyType === "CUSTOMER")
      .forEach((p) => {
        const name = p.partyName.trim();
        const current = map.get(name) || {
          partyName: name,
          partyType: "CUSTOMER",
          totalCreditAmount: 0,
          totalPaidAmount: 0,
          remainingBalance: 0,
          lastTransactionAt: p.createdAt,
        };
        current.totalPaidAmount += p.amount;
        map.set(name, current);
      });

    return Array.from(map.values()).map((acc) => ({
      ...acc,
      remainingBalance: Number(
        Math.max(0, acc.totalCreditAmount - acc.totalPaidAmount).toFixed(2),
      ),
    }));
  }, [invoices, ledgerPayments]);

  // تجميع حسابات ذمم المستودعات والموردين (Accounts Payable)
  const supplierAccounts = useMemo<PartyAccountSummary[]>(() => {
    const map = new Map<string, PartyAccountSummary>();

    purchaseInvoices
      .filter((pur) => pur.paymentMode === "CREDIT")
      .forEach((pur) => {
        const name = pur.supplierName.trim() || "مستودع عام";
        const current = map.get(name) || {
          partyName: name,
          partyType: "SUPPLIER",
          totalCreditAmount: 0,
          totalPaidAmount: 0,
          remainingBalance: 0,
          lastTransactionAt: pur.createdAt,
        };
        current.totalCreditAmount += pur.totalAmount;
        if (pur.createdAt > current.lastTransactionAt) {
          current.lastTransactionAt = pur.createdAt;
        }
        map.set(name, current);
      });

    (ledgerPayments || [])
      .filter((p) => p.partyType === "SUPPLIER")
      .forEach((p) => {
        const name = p.partyName.trim();
        const current = map.get(name) || {
          partyName: name,
          partyType: "SUPPLIER",
          totalCreditAmount: 0,
          totalPaidAmount: 0,
          remainingBalance: 0,
          lastTransactionAt: p.createdAt,
        };
        current.totalPaidAmount += p.amount;
        map.set(name, current);
      });

    return Array.from(map.values()).map((acc) => ({
      ...acc,
      remainingBalance: Number(
        Math.max(0, acc.totalCreditAmount - acc.totalPaidAmount).toFixed(2),
      ),
    }));
  }, [purchaseInvoices, ledgerPayments]);

  const handleSettlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty) return;
    const val = Number(paymentAmount);
    if (val <= 0) return;
    await recordLedgerPayment(
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
    <div className="flex-1 p-6 overflow-y-auto bg-slate-950 text-slate-200 text-xs space-y-6">
      {/* ملخص الأرباح والصندوق والورديات */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> ملخص الأرباح
            الصافية والذمم
          </h3>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between">
            <span className="text-slate-400">إجمالي أرباح المبيعات:</span>
            <span className="font-mono font-bold text-emerald-400">
              {totalSalesProfit.toFixed(2)}
            </span>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between">
            <span className="text-slate-400">إجمالي المصاريف النثرية:</span>
            <span className="font-mono font-bold text-rose-400">
              -{totalExpenses.toFixed(2)}
            </span>
          </div>
          <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-800 flex justify-between">
            <span className="font-bold text-emerald-200">
              صافي الربح الفعلي:
            </span>
            <span className="font-mono font-extrabold text-base text-emerald-400">
              {(totalSalesProfit - totalExpenses).toFixed(2)}
            </span>
          </div>
        </div>

        {/* تسجيل مصروف نثري */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-400" /> تسجيل مصروفات الصيدلية
          </h3>
          <input
            type="text"
            placeholder="بيان المصروف (مثال: فاتورة كهرباء)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
            >
              <option value="SUPPLIES">مستلزمات وأكياس</option>
              <option value="ELECTRICITY">كهرباء ومياه</option>
              <option value="RENT">إيجار</option>
              <option value="SALARIES">رواتب</option>
              <option value="OTHER">أخرى</option>
            </select>
            <input
              type="number"
              placeholder="المبلغ"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
            />
          </div>
          <button
            onClick={() => {
              void addCashExpense(title, category, amount);
              setTitle("");
              setAmount(0);
            }}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-1"
          >
            <PlusCircle className="w-4 h-4" /> خصم من درج الكاشير
          </button>
        </div>

        {/* إدارة الوردية (Z-Report) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Lock className="w-4 h-4 text-sky-400" /> تسليم الوردية (Z-Report)
          </h3>
          {openShift ? (
            <>
              <div className="text-slate-300 space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  الصيدلي المناوب: <b>{openShift.pharmacistName}</b>
                </div>
                <div>
                  الرصيد الافتتاحي:{" "}
                  <b className="font-mono">{openShift.openingBalance}</b>
                </div>
                <div>
                  مبيعات نقدية + مقبوضات:{" "}
                  <b className="font-mono text-emerald-400">
                    {openShift.cashSalesTotal}
                  </b>
                </div>
                <div>
                  النقد المتوقع بالدرج:{" "}
                  <b className="font-mono text-amber-400">
                    {openShift.expectedDrawerCash}
                  </b>
                </div>
              </div>
              <input
                type="number"
                placeholder="أدخل النقد الفعلي الموجود في الدرج"
                value={actualCash || ""}
                onChange={(e) => setActualCash(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
              />
              <button
                onClick={() => void closeCurrentShift(actualCash)}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 rounded-lg"
              >
                إغلاق الوردية ومطابقة الصندوق
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={pharmacist}
                onChange={(e) => setPharmacist(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
              />
              <input
                type="number"
                value={opening}
                onChange={(e) => setOpening(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
              />
              <button
                onClick={() => void openNewShift(pharmacist, opening)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg"
              >
                فتح وردية جديدة
              </button>
            </div>
          )}
        </div>
      </div>

      {/* الخطوة 3: دفتر الديون وحسابات العملاء والمستودعات */}
      <div className="grid grid-cols-2 gap-6">
        {/* ذمم العملاء (Accounts Receivable) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" /> دفتر ديون العملاء
              (مبيعات آجلة)
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
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {customerAccounts.map((acc) => (
                <div
                  key={acc.partyName}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-white">{acc.partyName}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      إجمالي الآجل:{" "}
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
            <div className="space-y-2 max-h-64 overflow-y-auto">
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

      {/* نافذة تسجيل سند قبض / سند صرف لتسديد الديون */}
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
    </div>
  );
};
