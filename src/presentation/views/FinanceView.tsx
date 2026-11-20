import React, { useMemo } from "react";
import { usePosStore } from "../../application/store/usePosStore";
import { PartyAccountSummary } from "../../domain/entities";
import { IncomeAndExpensesRow } from "../components/finance/IncomeAndExpensesRow";
import { ShiftZReportCard } from "../components/finance/ShiftZReportCard";
import { LedgerAccountsSection } from "../components/finance/LedgerAccountsSection";
import { ClosedShiftsTable } from "../components/finance/ClosedShiftsTable";

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

  const openShift = shifts.find((s) => s.status === "OPEN");
  const closedShifts = useMemo(
    () => shifts.filter((s) => s.status === "CLOSED"),
    [shifts],
  );

  // 1. حسابات قائمة الدخل المحاسبية (صافي المبيعات، تكلفة البضاعة المباعة COGS، وصافي الربح)
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

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-950 text-slate-200 text-xs space-y-6">
      {/* عرض الصف العلوي دائماً بـ 3 أعمدة:
          العمود 1 (قائمة الدخل المحمية بصلاحية canViewCostAndProfit)
          العمود 2 (نموذج تسجيل المصروفات النثرية للوردية)
          العمود 3 (بطاقة تسليم الوردية ومطابقة الصندوق Z-Report) */}
      <div className="grid grid-cols-3 gap-6">
        <IncomeAndExpensesRow
          incomeStatement={incomeStatement}
          expenses={expenses}
          onAddExpense={addCashExpense}
          canViewCostAndProfit={canViewCostAndProfit}
        />

        <ShiftZReportCard
          openShift={openShift}
          lastClosedShift={closedShifts[0]}
          onCloseShift={closeCurrentShift}
          onOpenShift={openNewShift}
        />
      </div>

      {/* دفتر ديون العملاء وذمم المستودعات */}
      <LedgerAccountsSection
        customerAccounts={customerAccounts}
        supplierAccounts={supplierAccounts}
        onRecordPayment={recordLedgerPayment}
      />

      {/* أرشيف الورديات المغلقة */}
      <ClosedShiftsTable closedShifts={closedShifts} />
    </div>
  );
};
