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
  LedgerPaymentItem,
  LedgerPurchaseInvoiceItem,
} from "./LedgerPartyStatement";
import { getDebtAgeDays } from "./statement/ledgerStatement.config";
import { LedgerVouchersLog } from "./LedgerVouchersLog";
import { FilterPills } from "../common/table/FilterPills";
import { useTableSort } from "../common/table/useTableSort";
import { useTablePagination } from "../common/table/useTablePagination";
import { useTableColumns } from "../common/table/useTableColumns";
import { ColumnVisibilityMenu } from "../common/table/ColumnVisibilityMenu";
import { TableExportButton } from "../common/table/TableExportButton";
import { SortableTh } from "../common/table/SortableTh";
import { DataTableToolbar } from "../common/table/DataTableToolbar";
import { DataTableShell } from "../common/table/DataTableShell";
import { TableLoadMoreFooter } from "../common/table/TableLoadMoreFooter";
import {
  BalanceFilter,
  DEFAULT_LEDGER_SORT,
  LEDGER_DEFAULT_DIRECTIONS,
  LEDGER_SORT_ACCESSORS,
  LedgerScope,
  getBalanceFilterOptions,
  getLedgerExportColumns,
  getLedgerTableColumns,
} from "./accounts/ledgerAccounts.config";
import { LedgerScopeBar } from "./accounts/LedgerScopeBar";
import { LedgerPartyStatementModal } from "./accounts/LedgerPartyStatementModal";
import {
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  HandCoins,
  Users,
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
  invoices?: LedgerInvoiceItem[];
  purchaseInvoices?: LedgerPurchaseInvoiceItem[];
  ledgerPayments?: LedgerPaymentItem[];
  openShift?: ShiftSummaryEntity;
  canViewSuppliers?: boolean;
}

/**
 * تبويب الذمم والآجل بجدول كامل العرض (Full-Width Table)
 * النقر على أي عميل أو مستودع يفتح نافذة منبثقة (Modal) بكشف الحساب وتفاصيل العمليات،
 * ومبني على نواة الجداول الموحّدة (حبوب الفلترة، فرز الأعمدة، إظهار/إخفاء الأعمدة، والتصدير)
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
  const scopeAccent: "purple" | "sky" = isSupplierScope ? "purple" : "sky";

  const ledgerColumns = useMemo(
    () => getLedgerTableColumns(isSupplierScope),
    [isSupplierScope],
  );

  // حفظ تفضيلات الأعمدة لكل نطاق (عملاء / مستودعات) بشكل مستقل في localStorage
  const columnsState = useTableColumns(
    isSupplierScope ? "ledger_suppliers" : "ledger_customers",
    ledgerColumns,
  );

  const exportColumns = useMemo(
    () => getLedgerExportColumns(isSupplierScope),
    [isSupplierScope],
  );

  const balanceFilterOptions = useMemo(
    () =>
      getBalanceFilterOptions({
        totalCount: activeSourceAccounts.length,
        openCount: isSupplierScope ? openSuppliersCount : openCustomersCount,
        overdueCount: overdueCountInScope,
        scopeAccent,
      }),
    [
      activeSourceAccounts.length,
      isSupplierScope,
      openSuppliersCount,
      openCustomersCount,
      overdueCountInScope,
      scopeAccent,
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

  // تطبيق الفرز التفاعلي بالأعمدة على الحسابات المطابقة (يُستخدم أيضاً لترتيب ملف التصدير)
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
      <LedgerScopeBar
        activeScope={activeScope}
        hasSuppliersAccess={hasSuppliersAccess}
        openCustomersCount={openCustomersCount}
        totalReceivables={totalReceivables}
        openSuppliersCount={openSuppliersCount}
        totalPayables={totalPayables}
        accessibleVouchersCount={accessibleVouchersCount}
        onSwitchScope={handleSwitchScope}
      />

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
              actions={
                <>
                  <ColumnVisibilityMenu
                    columnsState={columnsState}
                    accent={scopeAccent}
                  />
                  <TableExportButton
                    items={filteredAccounts}
                    columns={exportColumns}
                    isColumnVisible={columnsState.isVisible}
                    fileNamePrefix={
                      isSupplierScope ? "Suppliers_Ledger" : "Customers_Ledger"
                    }
                    itemLabel={isSupplierScope ? "مستودع" : "عميل"}
                  />
                </>
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
              {columnsState.isVisible("partyName") && (
                <SortableTh
                  direction={getSortDirection("partyName")}
                  onSort={() => toggleSort("partyName")}
                  accent={scopeAccent}
                >
                  {isSupplierScope ? "اسم المستودع" : "اسم العميل"}
                </SortableTh>
              )}
              {columnsState.isVisible("debtAgeDays") && (
                <SortableTh
                  direction={getSortDirection("debtAgeDays")}
                  onSort={() => toggleSort("debtAgeDays")}
                  accent={scopeAccent}
                >
                  الحالة وعمر الدين
                </SortableTh>
              )}
              {columnsState.isVisible("lastTransactionAt") && (
                <SortableTh
                  direction={getSortDirection("lastTransactionAt")}
                  onSort={() => toggleSort("lastTransactionAt")}
                  accent={scopeAccent}
                >
                  آخر حركة
                </SortableTh>
              )}
              {columnsState.isVisible("totalCreditAmount") && (
                <SortableTh
                  direction={getSortDirection("totalCreditAmount")}
                  onSort={() => toggleSort("totalCreditAmount")}
                  accent={scopeAccent}
                >
                  إجمالي الآجل
                </SortableTh>
              )}
              {columnsState.isVisible("totalPaidAmount") && (
                <SortableTh
                  direction={getSortDirection("totalPaidAmount")}
                  onSort={() => toggleSort("totalPaidAmount")}
                  accent={scopeAccent}
                >
                  إجمالي المسدد
                </SortableTh>
              )}
              {columnsState.isVisible("remainingBalance") && (
                <SortableTh
                  direction={getSortDirection("remainingBalance")}
                  onSort={() => toggleSort("remainingBalance")}
                  accent={scopeAccent}
                >
                  الرصيد المتبقي
                </SortableTh>
              )}
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
                {columnsState.isVisible("partyName") && (
                  <td className="py-3 px-3 font-bold text-white">
                    {acc.partyName}
                  </td>
                )}

                {columnsState.isVisible("debtAgeDays") && (
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
                )}

                {columnsState.isVisible("lastTransactionAt") && (
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                    {new Date(acc.lastTransactionAt).toLocaleDateString(
                      "ar-SA",
                    )}
                  </td>
                )}

                {columnsState.isVisible("totalCreditAmount") && (
                  <td className="py-3 px-3 font-mono text-slate-200">
                    {acc.totalCreditAmount.toFixed(2)} ر.س
                  </td>
                )}

                {columnsState.isVisible("totalPaidAmount") && (
                  <td className="py-3 px-3 font-mono text-emerald-400">
                    {acc.totalPaidAmount.toFixed(2)} ر.س
                  </td>
                )}

                {columnsState.isVisible("remainingBalance") && (
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
                )}

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

      {/* نافذة تفاصيل العمليات وكشف الحساب التراكمي */}
      <LedgerPartyStatementModal
        party={modalParty}
        invoices={resolvedInvoices}
        purchaseInvoices={resolvedPurchaseInvoices}
        ledgerPayments={resolvedLedgerPayments}
        onClose={() => setModalPartyName(null)}
        onOpenPayment={setPaymentParty}
        onReprintVoucher={setReceiptVoucher}
      />

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
