import React, { useEffect, useMemo, useState } from "react";
import { LedgerPaymentItem } from "./LedgerPartyStatement";
import { LedgerVoucherReceiptData } from "./LedgerVoucherReceiptModal";
import {
  DEFAULT_DATE_RANGE,
  DateRangeValue,
  isDateRangeActive,
  matchesDateRange,
} from "../common/table/dateRangeUtils";
import { DateRangeFilter } from "../common/table/DateRangeFilter";
import { FilterPillOption, FilterPills } from "../common/table/FilterPills";
import {
  SortAccessors,
  SortDirection,
  SortState,
  useTableSort,
} from "../common/table/useTableSort";
import { useTablePagination } from "../common/table/useTablePagination";
import {
  TableColumnDef,
  useTableColumns,
} from "../common/table/useTableColumns";
import { ColumnVisibilityMenu } from "../common/table/ColumnVisibilityMenu";
import {
  TableExportButton,
  TableExportColumn,
} from "../common/table/TableExportButton";
import { SortableTh } from "../common/table/SortableTh";
import { DataTableToolbar } from "../common/table/DataTableToolbar";
import { DataTableShell } from "../common/table/DataTableShell";
import { TableLoadMoreFooter } from "../common/table/TableLoadMoreFooter";
import {
  Receipt,
  Printer,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Building2,
} from "lucide-react";

type VoucherTypeFilter = "ALL" | "CUSTOMER" | "SUPPLIER";

// مفاتيح الأعمدة القابلة للفرز والتحكم في الظهور في سجل سندات القبض والصرف
type VoucherSortKey =
  | "id"
  | "partyType"
  | "partyName"
  | "amount"
  | "createdAt"
  | "notes";

// تعريف أعمدة جدول السندات للتحكم في الإظهار والإخفاء (مع قفل العمودين الأساسيين)
const VOUCHER_COLUMNS: readonly TableColumnDef<VoucherSortKey>[] = [
  { id: "id", label: "رقم السند", locked: true },
  { id: "partyType", label: "النوع" },
  { id: "partyName", label: "العميل / المستودع", locked: true },
  { id: "amount", label: "المبلغ" },
  { id: "createdAt", label: "التاريخ والوقت" },
  { id: "notes", label: "الملاحظات" },
];

// أعمدة التصدير إلى Excel / CSV مرتبطة بمعرّفات الأعمدة لتصدير الحقول الظاهرة فقط
const VOUCHER_EXPORT_COLUMNS: readonly TableExportColumn<
  LedgerPaymentItem,
  VoucherSortKey
>[] = [
  { columnId: "id", header: "رقم السند", getValue: (p) => p.id },
  {
    columnId: "partyType",
    header: "نوع السند",
    getValue: (p) => (p.partyType === "CUSTOMER" ? "سند قبض" : "سند صرف"),
  },
  {
    columnId: "partyName",
    header: "العميل / المستودع",
    getValue: (p) => p.partyName,
  },
  {
    columnId: "amount",
    header: "المبلغ (ر.س)",
    getValue: (p) =>
      `${p.partyType === "CUSTOMER" ? "+" : "-"}${p.amount.toFixed(2)}`,
  },
  {
    columnId: "createdAt",
    header: "التاريخ والوقت",
    getValue: (p) => p.createdAt.slice(0, 16).replace("T", " "),
  },
  {
    columnId: "notes",
    header: "الملاحظات",
    getValue: (p) => p.notes || "—",
  },
];

// خيارات فلتر نوع السند الممرّرة إلى المكوّن الموحّد FilterPills
const VOUCHER_TYPE_OPTIONS: readonly FilterPillOption<VoucherTypeFilter>[] = [
  { id: "ALL", label: "الكل", tone: "slate" },
  { id: "CUSTOMER", label: "قبض (عملاء)", tone: "sky" },
  { id: "SUPPLIER", label: "صرف (مستودعات)", tone: "purple" },
];

// دوال استخراج قيم الأعمدة للفرز (مُعرّفة خارج المكوّن للحفاظ على ثبات المرجع)
const VOUCHER_SORT_ACCESSORS: SortAccessors<LedgerPaymentItem, VoucherSortKey> =
  {
    id: (p) => p.id,
    partyType: (p) => (p.partyType === "CUSTOMER" ? "سند قبض" : "سند صرف"),
    partyName: (p) => p.partyName,
    amount: (p) => p.amount,
    createdAt: (p) => new Date(p.createdAt),
    notes: (p) => p.notes || null,
  };

