import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PartyAccountSummary,
  ShiftSummaryEntity,
} from "../../../domain/entities";
import { usePosStore } from "../../../application/store/usePosStore";
import { LedgerPaymentModal } from "./LedgerPaymentModal";
import {
  LedgerVoucherReceiptData,
  LedgerVoucherReceiptModal,
} from "./LedgerVoucherReceiptModal";
import {
  LedgerInvoiceItem,
  LedgerPartyStatement,
  LedgerPaymentItem,
  LedgerPurchaseInvoiceItem,
} from "./LedgerPartyStatement";
import { LedgerVouchersLog } from "./LedgerVouchersLog";
import {
  Users,
  Building2,
  Receipt,
  Search,
  Clock,
  CheckCircle2,
  Keyboard,
} from "lucide-react";

type LedgerScope = "customers" | "suppliers" | "vouchers";
type BalanceFilter = "ALL" | "OPEN" | "OVERDUE_30";

interface Props {
  customerAccounts: PartyAccountSummary[];
  supplierAccounts: PartyAccountSummary[];
  onRecordPayment: (
    partyType: "CUSTOMER" | "SUPPLIER",
    partyName: string,
    amount: number,
    notes?: string,
  ) => Promise<void>;
  invoices?: LedgerInvoiceItem[];
  purchaseInvoices?: LedgerPurchaseInvoiceItem[];
  ledgerPayments?: LedgerPaymentItem[];
  openShift?: ShiftSummaryEntity;
  canViewSuppliers?: boolean;
}

const getDebtAgeDays = (isoDate: string): number => {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
};

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
 * تبويب الذمم والآجل بتصميم القائمة + كشف الحساب (Master–Detail)
 * يضم ذمم العملاء، ذمم المستودعات (محمية بالصلاحيات)، وسجل السندات الموحد مع اختصارات الكيبورد
 */
