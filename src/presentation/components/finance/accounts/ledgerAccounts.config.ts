import { PartyAccountSummary } from "../../../../domain/entities";
import { getDebtAgeDays } from "../statement/ledgerStatement.config";
import { FilterPillOption } from "../../common/table/FilterPills";
import {
  SortAccessors,
  SortDirection,
  SortState,
} from "../../common/table/useTableSort";
import { TableColumnDef } from "../../common/table/useTableColumns";
import { TableExportColumn } from "../../common/table/TableExportButton";
import { Clock } from "lucide-react";

export type LedgerScope = "customers" | "suppliers" | "vouchers";
export type BalanceFilter = "ALL" | "OPEN" | "OVERDUE_30";

// مفاتيح الأعمدة القابلة للفرز والتحكم في الظهور في جدول الذمم والآجل
export type LedgerSortKey =
  | "partyName"
  | "debtAgeDays"
  | "lastTransactionAt"
  | "totalCreditAmount"
  | "totalPaidAmount"
  | "remainingBalance";

// دوال استخراج قيم الأعمدة للفرز (تُبقي الحسابات المسددة بالكامل في الأسفل عند الفرز حسب عمر الدين)
export const LEDGER_SORT_ACCESSORS: SortAccessors<
  PartyAccountSummary,
  LedgerSortKey
> = {
  partyName: (acc) => acc.partyName,
  debtAgeDays: (acc) =>
    acc.remainingBalance > 0 ? getDebtAgeDays(acc.lastTransactionAt) : null,
  lastTransactionAt: (acc) => new Date(acc.lastTransactionAt),
  totalCreditAmount: (acc) => acc.totalCreditAmount,
  totalPaidAmount: (acc) => acc.totalPaidAmount,
  remainingBalance: (acc) => acc.remainingBalance,
};

// الترتيب الافتراضي للجدول (الأعلى رصيداً متبقياً أولاً) والاتجاه الابتدائي لكل عمود عند النقر الأول
export const DEFAULT_LEDGER_SORT: SortState<LedgerSortKey> = {
  key: "remainingBalance",
  direction: "desc",
};

export const LEDGER_DEFAULT_DIRECTIONS: Partial<
  Record<LedgerSortKey, SortDirection>
> = {
  partyName: "asc",
  debtAgeDays: "desc",
  lastTransactionAt: "desc",
  totalCreditAmount: "desc",
  totalPaidAmount: "desc",
  remainingBalance: "desc",
};

// تعريف أعمدة جدول الذمم للتحكم في الإظهار والإخفاء (مع قفل عمود الاسم)
export const getLedgerTableColumns = (
  isSupplierScope: boolean,
): TableColumnDef<LedgerSortKey>[] => [
  {
    id: "partyName",
    label: isSupplierScope ? "اسم المستودع" : "اسم العميل",
    locked: true,
  },
  { id: "debtAgeDays", label: "الحالة وعمر الدين" },
  { id: "lastTransactionAt", label: "آخر حركة" },
  { id: "totalCreditAmount", label: "إجمالي الآجل" },
  { id: "totalPaidAmount", label: "إجمالي المسدد" },
  { id: "remainingBalance", label: "الرصيد المتبقي" },
];

// أعمدة التصدير إلى Excel / CSV مرتبطة بمعرّفات الأعمدة لتصدير الحقول الظاهرة فقط
export const getLedgerExportColumns = (
  isSupplierScope: boolean,
): TableExportColumn<PartyAccountSummary, LedgerSortKey>[] => [
  {
    columnId: "partyName",
    header: isSupplierScope ? "اسم المستودع" : "اسم العميل",
    getValue: (acc) => acc.partyName,
  },
  {
    columnId: "debtAgeDays",
    header: "الحالة وعمر الدين",
    getValue: (acc) => {
      if (acc.remainingBalance <= 0) return "مسدد بالكامل";
      const days = getDebtAgeDays(acc.lastTransactionAt);
      return days === 0 ? "اليوم" : `${days} يوم`;
    },
  },
  {
    columnId: "lastTransactionAt",
    header: "تاريخ آخر حركة",
    getValue: (acc) => acc.lastTransactionAt.slice(0, 10),
  },
  {
    columnId: "totalCreditAmount",
    header: "إجمالي الآجل",
    getValue: (acc) => acc.totalCreditAmount.toFixed(2),
  },
  {
    columnId: "totalPaidAmount",
    header: "إجمالي المسدد",
    getValue: (acc) => acc.totalPaidAmount.toFixed(2),
  },
  {
    columnId: "remainingBalance",
    header: "الرصيد المتبقي",
    getValue: (acc) => acc.remainingBalance.toFixed(2),
  },
];

// خيارات حبوب فلتر حالة الرصيد الممرّرة إلى المكوّن الموحّد FilterPills
export const getBalanceFilterOptions = (params: {
  totalCount: number;
  openCount: number;
  overdueCount: number;
  scopeAccent: "purple" | "sky";
}): FilterPillOption<BalanceFilter>[] => [
  {
    id: "ALL",
    label: "الكل",
    count: params.totalCount,
    tone: "slate",
  },
  {
    id: "OPEN",
    label: "مفتوحة",
    count: params.openCount,
    tone: params.scopeAccent,
    highlightWhenInactive: true,
  },
  {
    id: "OVERDUE_30",
    label: "متأخرة +30 يوم",
    count: params.overdueCount,
    icon: Clock,
    tone: "rose",
    highlightWhenInactive: params.overdueCount > 0,
  },
];
