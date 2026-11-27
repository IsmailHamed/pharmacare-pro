import React, { useEffect, useMemo, useState } from "react";
import { PartyAccountSummary } from "../../../domain/entities";
import { usePosStore } from "../../../application/store/usePosStore";
import { LedgerVoucherReceiptData } from "./LedgerVoucherReceiptModal";
import {
  LedgerInvoiceItem,
  LedgerPaymentItem,
  LedgerPurchaseInvoiceItem,
  StatementFilter,
  buildChronologicalStatementRows,
  buildWhatsAppStatementText,
  getDebtAgeDays,
  printPartyStatementA4,
} from "./statement/ledgerStatement.config";
import { LedgerStatementHeader } from "./statement/LedgerStatementHeader";
import { LedgerStatementExpandedRow } from "./statement/LedgerStatementExpandedRow";
import {
  ArrowDownLeft,
  ArrowUpDown,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronsUpDown,
  FileText,
  Pill,
  Printer,
  UserCheck,
} from "lucide-react";

export type { LedgerInvoiceItem, LedgerPurchaseInvoiceItem, LedgerPaymentItem };

interface Props {
  party: PartyAccountSummary | null;
  invoices: LedgerInvoiceItem[];
  purchaseInvoices: LedgerPurchaseInvoiceItem[];
  ledgerPayments: LedgerPaymentItem[];
  onOpenPayment: (party: PartyAccountSummary) => void;
  onReprintVoucher: (voucher: LedgerVoucherReceiptData) => void;
}

/**
 * لوحة كشف الحساب التفاعلي للعميل أو المستودع المختار
 * تعرض ملخص الرصيد وجدول الحركات التراكمي مع صفوف قابلة للتوسيع لعرض الأدوية المصروفة في كل فاتورة
 */
