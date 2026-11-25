import React, { useEffect, useMemo, useState } from "react";
import { usePosStore } from "../../application/store/usePosStore";
import { PartyAccountSummary } from "../../domain/entities";
import { ShiftZReportCard } from "../components/finance/ShiftZReportCard";
import { CashExpensesPanel } from "../components/finance/CashExpensesPanel";
import { LedgerAccountsSection } from "../components/finance/LedgerAccountsSection";
import { ClosedShiftsTable } from "../components/finance/ClosedShiftsTable";
import { InvoicesHistoryTab } from "../components/finance/InvoicesHistoryTab";
import {
  IncomeStatementSummary,
  IncomeStatementTab,
} from "../components/finance/IncomeStatementTab";
import {
  Wallet,
  Lock,
  Users,
  History,
  FileText,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type FinanceSubTab = "shift" | "ledger" | "archive" | "invoices" | "income";

export const FinanceView: React.FC = () => {
  // التحقق من صلاحية المستخدم الحالي للاطلاع على التكلفة وصافي الربح (القيمة الافتراضية الآمنة: false)
  const canViewCostAndProfit = usePosStore(
    (s) => s.currentUser?.permissions.canViewCostAndProfit ?? false,
  );
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

  const [activeSubTab, setActiveSubTab] = useState<FinanceSubTab>("shift");

  // إغلاق آمن: العودة تلقائياً لتبويب الوردية عند تبديل المستخدم لحساب لا يملك صلاحية رؤية التكلفة والأرباح
  useEffect(() => {
    if (!canViewCostAndProfit && activeSubTab === "income") {
      setActiveSubTab("shift");
    }
  }, [canViewCostAndProfit, activeSubTab]);

  const openShift = useMemo(
    () => shifts.find((s) => s.status === "OPEN"),
    [shifts],
  );
  const closedShifts = useMemo(
    () => shifts.filter((s) => s.status === "CLOSED"),
    [shifts],
  );

  // 1. حسابات قائمة الدخل المحاسبية (صافي المبيعات، تكلفة البضاعة المباعة COGS، وصافي الربح)
  const incomeStatement = useMemo<IncomeStatementSummary>(() => {
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

  // 2. تجميع حسابات ذمم العملاء (Accounts Receivable)
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

  // 3. تجميع حسابات ذمم المستودعات والموردين (Accounts Payable)
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

  // عدّاد حسابات الذمم المفتوحة وفق صلاحية المستخدم الحالي (العملاء فقط لغير المخولين بالمستودعات)
  const openLedgerCount = useMemo(() => {
    const openCustomers = customerAccounts.filter(
      (a) => a.remainingBalance > 0,
    ).length;
    if (!canViewCostAndProfit) return openCustomers;
    const openSuppliers = supplierAccounts.filter(
      (a) => a.remainingBalance > 0,
    ).length;
    return openCustomers + openSuppliers;
  }, [customerAccounts, supplierAccounts, canViewCostAndProfit]);

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-950 text-slate-200 text-xs">
      {/* الترويسة المدمجة + شارة حالة الوردية النشطة */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-purple-400" /> الصندوق، الورديات،
            والذمم المالية
          </h2>
          <p className="text-slate-400 mt-0.5">
            إدارة عهدة الدرج والمصروفات النثرية، سندات القبض والصرف، وأرشيف
            تقارير Z-Report.
          </p>
        </div>

        {openShift ? (
          <div className="bg-emerald-950/35 border border-emerald-800/80 rounded-xl px-3.5 py-2 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="leading-tight">
              <div className="text-[10px] text-emerald-300/80 font-bold">
                وردية مفتوحة • {openShift.pharmacistName}
              </div>
              <div className="text-xs text-white mt-0.5">
                النقد المتوقع بالدرج:{" "}
                <b className="font-mono text-amber-400">
                  {openShift.expectedDrawerCash.toFixed(2)} ر.س
                </b>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-950/35 border border-amber-800/80 rounded-xl px-3.5 py-2 flex items-center gap-2 text-amber-300 font-bold">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>الوردية مغلقة حالياً — افتح وردية لاستلام العهدة</span>
          </div>
        )}
      </div>

      {/* شريط التبويبات الداخلية */}
      <div className="mb-5 flex items-center gap-2 flex-wrap bg-slate-900 p-1.5 rounded-xl border border-slate-800 w-fit">
        <button
          type="button"
          onClick={() => setActiveSubTab("shift")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition ${
            activeSubTab === "shift"
              ? "bg-purple-600 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Lock className="w-4 h-4" />
          الوردية والمصروفات اليومية
          <span
            className={`w-2 h-2 rounded-full ${
              openShift ? "bg-emerald-400" : "bg-amber-400"
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("ledger")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition ${
            activeSubTab === "ledger"
              ? "bg-sky-600 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          الذمم والآجل
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
              activeSubTab === "ledger"
                ? "bg-sky-950/60 text-sky-100"
                : openLedgerCount > 0
                  ? "bg-amber-950 text-amber-300 border border-amber-800/70"
                  : "bg-slate-800 text-slate-400"
            }`}
          >
            {openLedgerCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("archive")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition ${
            activeSubTab === "archive"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <History className="w-4 h-4" />
          أرشيف الورديات (Z-Reports)
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
              activeSubTab === "archive"
                ? "bg-indigo-950/60 text-indigo-100"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            {closedShifts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("invoices")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition ${
            activeSubTab === "invoices"
              ? "bg-teal-600 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          سجل الفواتير
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
              activeSubTab === "invoices"
                ? "bg-teal-950/60 text-teal-100"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            {invoices.length}
          </span>
        </button>

        {canViewCostAndProfit && (
          <button
            type="button"
            onClick={() => setActiveSubTab("income")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition ${
              activeSubTab === "income"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            قائمة الدخل والأرباح
          </button>
        )}
      </div>

      {/* التبويب الأول: الوردية وجرد الدرج + المصروفات النثرية اليومية */}
      {activeSubTab === "shift" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <ShiftZReportCard
            openShift={openShift}
            lastClosedShift={closedShifts[0]}
            onCloseShift={closeCurrentShift}
            onOpenShift={openNewShift}
          />

          <CashExpensesPanel
            expenses={expenses}
            onAddExpense={addCashExpense}
            canViewCostAndProfit={canViewCostAndProfit}
            activeShiftId={openShift?.id}
          />
        </div>
      )}

      {/* التبويب الثاني: الذمم والآجل بنظام القائمة + كشف الحساب التفاعلي وسجل السندات */}
      {activeSubTab === "ledger" && (
        <LedgerAccountsSection
          customerAccounts={customerAccounts}
          supplierAccounts={supplierAccounts}
          onRecordPayment={recordLedgerPayment}
          invoices={invoices}
          purchaseInvoices={purchaseInvoices}
          ledgerPayments={ledgerPayments || []}
          openShift={openShift}
          canViewSuppliers={canViewCostAndProfit}
        />
      )}

      {/* التبويب الثالث: أرشيف الورديات المغلقة */}
      {activeSubTab === "archive" && (
        <ClosedShiftsTable closedShifts={closedShifts} />
      )}

      {/* التبويب الرابع: سجل فواتير المبيعات والمرتجعات بجدول كامل العرض قابل للتوسيع */}
      {activeSubTab === "invoices" && (
        <InvoicesHistoryTab invoices={invoices} />
      )}

      {/* التبويب الخامس: قائمة الدخل والأرباح المحاسبية (محمي بصلاحية canViewCostAndProfit) */}
      {canViewCostAndProfit && activeSubTab === "income" && (
        <IncomeStatementTab
          incomeStatement={incomeStatement}
          expenses={expenses}
        />
      )}
    </div>
  );
};