// الترتيب الافتراضي للسجل (الأحدث أولاً) والاتجاه الابتدائي لكل عمود عند النقر الأول
const DEFAULT_VOUCHER_SORT: SortState<VoucherSortKey> = {
  key: "createdAt",
  direction: "desc",
};

const VOUCHER_DEFAULT_DIRECTIONS: Partial<
  Record<VoucherSortKey, SortDirection>
> = {
  id: "asc",
  partyType: "asc",
  partyName: "asc",
  amount: "desc",
  createdAt: "desc",
  notes: "asc",
};

interface Props {
  ledgerPayments: LedgerPaymentItem[];
  canViewSuppliers: boolean;
  onReprintVoucher: (voucher: LedgerVoucherReceiptData) => void;
}

/**
 * سجل السندات الموحد (Audit Log)
 * يعرض جميع سندات القبض والصرف المسجلة بترتيب زمني مع البحث وإعادة الطباعة الحرارية،
 * ومبني على نواة الجداول الموحّدة (فلاتر التواريخ السريعة، فرز الأعمدة، إظهار/إخفاء الأعمدة، والتصدير)
 */
export const LedgerVouchersLog: React.FC<Props> = ({
  ledgerPayments,
  canViewSuppliers,
  onReprintVoucher,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<VoucherTypeFilter>("ALL");
  // حالة نطاق التواريخ الموحّدة (الأزرار السريعة + النطاق اليدوي من/إلى)
  const [dateRange, setDateRange] =
    useState<DateRangeValue>(DEFAULT_DATE_RANGE);

  // إدارة إظهار وإخفاء الأعمدة مع حفظ تفضيلات المستخدم في localStorage
  const columnsState = useTableColumns("ledger_vouchers", VOUCHER_COLUMNS);

  // إغلاق آمن: إعادة الفلتر للكل إذا تم تبديل المستخدم لحساب لا يملك صلاحية عرض ذمم المستودعات
  useEffect(() => {
    if (!canViewSuppliers && typeFilter === "SUPPLIER") {
      setTypeFilter("ALL");
    }
  }, [canViewSuppliers, typeFilter]);

  // استبعاد سندات المستودعات عن غير المخولين
  const accessiblePayments = useMemo(
    () =>
      canViewSuppliers
        ? ledgerPayments
        : ledgerPayments.filter((p) => p.partyType === "CUSTOMER"),
    [ledgerPayments, canViewSuppliers],
  );

  const stats = useMemo(() => {
    let customerCount = 0;
    let customerTotal = 0;
    let supplierCount = 0;
    let supplierTotal = 0;

    accessiblePayments.forEach((p) => {
      if (p.partyType === "CUSTOMER") {
        customerCount += 1;
        customerTotal += p.amount;
      } else {
        supplierCount += 1;
        supplierTotal += p.amount;
      }
    });

    return {
      customerCount,
      customerTotal,
      supplierCount,
      supplierTotal,
    };
  }, [accessiblePayments]);

  // تصفية السندات حسب النوع ونطاق التواريخ الموحّد ونص البحث
  const matchedPayments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accessiblePayments.filter((p) => {
      if (typeFilter !== "ALL" && p.partyType !== typeFilter) return false;
      if (!matchesDateRange(p.createdAt, dateRange)) return false;

      if (
        q &&
        !p.id.toLowerCase().includes(q) &&
        !p.partyName.toLowerCase().includes(q) &&
        !(p.notes || "").toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [accessiblePayments, typeFilter, dateRange, searchQuery]);

  // تطبيق الفرز التفاعلي بالأعمدة على السندات المطابقة (يُستخدم أيضاً لترتيب ملف التصدير)
  const {
    sortedItems: filteredPayments,
    sortState,
    toggleSort,
    getSortDirection,
  } = useTableSort(matchedPayments, {
    accessors: VOUCHER_SORT_ACCESSORS,
    defaultSort: DEFAULT_VOUCHER_SORT,
    defaultDirections: VOUCHER_DEFAULT_DIRECTIONS,
  });

  // التحميل التدريجي للصفوف (50 سنداً في الدفعة) مع إعادة ضبط تلقائية عند تغيّر الفلاتر أو الفرز
  const pagination = useTablePagination(filteredPayments, {
    pageSize: 50,
    resetDeps: [
      searchQuery,
      typeFilter,
      dateRange.from,
      dateRange.to,
      sortState?.key,
      sortState?.direction,
    ],
  });

  const filteredTotal = useMemo(
    () => filteredPayments.reduce((sum, p) => sum + p.amount, 0),
    [filteredPayments],
  );

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    typeFilter !== "ALL" ||
    isDateRangeActive(dateRange);

  const handleResetFilters = () => {
    setSearchQuery("");
    setTypeFilter("ALL");
    setDateRange(DEFAULT_DATE_RANGE);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* الترويسة وبطاقات الملخص */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" /> سجل سندات القبض
            والصرف الموحد (Audit Log)
          </h3>
          <p className="text-slate-400 text-[11px] mt-0.5">
            توثيق زمني لجميع الدفعات المحصّلة من العملاء{" "}
            {canViewSuppliers ? "والمسددة للمستودعات " : ""}مع إمكانية إعادة
            طباعة أي سند حراري.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-slate-400">إجمالي السندات</div>
            <div className="font-mono font-bold text-white text-sm">
              {accessiblePayments.length}
            </div>
          </div>

          <div className="bg-sky-950/35 border border-sky-800/70 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-sky-300/80">
              سندات قبض العملاء ({stats.customerCount})
            </div>
            <div className="font-mono font-extrabold text-sky-400 text-sm">
              +{stats.customerTotal.toFixed(2)} ر.س
            </div>
          </div>

          {canViewSuppliers && (
            <div className="bg-purple-950/35 border border-purple-800/70 rounded-xl px-3.5 py-2 text-center">
              <div className="text-[10px] text-purple-300/80">
                سندات صرف المستودعات ({stats.supplierCount})
              </div>
              <div className="font-mono font-extrabold text-purple-400 text-sm">
                -{stats.supplierTotal.toFixed(2)} ر.س
              </div>
            </div>
          )}
        </div>
      </div>

      {/* الهيكل الموحّد للجدول (framed=false للحفاظ على البطاقة الخارجية الحالية) */}
      <DataTableShell
        framed={false}
        totalCount={accessiblePayments.length}
        filteredCount={filteredPayments.length}
        searchQuery={searchQuery}
        onResetFilters={hasActiveFilters ? handleResetFilters : undefined}
        stickyHeader
        emptyState={{
          icon: Receipt,
          title: "لا توجد سندات قبض أو صرف مسجلة حتى الآن.",
          description:
            "عند تسجيل أي دفعة من تبويب الذمم سيُحفظ السند هنا تلقائياً مع إمكانية إعادة طباعته في أي وقت.",
        }}
        noResultsState={{
          description: "لا توجد سندات مطابقة لخيارات البحث أو الفلترة الحالية.",
        }}
        toolbar={
          accessiblePayments.length > 0 ? (
            <DataTableToolbar
              accent="emerald"
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="ابحث برقم السند، اسم العميل أو المستودع، أو الملاحظات..."
              filters={
                canViewSuppliers ? (
                  <FilterPills
                    variant="segmented"
                    options={VOUCHER_TYPE_OPTIONS}
                    value={typeFilter}
                    onChange={setTypeFilter}
                    ariaLabel="تصفية السندات حسب النوع"
                  />
                ) : undefined
              }
              secondaryFilters={
                <DateRangeFilter
                  value={dateRange}
                  onChange={setDateRange}
                  accent="emerald"
                />
              }
              secondaryActions={
                <>
                  <ColumnVisibilityMenu
                    columnsState={columnsState}
                    accent="emerald"
                  />
                  <TableExportButton
                    items={filteredPayments}
                    columns={VOUCHER_EXPORT_COLUMNS}
                    isColumnVisible={columnsState.isVisible}
                    fileNamePrefix="Ledger_Vouchers_Log"
                    itemLabel="سند"
                  />
                </>
              }
              hasActiveFilters={hasActiveFilters}
              onResetFilters={handleResetFilters}
              visibleCount={pagination.visibleCount}
              filteredCount={filteredPayments.length}
              totalCount={accessiblePayments.length}
              itemLabel="سند"
              metaExtra={
                <span className="font-mono text-slate-400">
                  مجموع المطابق:{" "}
                  <b className="text-emerald-400">
                    {filteredTotal.toFixed(2)} ر.س
                  </b>
                </span>
              }
            />
          ) : undefined
        }
        header={
          <tr>
            {columnsState.isVisible("id") && (
              <SortableTh
                direction={getSortDirection("id")}
                onSort={() => toggleSort("id")}
                accent="emerald"
              >
                رقم السند
              </SortableTh>
            )}
            {columnsState.isVisible("partyType") && (
              <SortableTh
                direction={getSortDirection("partyType")}
                onSort={() => toggleSort("partyType")}
                accent="emerald"
              >
                النوع
              </SortableTh>
            )}
            {columnsState.isVisible("partyName") && (
              <SortableTh
                direction={getSortDirection("partyName")}
                onSort={() => toggleSort("partyName")}
                accent="emerald"
              >
                العميل / المستودع
              </SortableTh>
            )}
            {columnsState.isVisible("amount") && (
              <SortableTh
                direction={getSortDirection("amount")}
                onSort={() => toggleSort("amount")}
                align="center"
                accent="emerald"
              >
                المبلغ
              </SortableTh>
            )}
            {columnsState.isVisible("createdAt") && (
              <SortableTh
                direction={getSortDirection("createdAt")}
                onSort={() => toggleSort("createdAt")}
                accent="emerald"
              >
                التاريخ والوقت
              </SortableTh>
            )}
            {columnsState.isVisible("notes") && (
              <SortableTh
                direction={getSortDirection("notes")}
                onSort={() => toggleSort("notes")}
                accent="emerald"
              >
                الملاحظات
              </SortableTh>
            )}
            <th className="py-2.5 px-3 text-center">إعادة طباعة</th>
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
            itemLabel="سند"
            accent="emerald"
            showSummaryWhenComplete
          />
        }
      >
        {pagination.visibleItems.map((payment) => {
          const isCustomer = payment.partyType === "CUSTOMER";
          return (
            <tr
              key={payment.id}
              className="hover:bg-slate-800/40 transition font-mono"
            >
              {columnsState.isVisible("id") && (
                <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                  {payment.id}
                </td>
              )}

              {columnsState.isVisible("partyType") && (
                <td className="py-2.5 px-3 font-sans whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      isCustomer
                        ? "bg-sky-950/60 border-sky-800 text-sky-300"
                        : "bg-purple-950/60 border-purple-800 text-purple-300"
                    }`}
                  >
                    {isCustomer ? (
                      <ArrowDownLeft className="w-3 h-3" />
                    ) : (
                      <ArrowUpRight className="w-3 h-3" />
                    )}
                    {isCustomer ? "سند قبض" : "سند صرف"}
                  </span>
                </td>
              )}

              {columnsState.isVisible("partyName") && (
                <td className="py-2.5 px-3 font-sans">
                  <div className="flex items-center gap-1.5 font-bold text-slate-200">
                    {isCustomer ? (
                      <Users className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    ) : (
                      <Building2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    )}
                    <span>{payment.partyName}</span>
                  </div>
                </td>
              )}

              {columnsState.isVisible("amount") && (
                <td
                  className={`py-2.5 px-3 text-center font-extrabold whitespace-nowrap ${
                    isCustomer ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {isCustomer ? "+" : "-"}
                  {payment.amount.toFixed(2)} ر.س
                </td>
              )}

              {columnsState.isVisible("createdAt") && (
                <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                  {new Date(payment.createdAt).toLocaleString("ar-SA", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
              )}

              {columnsState.isVisible("notes") && (
                <td className="py-2.5 px-3 font-sans text-slate-400 max-w-[220px] truncate">
                  {payment.notes || "—"}
                </td>
              )}

              <td className="py-2.5 px-3 text-center">
                <button
                  type="button"
                  onClick={() =>
                    onReprintVoucher({
                      id: payment.id,
                      partyType: payment.partyType,
                      partyName: payment.partyName,
                      amount: payment.amount,
                      createdAt: payment.createdAt,
                      notes: payment.notes,
                    })
                  }
                  title="إعادة طباعة السند الحراري (80mm)"
                  className="inline-flex items-center gap-1 bg-slate-800 hover:bg-emerald-700 text-slate-200 hover:text-white font-sans font-bold px-2.5 py-1 rounded-lg transition"
                >
                  <Printer className="w-3.5 h-3.5" /> طباعة
                </button>
              </td>
            </tr>
          );
        })}
      </DataTableShell>
    </div>
  );
};