export const LedgerPartyStatement: React.FC<Props> = ({
  party,
  invoices,
  purchaseInvoices,
  ledgerPayments,
  onOpenPayment,
  onReprintVoucher,
}) => {
  const settings = usePosStore((s) => s.settings);
  const setNotification = usePosStore((s) => s.setNotification);

  const [filterKind, setFilterKind] = useState<StatementFilter>("ALL");
  const [newestFirst, setNewestFirst] = useState(true);
  const [copied, setCopied] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<
    Record<string, boolean>
  >({});

  // إعادة طي الصفوف عند التبديل إلى طرف آخر
  useEffect(() => {
    setExpandedRowKeys({});
  }, [party?.partyName, party?.partyType]);

  const chronologicalRows = useMemo(
    () =>
      buildChronologicalStatementRows({
        party,
        invoices,
        purchaseInvoices,
        ledgerPayments,
      }),
    [party, invoices, purchaseInvoices, ledgerPayments],
  );

  const displayedRows = useMemo(() => {
    const filtered = chronologicalRows.filter((row) => {
      if (filterKind === "INVOICES") return row.kind !== "PAYMENT";
      if (filterKind === "PAYMENTS") return row.kind === "PAYMENT";
      return true;
    });
    return newestFirst ? [...filtered].reverse() : filtered;
  }, [chronologicalRows, filterKind, newestFirst]);

  const expandableRowKeys = useMemo(
    () =>
      displayedRows
        .filter((r) => (r.items?.length ?? 0) > 0)
        .map((r) => r.rowKey),
    [displayedRows],
  );

  const allExpanded =
    expandableRowKeys.length > 0 &&
    expandableRowKeys.every((key) => Boolean(expandedRowKeys[key]));

  const toggleRowExpand = (rowKey: string) => {
    setExpandedRowKeys((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }));
  };

  const handleToggleExpandAll = () => {
    if (allExpanded) {
      setExpandedRowKeys({});
      return;
    }
    const next: Record<string, boolean> = {};
    expandableRowKeys.forEach((key) => {
      next[key] = true;
    });
    setExpandedRowKeys(next);
  };

  if (!party) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center text-slate-500 min-h-[420px] gap-2.5">
        <FileText className="w-10 h-10 text-slate-700 stroke-1" />
        <p className="text-sm font-bold text-slate-400">
          اختر حساباً من القائمة لعرض كشف الحساب التفصيلي
        </p>
      </div>
    );
  }

  const ageDays = getDebtAgeDays(party.lastTransactionAt);

  const handleCopyWhatsApp = async () => {
    const text = buildWhatsAppStatementText({
      party,
      chronologicalRows,
      pharmacyName: settings.pharmacyName,
      pharmacyPhone: settings.phone,
    });
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
    setNotification({
      type: "success",
      message: `تم نسخ كشف حساب (${party.partyName}) بنجاح! يمكنك لصقه في واتساب مباشرة.`,
    });
  };

  const handlePrintStatement = () => {
    printPartyStatementA4({
      party,
      chronologicalRows,
      pharmacyName: settings.pharmacyName,
      pharmacyPhone: settings.phone,
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 flex flex-col">
      {/* رأس الحساب وبطاقات ملخص الأرصدة */}
      <LedgerStatementHeader
        party={party}
        ageDays={ageDays}
        movementsCount={chronologicalRows.length}
        copied={copied}
        onOpenPayment={onOpenPayment}
        onCopyWhatsApp={() => void handleCopyWhatsApp()}
        onPrintStatement={handlePrintStatement}
      />

      {/* فلاتر جدول الحركات + زر توسيع/طي جميع الأصناف + ترتيب العرض */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {(
            [
              { id: "ALL", label: `الكل (${chronologicalRows.length})` },
              {
                id: "INVOICES",
                label: `الفواتير (${chronologicalRows.filter((r) => r.kind !== "PAYMENT").length})`,
              },
              {
                id: "PAYMENTS",
                label: `السندات (${chronologicalRows.filter((r) => r.kind === "PAYMENT").length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterKind(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                filterKind === tab.id
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {expandableRowKeys.length > 0 && (
            <button
              type="button"
              onClick={handleToggleExpandAll}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-[11px] flex items-center gap-1.5 transition"
            >
              <ChevronsUpDown className="w-3.5 h-3.5 text-emerald-400" />
              {allExpanded ? "طي كل الأصناف" : "توسيع كل الأصناف"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setNewestFirst((prev) => !prev)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-[11px] flex items-center gap-1.5 transition"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-sky-400" />
            {newestFirst ? "الأحدث أولاً" : "الأقدم أولاً"}
          </button>
        </div>
      </div>

      {/* جدول الحركات الزمني القابل للتوسيع لعرض الأدوية في كل فاتورة */}
      {displayedRows.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          لا توجد حركات مطابقة لفلتر العرض المحدد.
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto rounded-xl border border-slate-800">
          <table className="w-full text-right text-[11px]">
            <thead className="bg-slate-950 sticky top-0 z-10">
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 px-2.5">التاريخ</th>
                <th className="py-2 px-2.5">نوع الحركة والمرجع</th>
                <th className="py-2 px-2.5 text-center">إضافة (+)</th>
                <th className="py-2 px-2.5 text-center">تسديد / خصم (-)</th>
                <th className="py-2 px-2.5 text-center">الرصيد التراكمي</th>
                <th className="py-2 px-2.5">الأصناف / إيصال</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {displayedRows.map((row) => {
                const hasItems = (row.items?.length ?? 0) > 0;
                const isExpanded =
                  hasItems && Boolean(expandedRowKeys[row.rowKey]);

                return (
                  <React.Fragment key={row.rowKey}>
                    <tr
                      onClick={() => {
                        if (hasItems) toggleRowExpand(row.rowKey);
                      }}
                      className={`transition ${
                        hasItems
                          ? isExpanded
                            ? "bg-slate-800/65 cursor-pointer"
                            : "hover:bg-slate-800/45 cursor-pointer"
                          : "hover:bg-slate-800/30"
                      }`}
                    >
                      <td className="py-2.5 px-2.5 text-slate-400 whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString("ar-SA", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>

                      <td className="py-2.5 px-2.5 font-sans">
                        <div className="flex items-center gap-1.5">
                          {hasItems &&
                            (isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            ) : (
                              <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            ))}
                          {row.kind === "PAYMENT" ? (
                            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : row.kind === "RETURN" ? (
                            <ArrowDownLeft className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )}
                          <span className="font-bold text-slate-200">
                            {row.label}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>{row.referenceId}</span>
                          {row.performedByName && (
                            <span className="font-sans inline-flex items-center gap-0.5 text-sky-400/90">
                              <UserCheck className="w-2.5 h-2.5" />
                              {row.performedByName}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-2.5 text-center font-bold text-amber-400">
                        {row.addition > 0 ? `+${row.addition.toFixed(2)}` : "—"}
                      </td>

                      <td className="py-2.5 px-2.5 text-center font-bold text-emerald-400">
                        {row.deduction > 0
                          ? `-${row.deduction.toFixed(2)}`
                          : "—"}
                      </td>

                      <td className="py-2.5 px-2.5 text-center font-extrabold text-white">
                        {row.runningBalance.toFixed(2)}
                      </td>

                      <td className="py-2.5 px-2.5 font-sans">
                        <div className="flex items-center justify-between gap-2">
                          {hasItems ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                                isExpanded
                                  ? "bg-sky-950/70 border-sky-700 text-sky-300"
                                  : "bg-slate-950 border-slate-700 text-slate-300"
                              }`}
                            >
                              <Pill className="w-3 h-3 text-emerald-400" />
                              {row.items!.length} صنف —{" "}
                              {isExpanded ? "إخفاء" : "عرض الأدوية"}
                            </span>
                          ) : (
                            <span className="text-slate-400 truncate max-w-[160px]">
                              {row.notes || "—"}
                            </span>
                          )}

                          {row.payment && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onReprintVoucher({
                                  id: row.payment!.id,
                                  partyType: row.payment!.partyType,
                                  partyName: row.payment!.partyName,
                                  amount: row.payment!.amount,
                                  createdAt: row.payment!.createdAt,
                                  notes: row.payment!.notes,
                                  previousBalance: row.previousBalance,
                                  remainingBalance: row.runningBalance,
                                  pharmacistName: row.payment!.performedByName,
                                });
                              }}
                              title="إعادة طباعة السند الحراري (80mm)"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-700 text-slate-300 hover:text-white transition shrink-0"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* صف التفاصيل القابل للتوسيع: جدول الأدوية المصروفة داخل الفاتورة */}
                    {isExpanded && <LedgerStatementExpandedRow row={row} />}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
