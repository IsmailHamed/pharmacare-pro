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
import { FilterPillOption, FilterPills } from "../common/table/FilterPills";
import {
  SortAccessors,
  SortDirection,
  SortState,
  useTableSort,
} from "../common/table/useTableSort";
import { useTablePagination } from "../common/table/useTablePagination";
import { SortableTh } from "../common/table/SortableTh";
import { DataTableToolbar } from "../common/table/DataTableToolbar";
import { DataTableShell } from "../common/table/DataTableShell";
import { TableLoadMoreFooter } from "../common/table/TableLoadMoreFooter";
import {
  Users,
  Building2,
  Receipt,
  Clock,
  CheckCircle2,
  Keyboard,
  X,
  Eye,
  HandCoins,
} from "lucide-react";

type LedgerScope = "customers" | "suppliers" | "vouchers";
type BalanceFilter = "ALL" | "OPEN" | "OVERDUE_30";

// مفاتيح الأعمدة القابلة للفرز التفاعلي في جدول الذمم والآجل
type LedgerSortKey =
  | "partyName"
  | "debtAgeDays"
  | "lastTransactionAt"
  | "totalCreditAmount"
  | "totalPaidAmount"
  | "remainingBalance";

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

// دوال استخراج قيم الأعمدة للفرز (تُبقي الحسابات المسددة بالكامل في الأسفل عند الفرز حسب عمر الدين)
const LEDGER_SORT_ACCESSORS: SortAccessors<PartyAccountSummary, LedgerSortKey> =
  {
    partyName: (acc) => acc.partyName,
    debtAgeDays: (acc) =>
      acc.remainingBalance > 0 ? getDebtAgeDays(acc.lastTransactionAt) : null,
    lastTransactionAt: (acc) => new Date(acc.lastTransactionAt),
    totalCreditAmount: (acc) => acc.totalCreditAmount,
    totalPaidAmount: (acc) => acc.totalPaidAmount,
    remainingBalance: (acc) => acc.remainingBalance,
  };

// الترتيب الافتراضي للجدول (الأعلى رصيداً متبقياً أولاً) والاتجاه الابتدائي لكل عمود عند النقر الأول
const DEFAULT_LEDGER_SORT: SortState<LedgerSortKey> = {
  key: "remainingBalance",
  direction: "desc",
};

const LEDGER_DEFAULT_DIRECTIONS: Partial<Record<LedgerSortKey, SortDirection>> =
  {
    partyName: "asc",
    debtAgeDays: "desc",
    lastTransactionAt: "desc",
    totalCreditAmount: "desc",
    totalPaidAmount: "desc",
    remainingBalance: "desc",
  };