export const LedgerAccountsSection: React.FC<Props> = ({
  customerAccounts,
  supplierAccounts,
  onRecordPayment,
  invoices,
  purchaseInvoices,
  ledgerPayments,
  openShift,
  canViewSuppliers,
}) => {
  // قراءات احتياطية آمنة من المتجر للحفاظ على التوافق الكامل مع أي استدعاء سابق
  const storeInvoices = usePosStore((s) => s.invoices);
  const storePurchaseInvoices = usePosStore((s) => s.purchaseInvoices);
  const storeLedgerPayments = usePosStore((s) => s.ledgerPayments);
  const storeShifts = usePosStore((s) => s.shifts);
  const storeCanViewCost = usePosStore(
    (s) => s.currentUser?.permissions.canViewCostAndProfit ?? false,
  );

  const resolvedInvoices = invoices ?? storeInvoices;
  const resolvedPurchaseInvoices = purchaseInvoices ?? storePurchaseInvoices;
  const resolvedLedgerPayments = ledgerPayments ?? storeLedgerPayments ?? [];
  const resolvedOpenShift = useMemo(
    () => openShift ?? storeShifts.find((s) => s.status === "OPEN"),
    [openShift, storeShifts],
  );
  const hasSuppliersAccess = canViewSuppliers ?? storeCanViewCost;

  const [activeScope, setActiveScope] = useState<LedgerScope>("customers");
  const [searchQuery, setSearchQuery] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("ALL");
  const [selectedPartyName, setSelectedPartyName] = useState<string | null>(
    null,
  );

  const [paymentParty, setPaymentParty] = useState<PartyAccountSummary | null>(
    null,
  );
  const [receiptVoucher, setReceiptVoucher] =
    useState<LedgerVoucherReceiptData | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // إغلاق آمن: العودة تلقائياً لذمم العملاء إذا تبدّل المستخدم لحساب لا يملك صلاحية ذمم المستودعات
  useEffect(() => {
    if (!hasSuppliersAccess && activeScope === "suppliers") {
      setActiveScope("customers");
    }
  }, [hasSuppliersAccess, activeScope]);

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
  const accessibleVouchersCount = useMemo(
    () =>
      hasSuppliersAccess
        ? resolvedLedgerPayments.length
        : resolvedLedgerPayments.filter((p) => p.partyType === "CUSTOMER")
            .length,
    [resolvedLedgerPayments, hasSuppliersAccess],
  );

  const activeSourceAccounts = useMemo(
    () => (activeScope === "suppliers" ? supplierAccounts : customerAccounts),
    [activeScope, customerAccounts, supplierAccounts],
  );

  const overdueCountInScope = useMemo(
    () =>
      activeSourceAccounts.filter(
        (acc) =>
          acc.remainingBalance > 0 &&
          getDebtAgeDays(acc.lastTransactionAt) > 30,
      ).length,
    [activeSourceAccounts],
  );

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortLedgerAccounts(
      activeSourceAccounts.filter((acc) => {
        if (balanceFilter === "OPEN" && acc.remainingBalance <= 0) return false;
        if (
          balanceFilter === "OVERDUE_30" &&
          (acc.remainingBalance <= 0 ||
            getDebtAgeDays(acc.lastTransactionAt) <= 30)
        ) {
          return false;
        }
        if (q && !acc.partyName.toLowerCase().includes(q)) return false;
        return true;
      }),
    );
  }, [activeSourceAccounts, searchQuery, balanceFilter]);

  // اختيار الطرف النشط تلقائياً مع تحديث بياناته اللحظية بعد أي سند
  const selectedAccount = useMemo<PartyAccountSummary | null>(() => {
    if (filteredAccounts.length === 0) return null;
    if (selectedPartyName) {
      const match = filteredAccounts.find(
        (acc) => acc.partyName === selectedPartyName,
      );
      if (match) return match;
    }
    return filteredAccounts[0];
  }, [filteredAccounts, selectedPartyName]);

  // تمرير البطاقة المحددة داخل القائمة تلقائياً عند التنقل بالأسهم
  useEffect(() => {
    if (!selectedAccount || activeScope === "vouchers") return;
    const btn = itemButtonRefs.current[selectedAccount.partyName];
    btn?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedAccount, activeScope]);

  // اختصارات «صفر ماوس»: ↑ و ↓ للتنقل، Enter لفتح السند، / أو F2 للبحث
  useEffect(() => {
    const isModalOpen = Boolean(paymentParty) || Boolean(receiptVoucher);
    if (isModalOpen || activeScope === "vouchers") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const target = e.target as HTMLElement | null;
      const isSearchInput = target === searchInputRef.current;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (e.key === "F2" || (e.key === "/" && !isEditable)) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (filteredAccounts.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (isEditable && !isSearchInput) return;
        e.preventDefault();

        const currentIndex = selectedAccount
          ? filteredAccounts.findIndex(
              (a) => a.partyName === selectedAccount.partyName,
            )
          : -1;
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const nextIndex =
          currentIndex === -1
            ? 0
            : (currentIndex + delta + filteredAccounts.length) %
              filteredAccounts.length;

        setSelectedPartyName(filteredAccounts[nextIndex].partyName);
        return;
      }

      if (e.key === "Enter") {
        if (
          target &&
          (target.tagName === "BUTTON" ||
            target.tagName === "A" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT")
        ) {
          return;
        }
        if (isEditable && !isSearchInput) return;
        if (selectedAccount && selectedAccount.remainingBalance > 0) {
          e.preventDefault();
          setPaymentParty(selectedAccount);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    paymentParty,
    receiptVoucher,
    activeScope,
    filteredAccounts,
    selectedAccount,
  ]);

  const handleSwitchScope = (nextScope: LedgerScope) => {
    setActiveScope(nextScope);
    setSelectedPartyName(null);
    setSearchQuery("");
  };

  const isSupplierScope = activeScope === "suppliers";

  return (
    <div className="space-y-4">
      {/* شريط المبدّل العلوي المدمج (العملاء / المستودعات / سجل السندات) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleSwitchScope("customers")}
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
              onClick={() => handleSwitchScope("suppliers")}
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
            onClick={() => handleSwitchScope("vouchers")}
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
            <span>Enter سند</span>
            <span>•</span>
            <span>F2 / بحث</span>
          </div>
        )}
      </div>

      {/* عرض سجل السندات الموحد أو شاشة القائمة + كشف الحساب (Master–Detail) */}
      {activeScope === "vouchers" ? (
        <LedgerVouchersLog
          ledgerPayments={resolvedLedgerPayments}
          canViewSuppliers={hasSuppliersAccess}
          onReprintVoucher={setReceiptVoucher}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* العمود الأيمن (~38%): قائمة الحسابات المدمجة مع البحث والفلاتر وعمر الدين */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3">
            {/* خانة البحث السريع */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isSupplierScope
                    ? "ابحث باسم المستودع... (F2 أو /)"
                    : "ابحث باسم العميل... (F2 أو /)"
                }
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl pr-9 pl-3 py-2 text-white outline-none"
              />
            </div>

            {/* فلاتر الحالة وعمر الدين */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  {
                    id: "ALL",
                    label: `الكل (${activeSourceAccounts.length})`,
                  },
                  {
                    id: "OPEN",
                    label: `مفتوحة (${
                      isSupplierScope ? openSuppliersCount : openCustomersCount
                    })`,
                  },
                  {
                    id: "OVERDUE_30",
                    label: `متأخرة +30 يوم (${overdueCountInScope})`,
                  },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setBalanceFilter(pill.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition ${
                    balanceFilter === pill.id
                      ? pill.id === "OVERDUE_30"
                        ? "bg-rose-950/70 border-rose-700 text-rose-300"
                        : isSupplierScope
                          ? "bg-purple-950/70 border-purple-700 text-purple-200"
                          : "bg-sky-950/70 border-sky-700 text-sky-200"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* قائمة بطاقات الأطراف */}
            {activeSourceAccounts.length === 0 ? (
              <div className="py-14 text-center text-slate-500">
                {isSupplierScope
                  ? "لا توجد فواتير شراء آجلة مستحقة للمستودعات حالياً."
                  : "لا توجد فواتير مبيعات آجلة مسجلة على العملاء حالياً."}
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                لا توجد حسابات مطابقة لخيارات البحث أو الفلترة الحالية.
              </div>
            ) : (
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-0.5">
                {filteredAccounts.map((acc) => {
                  const isSelected =
                    selectedAccount?.partyName === acc.partyName;
                  const ageDays = getDebtAgeDays(acc.lastTransactionAt);
                  const settledPercent =
                    acc.totalCreditAmount > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (acc.totalPaidAmount / acc.totalCreditAmount) * 100,
                          ),
                        )
                      : 100;

                  return (
                    <button
                      key={acc.partyName}
                      ref={(el) => {
                        itemButtonRefs.current[acc.partyName] = el;
                      }}
                      type="button"
                      onClick={() => setSelectedPartyName(acc.partyName)}
                      className={`w-full text-right rounded-xl p-3 border transition space-y-2 ${
                        isSelected
                          ? isSupplierScope
                            ? "bg-purple-950/35 border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.16)]"
                            : "bg-sky-950/35 border-sky-500 shadow-[0_0_12px_rgba(14,165,233,0.16)]"
                          : "bg-slate-950 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-white truncate">
                            {acc.partyName}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            {acc.remainingBalance > 0 ? (
                              <span
                                className={`inline-flex items-center gap-1 text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                                  ageDays > 60
                                    ? "bg-rose-950/70 border-rose-800 text-rose-300"
                                    : ageDays > 30
                                      ? "bg-amber-950/70 border-amber-800 text-amber-300"
                                      : "bg-emerald-950/50 border-emerald-800 text-emerald-300"
                                }`}
                              >
                                <Clock className="w-2.5 h-2.5" />
                                {ageDays === 0 ? "اليوم" : `${ageDays} يوم`}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300">
                                <CheckCircle2 className="w-2.5 h-2.5" /> مسدد
                              </span>
                            )}

                            <span className="text-[10px] text-slate-500 font-mono">
                              آجل: {acc.totalCreditAmount.toFixed(0)}
                            </span>
                          </div>
                        </div>

                        <div className="text-left shrink-0">
                          <div className="text-[9.5px] text-slate-400">
                            المتبقي
                          </div>
                          <div
                            className={`font-mono font-extrabold text-sm ${
                              acc.remainingBalance > 0
                                ? isSupplierScope
                                  ? "text-rose-400"
                                  : "text-amber-400"
                                : "text-emerald-400"
                            }`}
                          >
                            {acc.remainingBalance.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* شريط نسبة السداد الرفيع */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${settledPercent}%` }}
                          />
                        </div>
                        <span className="font-mono text-[9.5px] text-slate-400">
                          {settledPercent}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* العمود الأيسر (~62%): كشف الحساب التفاعلي للطرف المحدد */}
          <div className="lg:col-span-7">
            <LedgerPartyStatement
              party={selectedAccount}
              invoices={resolvedInvoices}
              purchaseInvoices={resolvedPurchaseInvoices}
              ledgerPayments={resolvedLedgerPayments}
              onOpenPayment={setPaymentParty}
              onReprintVoucher={setReceiptVoucher}
            />
          </div>
        </div>
      )}

      {/* نافذة تسجيل سند القبض / الصرف السريع */}
      <LedgerPaymentModal
        party={paymentParty}
        openShift={resolvedOpenShift}
        onClose={() => setPaymentParty(null)}
        onRecordPayment={onRecordPayment}
        onPaymentSuccess={(receipt, shouldPrint) => {
          if (shouldPrint) {
            setReceiptVoucher(receipt);
          }
        }}
      />

      {/* نافذة معاينة وطباعة السند الحراري (80mm) */}
      <LedgerVoucherReceiptModal
        voucher={receiptVoucher}
        onClose={() => setReceiptVoucher(null)}
      />
    </div>
  );
};
