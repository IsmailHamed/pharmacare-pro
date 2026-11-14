import React, { useEffect, useMemo, useState } from "react";
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
  CheckCircle2,
  AlertOctagon,
  History,
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

  const [actualCash, setActualCash] = useState<string>("");
  const [safeDrop, setSafeDrop] = useState<string>("0");
  const [pharmacist, setPharmacist] = useState("د. عمر الصيدلي");
  const [opening, setOpening] = useState(500);

  // حالة تسديد دفعة دين (سند قبض / سند صرف)
  const [selectedParty, setSelectedParty] =
    useState<PartyAccountSummary | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const openShift = shifts.find((s) => s.status === "OPEN");
  const lastClosedShift = shifts.find((s) => s.status === "CLOSED");

  // عند إغلاق وردية، نقترح تلقائياً العهدة المرحلة منها كرصيد افتتاحي للوردية الجديدة
  useEffect(() => {
    if (!openShift && lastClosedShift?.nextShiftFloat !== undefined) {
      setOpening(lastClosedShift.nextShiftFloat);
    }
  }, [openShift, lastClosedShift]);

  // حسابات قائمة الدخل المحاسبية (صافي المبيعات، تكلفة البضاعة المباعة COGS، ومجمل وصافي الربح)
  const incomeStatement = useMemo(() => {
    let grossSales = 0;
    let totalReturns = 0;
    let netCogs = 0;

    invoices.forEach((inv) => {
      const cost = inv.totalCostAmount || 0;
      if (inv.type === "SALE") {
        grossSales += inv.totalAmount;
        netCogs += cost;
      } else if (inv.type === "RETURN") {
        totalReturns += inv.totalAmount;
        netCogs -= cost;
      }
    });

    const netRevenue = grossSales - totalReturns;
    const grossProfit = netRevenue - netCogs;
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const netOperatingProfit = grossProfit - totalExpenses;

    return {
      grossSales,
      totalReturns,
      netRevenue,
      netCogs,
      grossProfit,
      totalExpenses,
      netOperatingProfit,
    };
  }, [invoices, expenses]);

  // تجميع حسابات ذمم العملاء (Accounts Receivable) مع خصم المرتجعات الآجلة
  const customerAccounts = useMemo<PartyAccountSummary[]>(() => {
    const map = new Map<string, PartyAccountSummary>();

    invoices
      .filter((inv) => inv.paymentMode === "CREDIT")
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
        if (inv.type === "SALE") {
          current.totalCreditAmount += inv.totalAmount;
        } else if (inv.type === "RETURN") {
          // المرتجع الآجل يخفض أصل الدين على العميل
          current.totalCreditAmount = Math.max(
            0,
            current.totalCreditAmount - inv.totalAmount,
          );
        }
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

  // معاينة الفارق النقدي والعهدة المتبقية لحظياً قبل ضغط زر الإغلاق
  const actualCashNum = Number(actualCash || 0);
  const safeDropNum = Number(safeDrop || 0);
  const liveVariance = openShift
    ? Number((actualCashNum - openShift.expectedDrawerCash).toFixed(2))
    : 0;
  const liveNextFloat = Math.max(
    0,
    Number((actualCashNum - safeDropNum).toFixed(2)),
  );

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-950 text-slate-200 text-xs space-y-6">
      <div className="grid grid-cols-3 gap-6">
        {/* 1. قائمة الدخل والأرباح المحاسبية */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2.5">
          <h3 className="font-bold text-white text-sm flex items-center gap-2 pb-1 border-b border-slate-800">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> قائمة الدخل
            وصافي الربح المحاسبي
          </h3>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between">
            <span className="text-slate-400">صافي المبيعات (بعد المرتجع):</span>
            <span className="font-mono font-bold text-white">
              {incomeStatement.netRevenue.toFixed(2)}
            </span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between">
            <span className="text-slate-400">
              تكلفة البضاعة المباعة (COGS):
            </span>
            <span className="font-mono font-bold text-amber-400">
              -{incomeStatement.netCogs.toFixed(2)}
            </span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between">
            <span className="text-slate-300 font-bold">
              مجمل الربح التشغيلي (Gross Profit):
            </span>
            <span className="font-mono font-bold text-sky-400">
              {incomeStatement.grossProfit.toFixed(2)}
            </span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between">
            <span className="text-slate-400">المصاريف التشغيلية والنثرية:</span>
            <span className="font-mono font-bold text-rose-400">
              -{incomeStatement.totalExpenses.toFixed(2)}
            </span>
          </div>
          <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-800 flex justify-between">
            <span className="font-bold text-emerald-200">
              صافي الربح الفعلي (Net Profit):
            </span>
            <span className="font-mono font-extrabold text-base text-emerald-400">
              {incomeStatement.netOperatingProfit.toFixed(2)}
            </span>
          </div>
        </div>

        {/* 2. تسجيل مصروف نثري */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white text-sm flex items-center gap-2 pb-1 border-b border-slate-800">
            <Wallet className="w-4 h-4 text-amber-400" /> تسجيل مصروفات الصيدلية
          </h3>
          <input
            type="text"
            placeholder="بيان المصروف (مثال: فاتورة كهرباء / أكياس)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
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
              className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white font-mono"
            />
          </div>
          <button
            onClick={() => {
              void addCashExpense(title, category, amount);
              setTitle("");
              setAmount(0);
            }}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-1"
          >
            <PlusCircle className="w-4 h-4" /> خصم من درج الكاشير
          </button>

          {expenses.length > 0 && (
            <div className="pt-2 space-y-1.5 max-h-28 overflow-y-auto">
              <div className="text-[11px] text-slate-400 font-bold">
                آخر المصروفات المسجلة:
              </div>
              {expenses.slice(0, 4).map((exp) => (
                <div
                  key={exp.id}
                  className="flex justify-between text-[11px] bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800"
                >
                  <span>{exp.title}</span>
                  <span className="font-mono text-rose-400">
                    -{exp.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. إدارة وتسليم الوردية المحاسبي (Z-Report) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white text-sm flex items-center gap-2 pb-1 border-b border-slate-800">
            <Lock className="w-4 h-4 text-sky-400" /> تسليم الوردية ومطابقة
            الصندوق (Z-Report)
          </h3>
          {openShift ? (
            <>
              <div className="text-slate-300 space-y-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px]">
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span>الصيدلي المناوب:</span>
                  <b className="text-white">{openShift.pharmacistName}</b>
                </div>
                <div className="flex justify-between">
                  <span>(+) الرصيد الافتتاحي (العهدة):</span>
                  <b className="font-mono">
                    {openShift.openingBalance.toFixed(2)}
                  </b>
                </div>
                <div className="flex justify-between">
                  <span>(+) مبيعات نقدية (Cash Sales):</span>
                  <b className="font-mono text-emerald-400">
                    +{openShift.cashSalesTotal.toFixed(2)}
                  </b>
                </div>
                <div className="flex justify-between">
                  <span>(+) مقبوضات ديون عملاء (سندات قبض):</span>
                  <b className="font-mono text-emerald-400">
                    +{(openShift.debtCollectionsTotal || 0).toFixed(2)}
                  </b>
                </div>
                <div className="flex justify-between">
                  <span>(-) مرتجعات نقدية (Cash Returns):</span>
                  <b className="font-mono text-rose-400">
                    -{openShift.returnsTotal.toFixed(2)}
                  </b>
                </div>
                <div className="flex justify-between">
                  <span>(-) مصاريف نثرية + مشتريات نقدية:</span>
                  <b className="font-mono text-rose-400">
                    -
                    {(
                      openShift.pettyCashTotal +
                      (openShift.cashPurchasesTotal || 0)
                    ).toFixed(2)}
                  </b>
                </div>
                <div className="flex justify-between">
                  <span>(-) دفعات نقدية للمستودعات (سندات صرف):</span>
                  <b className="font-mono text-rose-400">
                    -{(openShift.supplierPaymentsTotal || 0).toFixed(2)}
                  </b>
                </div>

                <div className="flex justify-between pt-1.5 border-t border-slate-800 text-xs font-extrabold">
                  <span className="text-amber-300">
                    (=) النقد المتوقع بالدرج:
                  </span>
                  <span className="font-mono text-amber-400">
                    {openShift.expectedDrawerCash.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between pt-1 text-[10px] text-slate-400 border-t border-dashed border-slate-800">
                  <span>مبيعات آجلة (خارج الدرج):</span>
                  <span className="font-mono">
                    {openShift.creditSalesTotal.toFixed(2)} (مرتجع آجل:{" "}
                    {(openShift.creditReturnsTotal || 0).toFixed(2)})
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    النقد الفعلي المعدود بالدرج *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="أدخل الجرد الفعلي"
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    المورّد للخزنة (Safe Drop)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="0.00"
                    value={safeDrop}
                    onChange={(e) => setSafeDrop(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              {actualCash !== "" && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    {liveVariance === 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertOctagon className="w-4 h-4 text-rose-400" />
                    )}
                    <span>
                      الفارق:{" "}
                      <b
                        className={`font-mono ${
                          liveVariance === 0
                            ? "text-emerald-400"
                            : liveVariance > 0
                              ? "text-sky-400"
                              : "text-rose-400"
                        }`}
                      >
                        {liveVariance > 0
                          ? `+${liveVariance.toFixed(2)} (فائض)`
                          : liveVariance < 0
                            ? `${liveVariance.toFixed(2)} (عجز)`
                            : "0.00 (مطابق)"}
                      </b>
                    </span>
                  </div>
                  <span className="text-slate-400">
                    عهدة مرحلة:{" "}
                    <b className="font-mono text-white">
                      {liveNextFloat.toFixed(2)}
                    </b>
                  </span>
                </div>
              )}

              <button
                onClick={() => {
                  if (actualCash === "") {
                    alert("يرجى إدخال النقد الفعلي الموجود في الدرج أولاً.");
                    return;
                  }
                  void closeCurrentShift(actualCashNum, safeDropNum);
                  setActualCash("");
                  setSafeDrop("0");
                }}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-lg"
              >
                إغلاق الوردية واعتماد تقرير Z-Report
              </button>
            </>
          ) : (
            <div className="space-y-2.5">
              <div className="p-2.5 bg-amber-950/30 border border-amber-800/70 rounded-xl text-amber-200 text-[11px]">
                الوردية مغلقة حالياً. قم بفتح وردية جديدة لبدء استلام العهدة.
              </div>
              <div>
                <label className="block text-slate-400 mb-1">
                  اسم الصيدلي المستلم
                </label>
                <input
                  type="text"
                  value={pharmacist}
                  onChange={(e) => setPharmacist(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">
                  الرصيد الافتتاحي (العهدة المرحلة للدرج)
                </label>
                <input
                  type="number"
                  value={opening}
                  onChange={(e) => setOpening(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
                />
              </div>
              <button
                onClick={() => void openNewShift(pharmacist, opening)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg"
              >
                فتح وردية جديدة واستلام العهدة
              </button>
            </div>
          )}
        </div>
      </div>

      {/* دفتر الديون وحسابات العملاء والمستودعات */}
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

      {/* أرشيف الورديات المغلقة سابقاً (Z-Reports History) */}
      {shifts.filter((s) => s.status === "CLOSED").length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" /> سجل تقارير تسليم
            الورديات السابقة (Z-Reports Archive)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-[11px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2">رقم الوردية</th>
                  <th className="py-2">الصيدلي</th>
                  <th className="py-2">العهدة الافتتاحية</th>
                  <th className="py-2">مبيعات الكاش</th>
                  <th className="py-2">النقد المتوقع</th>
                  <th className="py-2">الجرد الفعلي</th>
                  <th className="py-2">الفارق (Variance)</th>
                  <th className="py-2">المورّد للخزنة</th>
                  <th className="py-2">العهدة المرحلة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {shifts
                  .filter((s) => s.status === "CLOSED")
                  .map((s) => (
                    <tr key={s.id}>
                      <td className="py-2 font-bold text-white">{s.id}</td>
                      <td className="py-2 font-sans">{s.pharmacistName}</td>
                      <td className="py-2">{s.openingBalance.toFixed(2)}</td>
                      <td className="py-2 text-emerald-400">
                        {s.cashSalesTotal.toFixed(2)}
                      </td>
                      <td className="py-2 text-amber-400">
                        {s.expectedDrawerCash.toFixed(2)}
                      </td>
                      <td className="py-2 font-bold text-white">
                        {(s.actualDrawerCash ?? 0).toFixed(2)}
                      </td>
                      <td
                        className={`py-2 font-bold ${
                          (s.variance || 0) < 0
                            ? "text-rose-400"
                            : (s.variance || 0) > 0
                              ? "text-sky-400"
                              : "text-emerald-400"
                        }`}
                      >
                        {(s.variance || 0) > 0
                          ? `+${(s.variance || 0).toFixed(2)}`
                          : (s.variance || 0).toFixed(2)}
                      </td>
                      <td className="py-2 text-purple-400">
                        {(s.safeDropAmount || 0).toFixed(2)}
                      </td>
                      <td className="py-2 text-slate-300">
                        {(s.nextShiftFloat || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