/**
 * تبويب الذمم والآجل بجدول كامل العرض (Full-Width Table)
 * النقر على أي عميل أو مستودع يفتح نافذة منبثقة (Modal) بكشف الحساب وتفاصيل العمليات،
 * ومبني على نواة الجداول الموحّدة (حبوب الفلترة، فرز الأعمدة، والتحميل التدريجي)
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
  const [highlightedPartyName, setHighlightedPartyName] = useState<
    string | null
  >(null);
  const [modalPartyName, setModalPartyName] = useState<string | null>(null);

  const [paymentParty, setPaymentParty] = useState<PartyAccountSummary | null>(
    null,
  );
  const [receiptVoucher, setReceiptVoucher] =
    useState<LedgerVoucherReceiptData | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  // إغلاق آمن: العودة تلقائياً لذمم العملاء إذا تبدّل المستخدم لحساب لا يملك صلاحية ذمم المستودعات
  useEffect(() => {
    if (!hasSuppliersAccess && activeScope === "suppliers") {
      setActiveScope("customers");
      setModalPartyName(null);
      setHighlightedPartyName(null);
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

  const isSupplierScope = activeScope === "suppliers";
  const scopeAccent = isSupplierScope ? "purple" : "sky";

  // خيارات حبوب فلتر حالة الرصيد الممرّرة إلى المكوّن الموحّد FilterPills
  const balanceFilterOptions = useMemo<FilterPillOption<BalanceFilter>[]>(
    () => [
      {
        id: "ALL",
        label: "الكل",
        count: activeSourceAccounts.length,
        tone: "slate",
      },
      {
        id: "OPEN",
        label: "مفتوحة",
        count: isSupplierScope ? openSuppliersCount : openCustomersCount,
        tone: scopeAccent,
        highlightWhenInactive: true,
      },
      {
        id: "OVERDUE_30",
        label: "متأخرة +30 يوم",
        count: overdueCountInScope,
        icon: Clock,
        tone: "rose",
        highlightWhenInactive: overdueCountInScope > 0,
      },
    ],
    [
      activeSourceAccounts.length,
      isSupplierScope,
      openSuppliersCount,
      openCustomersCount,
      scopeAccent,
      overdueCountInScope,
    ],
  );

  // تصفية الحسابات حسب حالة الرصيد وعبارة البحث
  const matchedAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeSourceAccounts.filter((acc) => {
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
    });
  }, [activeSourceAccounts, searchQuery, balanceFilter]);

  // تطبيق الفرز التفاعلي بالأعمدة على الحسابات المطابقة
  const {
    sortedItems: filteredAccounts,
    sortState,
    toggleSort,
    getSortDirection,
  } = useTableSort(matchedAccounts, {
    accessors: LEDGER_SORT_ACCESSORS,
    defaultSort: DEFAULT_LEDGER_SORT,
    defaultDirections: LEDGER_DEFAULT_DIRECTIONS,
  });

  // التحميل التدريجي للصفوف (50 حساباً في الدفعة) مع إعادة ضبط تلقائية عند تغيّر النطاق أو الفلاتر أو الفرز
  const pagination = useTablePagination(filteredAccounts, {
    pageSize: 50,
    resetDeps: [
      activeScope,
      searchQuery,
      balanceFilter,
      sortState?.key,
      sortState?.direction,
    ],
  });

  const visibleAccounts = pagination.visibleItems;

  // الصف المظلّل للتنقل السريع بالكيبورد ضمن الصفوف الظاهرة حالياً
  const highlightedAccount = useMemo<PartyAccountSummary | null>(() => {
    if (visibleAccounts.length === 0) return null;
    if (highlightedPartyName) {
      const match = visibleAccounts.find(
        (acc) => acc.partyName === highlightedPartyName,
      );
      if (match) return match;
    }
    return visibleAccounts[0];
  }, [visibleAccounts, highlightedPartyName]);

  // الطرف المفتوح داخل نافذة تفاصيل العمليات (يتحدث لحظياً بعد أي سند حتى لو أصبح الرصيد 0)
  const modalParty = useMemo<PartyAccountSummary | null>(() => {
    if (!modalPartyName) return null;
    return (
      activeSourceAccounts.find((acc) => acc.partyName === modalPartyName) ||
      null
    );
  }, [activeSourceAccounts, modalPartyName]);

  // تمرير الصف المحدد تلقائياً عند التنقل بالأسهم
  useEffect(() => {
    if (!highlightedAccount || activeScope === "vouchers") return;
    const row = rowRefs.current[highlightedAccount.partyName];
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightedAccount, activeScope]);

  // إغلاق نافذة تفاصيل العمليات بزر Escape (فقط عند عدم فتح نافذة السند أو الإيصال فوقها)
  useEffect(() => {
    if (!modalPartyName || paymentParty || receiptVoucher) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setModalPartyName(null);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [modalPartyName, paymentParty, receiptVoucher]);

  // اختصارات «صفر ماوس»: ↑ و ↓ للتنقل، Enter لفتح نافذة التفاصيل، / أو F2 للبحث
  useEffect(() => {
    const isModalOpen =
      Boolean(modalPartyName) ||
      Boolean(paymentParty) ||
      Boolean(receiptVoucher);
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

      if (visibleAccounts.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (isEditable && !isSearchInput) return;
        e.preventDefault();

        const currentIndex = highlightedAccount
          ? visibleAccounts.findIndex(
              (a) => a.partyName === highlightedAccount.partyName,
            )
          : -1;
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const nextIndex =
          currentIndex === -1
            ? 0
            : (currentIndex + delta + visibleAccounts.length) %
              visibleAccounts.length;

        setHighlightedPartyName(visibleAccounts[nextIndex].partyName);
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
        if (highlightedAccount) {
          e.preventDefault();
          setModalPartyName(highlightedAccount.partyName);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    modalPartyName,
    paymentParty,
    receiptVoucher,
    activeScope,
    visibleAccounts,
    highlightedAccount,
  ]);

  const handleSwitchScope = (nextScope: LedgerScope) => {
    setActiveScope(nextScope);
    setHighlightedPartyName(null);
    setModalPartyName(null);
    setSearchQuery("");
  };

  const hasActiveFilters =
    Boolean(searchQuery.trim()) || balanceFilter !== "ALL";

  const handleResetFilters = () => {
    setSearchQuery("");
    setBalanceFilter("ALL");
  };

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
            <span>Enter تفاصيل العمليات</span>
            <span>•</span>
            <span>F2 / بحث</span>
          </div>
        )}
      </div>

      {/* عرض سجل السندات الموحد أو جدول الحسابات بعرض الصفحة الكامل عبر نواة الجداول الموحّدة */}
      {activeScope === "vouchers" ? (
        <LedgerVouchersLog
          ledgerPayments={resolvedLedgerPayments}
          canViewSuppliers={hasSuppliersAccess}
          onReprintVoucher={setReceiptVoucher}
        />
      ) : (
        <DataTableShell
          totalCount={activeSourceAccounts.length}
          filteredCount={filteredAccounts.length}
          searchQuery={searchQuery}
          onResetFilters={hasActiveFilters ? handleResetFilters : undefined}
          stickyHeader
          emptyState={{
            icon: isSupplierScope ? Building2 : Users,
            title: isSupplierScope
              ? "لا توجد فواتير شراء آجلة مستحقة للمستودعات حالياً."
              : "لا توجد فواتير مبيعات آجلة مسجلة على العملاء حالياً.",
          }}
          noResultsState={{
            description:
              "لا توجد حسابات مطابقة لخيارات البحث أو الفلترة الحالية.",
          }}
          toolbar={
            <DataTableToolbar
              accent={scopeAccent}
              searchInputRef={searchInputRef}
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder={
                isSupplierScope
                  ? "ابحث باسم المستودع... (F2 أو /)"
                  : "ابحث باسم العميل... (F2 أو /)"
              }
              searchShortcutHint="F2"
              filters={
                <FilterPills
                  variant="chips"
                  options={balanceFilterOptions}
                  value={balanceFilter}
                  onChange={setBalanceFilter}
                  ariaLabel="تصفية حسابات الذمم حسب الحالة"
                />
              }
              hasActiveFilters={hasActiveFilters}
              onResetFilters={handleResetFilters}
              visibleCount={pagination.visibleCount}
              filteredCount={filteredAccounts.length}
              totalCount={activeSourceAccounts.length}
              itemLabel={isSupplierScope ? "مستودع" : "عميل"}
              metaExtra={
                <span className="text-[10.5px] text-slate-500 hidden sm:inline">
                  اضغط على رأس أي عمود للفرز، أو على الصف لفتح كشف الحساب
                </span>
              }
            />
          }
          header={
            <tr>
              <SortableTh
                direction={getSortDirection("partyName")}
                onSort={() => toggleSort("partyName")}
                accent={scopeAccent}
              >
                {isSupplierScope ? "اسم المستودع" : "اسم العميل"}
              </SortableTh>
              <SortableTh
                direction={getSortDirection("debtAgeDays")}
                onSort={() => toggleSort("debtAgeDays")}
                accent={scopeAccent}
              >
                الحالة وعمر الدين
              </SortableTh>
              <SortableTh
                direction={getSortDirection("lastTransactionAt")}
                onSort={() => toggleSort("lastTransactionAt")}
                accent={scopeAccent}
              >
                آخر حركة
              </SortableTh>
              <SortableTh
                direction={getSortDirection("totalCreditAmount")}
                onSort={() => toggleSort("totalCreditAmount")}
                accent={scopeAccent}
              >
                إجمالي الآجل
              </SortableTh>
              <SortableTh
                direction={getSortDirection("totalPaidAmount")}
                onSort={() => toggleSort("totalPaidAmount")}
                accent={scopeAccent}
              >
                إجمالي المسدد
              </SortableTh>
              <SortableTh
                direction={getSortDirection("remainingBalance")}
                onSort={() => toggleSort("remainingBalance")}
                accent={scopeAccent}
              >
                الرصيد المتبقي
              </SortableTh>
              <th className="py-2.5 px-3 text-left">إجراءات</th>
            </tr>
          }
          footer={
            <TableLoadMoreFooter
              visibleCount={pagination.visibleCount}
              totalCount={pagination.totalCount}
              remainingCount={pagination.remainingCount}
              pageSize={pagination.pageSize}
              hasMore={pagination.hasMore}
              onLoadMore={pagination.loadMore}
              onShowAll={pagination.showAll}
              itemLabel={isSupplierScope ? "مستودع" : "عميل"}
              accent={scopeAccent}
              showSummaryWhenComplete
            />
          }
        >
          {visibleAccounts.map((acc) => {
            const isHighlighted =
              highlightedAccount?.partyName === acc.partyName;
            const ageDays = getDebtAgeDays(acc.lastTransactionAt);

            return (
              <tr
                key={acc.partyName}
                ref={(el) => {
                  rowRefs.current[acc.partyName] = el;
                }}
                onClick={() => {
                  setHighlightedPartyName(acc.partyName);
                  setModalPartyName(acc.partyName);
                }}
                className={`cursor-pointer transition ${
                  isHighlighted
                    ? isSupplierScope
                      ? "bg-purple-950/30"
                      : "bg-sky-950/30"
                    : "bg-slate-950/40 hover:bg-slate-800/60"
                }`}
              >
                <td className="py-3 px-3 font-bold text-white">
                  {acc.partyName}
                </td>

                <td className="py-3 px-3">
                  {acc.remainingBalance > 0 ? (
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                        ageDays > 60
                          ? "bg-rose-950/70 border-rose-800 text-rose-300"
                          : ageDays > 30
                            ? "bg-amber-950/70 border-amber-800 text-amber-300"
                            : "bg-emerald-950/50 border-emerald-800 text-emerald-300"
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      {ageDays === 0 ? "اليوم" : `${ageDays} يوم`}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800 text-emerald-300">
                      <CheckCircle2 className="w-3 h-3" /> مسدد بالكامل
                    </span>
                  )}
                </td>

                <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                  {new Date(acc.lastTransactionAt).toLocaleDateString("ar-SA")}
                </td>

                <td className="py-3 px-3 font-mono text-slate-200">
                  {acc.totalCreditAmount.toFixed(2)} ر.س
                </td>

                <td className="py-3 px-3 font-mono text-emerald-400">
                  {acc.totalPaidAmount.toFixed(2)} ر.س
                </td>

                <td
                  className={`py-3 px-3 font-mono font-extrabold text-sm ${
                    acc.remainingBalance > 0
                      ? isSupplierScope
                        ? "text-rose-400"
                        : "text-amber-400"
                      : "text-emerald-400"
                  }`}
                >
                  {acc.remainingBalance.toFixed(2)} ر.س
                </td>

                <td className="py-3 px-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHighlightedPartyName(acc.partyName);
                        setModalPartyName(acc.partyName);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-[11px] inline-flex items-center gap-1 transition"
                    >
                      <Eye className="w-3.5 h-3.5 text-sky-400" />
                      التفاصيل
                    </button>

                    {acc.remainingBalance > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHighlightedPartyName(acc.partyName);
                          setPaymentParty(acc);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-white font-bold text-[11px] inline-flex items-center gap-1 transition ${
                          isSupplierScope
                            ? "bg-purple-600 hover:bg-purple-500"
                            : "bg-sky-600 hover:bg-sky-500"
                        }`}
                      >
                        <HandCoins className="w-3.5 h-3.5" />
                        {isSupplierScope ? "سند صرف" : "سند قبض"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTableShell>
      )}

      {/* نافذة تفاصيل العمليات وكشف الحساب التراكمي عند الضغط على صف العميل / المستودع */}
      {modalParty && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40 p-4 text-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModalPartyName(null);
            }
          }}
        >
          <div className="bg-slate-950 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {modalParty.partyType === "SUPPLIER" ? (
                  <Building2 className="w-4 h-4 text-purple-400 shrink-0" />
                ) : (
                  <Users className="w-4 h-4 text-sky-400 shrink-0" />
                )}
                <h3 className="font-bold text-white text-sm truncate">
                  تفاصيل العمليات وكشف حساب: {modalParty.partyName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalPartyName(null)}
                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg transition"
                title="إغلاق (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <LedgerPartyStatement
                party={modalParty}
                invoices={resolvedInvoices}
                purchaseInvoices={resolvedPurchaseInvoices}
                ledgerPayments={resolvedLedgerPayments}
                onOpenPayment={setPaymentParty}
                onReprintVoucher={setReceiptVoucher}
              />
            </div>
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
