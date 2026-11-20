import React, { useMemo, useState } from "react";
import { PartyAccountSummary } from "../../../domain/entities";
import { usePosStore } from "../../../application/store/usePosStore";
import { LedgerVoucherReceiptData } from "./LedgerVoucherReceiptModal";
import {
  Users,
  Building2,
  HandCoins,
  Copy,
  Check,
  Printer,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowUpDown,
  Clock,
  CheckCircle2,
} from "lucide-react";

type PosStoreState = ReturnType<typeof usePosStore.getState>;
export type LedgerInvoiceItem = PosStoreState["invoices"][number];
export type LedgerPurchaseInvoiceItem =
  PosStoreState["purchaseInvoices"][number];
export type LedgerPaymentItem = NonNullable<
  PosStoreState["ledgerPayments"]
>[number];

type MovementKind = "INVOICE" | "RETURN" | "PAYMENT";
type StatementFilter = "ALL" | "INVOICES" | "PAYMENTS";

interface StatementRow {
  rowKey: string;
  referenceId: string;
  createdAt: string;
  kind: MovementKind;
  label: string;
  addition: number;
  deduction: number;
  runningBalance: number;
  previousBalance: number;
  notes?: string;
  payment?: LedgerPaymentItem;
}

interface Props {
  party: PartyAccountSummary | null;
  invoices: LedgerInvoiceItem[];
  purchaseInvoices: LedgerPurchaseInvoiceItem[];
  ledgerPayments: LedgerPaymentItem[];
  onOpenPayment: (party: PartyAccountSummary) => void;
  onReprintVoucher: (voucher: LedgerVoucherReceiptData) => void;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getDebtAgeDays = (isoDate: string): number => {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
};

/**
 * لوحة كشف الحساب التفاعلي للعميل أو المستودع المختار
 * تعرض ملخص الرصيد، جدول الحركات بالرصيد التراكمي، نسخ الواتساب، وطباعة الكشف
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

  // تجميع جميع حركات الطرف المختار وترتيبها زمنياً لحساب الرصيد التراكمي (Running Balance)
  const chronologicalRows = useMemo<StatementRow[]>(() => {
    if (!party) return [];

    const rawEntries: Array<{
      rowKey: string;
      referenceId: string;
      createdAt: string;
      kind: MovementKind;
      label: string;
      addition: number;
      deduction: number;
      notes?: string;
      payment?: LedgerPaymentItem;
    }> = [];

    if (party.partyType === "CUSTOMER") {
      invoices
        .filter((inv) => {
          if (inv.paymentMode !== "CREDIT") return false;
          const name = inv.customerName.trim() || "عميل آجل عام";
          return name === party.partyName;
        })
        .forEach((inv) => {
          if (inv.type === "SALE") {
            rawEntries.push({
              rowKey: `inv-${inv.id}`,
              referenceId: inv.id,
              createdAt: inv.createdAt,
              kind: "INVOICE",
              label: "فاتورة مبيعات آجلة",
              addition: inv.totalAmount,
              deduction: 0,
              notes: `${inv.items.length} صنف`,
            });
          } else if (inv.type === "RETURN") {
            rawEntries.push({
              rowKey: `ret-${inv.id}`,
              referenceId: inv.id,
              createdAt: inv.createdAt,
              kind: "RETURN",
              label: "مرتجع مبيعات آجل",
              addition: 0,
              deduction: inv.totalAmount,
              notes: `${inv.items.length} صنف مرتجع`,
            });
          }
        });
    } else {
      purchaseInvoices
        .filter((pur) => {
          if (pur.paymentMode !== "CREDIT") return false;
          const name = pur.supplierName.trim() || "مستودع عام";
          return name === party.partyName;
        })
        .forEach((pur) => {
          rawEntries.push({
            rowKey: `pur-${pur.id}`,
            referenceId: pur.id,
            createdAt: pur.createdAt,
            kind: "INVOICE",
            label: "فاتورة شراء آجلة",
            addition: pur.totalAmount,
            deduction: 0,
          });
        });
    }

    ledgerPayments
      .filter(
        (p) =>
          p.partyType === party.partyType &&
          p.partyName.trim() === party.partyName,
      )
      .forEach((p) => {
        rawEntries.push({
          rowKey: `pay-${p.id}`,
          referenceId: p.id,
          createdAt: p.createdAt,
          kind: "PAYMENT",
          label:
            party.partyType === "CUSTOMER" ? "سند قبض نقدي" : "سند صرف نقدي",
          addition: 0,
          deduction: p.amount,
          notes: p.notes || undefined,
          payment: p,
        });
      });

    // ترتيب زمني تصاعدي لحساب الرصيد التراكمي بدقة
    rawEntries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    let running = 0;
    return rawEntries.map((entry) => {
      const previousBalance = Number(running.toFixed(2));
      running = Math.max(
        0,
        Number((running + entry.addition - entry.deduction).toFixed(2)),
      );
      return {
        ...entry,
        previousBalance,
        runningBalance: running,
      };
    });
  }, [party, invoices, purchaseInvoices, ledgerPayments]);

  const displayedRows = useMemo(() => {
    const filtered = chronologicalRows.filter((row) => {
      if (filterKind === "INVOICES") return row.kind !== "PAYMENT";
      if (filterKind === "PAYMENTS") return row.kind === "PAYMENT";
      return true;
    });
    return newestFirst ? [...filtered].reverse() : filtered;
  }, [chronologicalRows, filterKind, newestFirst]);

  if (!party) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center text-slate-500 min-h-[420px] gap-2.5">
        <FileText className="w-10 h-10 text-slate-700 stroke-1" />
        <p className="text-sm font-bold text-slate-400">
          اختر حساباً من القائمة لعرض كشف الحساب التفصيلي
        </p>
        <p className="text-[11px] text-slate-500 max-w-sm">
          يمكنك التنقل بين الحسابات بالأسهم (↑ / ↓) أو الضغط على Enter لتسجيل
          سند قبض أو صرف فوري.
        </p>
      </div>
    );
  }

  const isCustomer = party.partyType === "CUSTOMER";
  const settledPercent =
    party.totalCreditAmount > 0
      ? Math.min(
          100,
          Math.round((party.totalPaidAmount / party.totalCreditAmount) * 100),
        )
      : 100;
  const ageDays = getDebtAgeDays(party.lastTransactionAt);

  const buildWhatsAppStatementText = (): string => {
    const today = new Date().toLocaleDateString("ar-SA");
    const recentLines = chronologicalRows.slice(-8).map((row) => {
      const dateShort = new Date(row.createdAt).toLocaleDateString("ar-SA");
      const amountStr =
        row.addition > 0
          ? `+${row.addition.toFixed(2)}`
          : `-${row.deduction.toFixed(2)}`;
      return `• ${dateShort} | ${row.label} (${row.referenceId}): ${amountStr} ر.س → الرصيد: ${row.runningBalance.toFixed(2)}`;
    });

    return [
      `📄 *كشف حساب ${isCustomer ? "عميل" : "مستودع"} - ${settings.pharmacyName}*`,
      `التاريخ: ${today}`,
      `${isCustomer ? "السيد / العميل" : "السادة / المستودع"}: *${party.partyName}*`,
      `--------------------------------`,
      `إجمالي الآجل: ${party.totalCreditAmount.toFixed(2)} ر.س`,
      `إجمالي المسدد: ${party.totalPaidAmount.toFixed(2)} ر.س`,
      `*الرصيد المتبقي الحالي: ${party.remainingBalance.toFixed(2)} ر.س*`,
      ...(recentLines.length > 0
        ? [`--------------------------------`, `آخر الحركات:`, ...recentLines]
        : []),
      `--------------------------------`,
      `هاتف الصيدلية: ${settings.phone}`,
    ].join("\n");
  };

  const handleCopyWhatsApp = async () => {
    const text = buildWhatsAppStatementText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
    setNotification({
      type: "success",
      message: `تم نسخ كشف حساب (${party.partyName}) بنجاح! يمكنك لصقه في واتساب مباشرة.`,
    });
  };

  const handlePrintStatement = () => {
    const today = new Date().toLocaleString("ar-SA");
    const rowsHtml = chronologicalRows
      .map(
        (row) => `
      <tr>
        <td class="mono">${escapeHtml(new Date(row.createdAt).toLocaleDateString("ar-SA"))}</td>
        <td>${escapeHtml(row.label)}</td>
        <td class="mono">${escapeHtml(row.referenceId)}</td>
        <td class="mono">${row.addition > 0 ? row.addition.toFixed(2) : "—"}</td>
        <td class="mono">${row.deduction > 0 ? row.deduction.toFixed(2) : "—"}</td>
        <td class="mono bold">${row.runningBalance.toFixed(2)}</td>
        <td>${escapeHtml(row.notes || "—")}</td>
      </tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>كشف حساب - ${escapeHtml(party.partyName)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body {
      font-family: "Tahoma", "Segoe UI", Arial, sans-serif;
      font-size: 12px;
      color: #111;
      margin: 0;
    }
    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #111;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .title { font-size: 18px; font-weight: 800; }
    .mono { font-family: "Consolas", monospace; }
    .bold { font-weight: 700; }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .box {
      border: 1px solid #bbb;
      border-radius: 6px;
      padding: 8px 10px;
    }
    .box-label { font-size: 11px; color: #555; }
    .box-val { font-size: 15px; font-weight: 800; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      border: 1px solid #ccc;
      padding: 6px 8px;
      text-align: right;
    }
    th { background: #f2f4f7; font-weight: 700; }
    .footer {
      margin-top: 18px;
      text-align: center;
      font-size: 11px;
      color: #555;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${escapeHtml(settings.pharmacyName)}</div>
      <div>هاتف: <span class="mono">${escapeHtml(settings.phone)}</span></div>
    </div>
    <div style="text-align: left;">
      <div class="bold" style="font-size: 15px;">كشف حساب ${isCustomer ? "عميل آجل" : "مستودع / مورد"}</div>
      <div>الطرف: <span class="bold">${escapeHtml(party.partyName)}</span></div>
      <div>تاريخ الطباعة: <span class="mono">${escapeHtml(today)}</span></div>
    </div>
  </div>
  <div class="summary">
    <div class="box">
      <div class="box-label">إجمالي الفواتير الآجلة</div>
      <div class="box-val mono">${party.totalCreditAmount.toFixed(2)} ر.س</div>
    </div>
    <div class="box">
      <div class="box-label">إجمالي المسدد</div>
      <div class="box-val mono">${party.totalPaidAmount.toFixed(2)} ر.س</div>
    </div>
    <div class="box">
      <div class="box-label">الرصيد المتبقي الحالي</div>
      <div class="box-val mono">${party.remainingBalance.toFixed(2)} ر.س</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>التاريخ</th>
        <th>نوع الحركة</th>
        <th>رقم المرجع</th>
        <th>إضافة (+)</th>
        <th>تسديد / مرتجع (-)</th>
        <th>الرصيد التراكمي</th>
        <th>ملاحظات</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="7" style="text-align:center;">لا توجد حركات مسجلة</td></tr>'}
    </tbody>
  </table>
  <div class="footer">كشف حساب صادر إلكترونياً من نظام إدارة الصيدلية</div>
</body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc && iframe.contentWindow) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.contentWindow.focus();
      window.setTimeout(() => {
        iframe.contentWindow?.print();
        window.setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 100);
    } else {
      document.body.removeChild(iframe);
      window.print();
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 flex flex-col">
      {/* رأس الحساب وأزرار الإجراء المباشرة */}
      <div className="flex items-start justify-between gap-3 flex-wrap border-b border-slate-800 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isCustomer ? (
              <Users className="w-4 h-4 text-sky-400 shrink-0" />
            ) : (
              <Building2 className="w-4 h-4 text-purple-400 shrink-0" />
            )}
            <h3 className="font-bold text-white text-sm truncate">
              {party.partyName}
            </h3>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isCustomer
                  ? "bg-sky-950/60 border-sky-800 text-sky-300"
                  : "bg-purple-950/60 border-purple-800 text-purple-300"
              }`}
            >
              {isCustomer ? "عميل آجل" : "مستودع / مورد"}
            </span>

            {party.remainingBalance > 0 ? (
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  ageDays > 60
                    ? "bg-rose-950/60 border-rose-800 text-rose-300"
                    : ageDays > 30
                      ? "bg-amber-950/60 border-amber-800 text-amber-300"
                      : "bg-emerald-950/50 border-emerald-800 text-emerald-300"
                }`}
              >
                <Clock className="w-3 h-3" />
                {ageDays === 0 ? "حركة اليوم" : `منذ ${ageDays} يوم`}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800 text-emerald-300">
                <CheckCircle2 className="w-3 h-3" /> مسدد بالكامل
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            آخر حركة:{" "}
            {new Date(party.lastTransactionAt).toLocaleString("ar-SA")} •{" "}
            {chronologicalRows.length} حركة مسجلة
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {party.remainingBalance > 0 && (
            <button
              type="button"
              onClick={() => onOpenPayment(party)}
              className={`px-3.5 py-2 rounded-xl text-white font-bold flex items-center gap-1.5 shadow transition ${
                isCustomer
                  ? "bg-sky-600 hover:bg-sky-500"
                  : "bg-purple-600 hover:bg-purple-500"
              }`}
            >
              <HandCoins className="w-4 h-4" />
              {isCustomer ? "تسجيل سند قبض" : "تسجيل سند صرف"}
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleCopyWhatsApp()}
            title="نسخ كشف الحساب المنسّق للواتساب"
            className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold flex items-center gap-1.5 transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" /> تم النسخ
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> واتساب
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handlePrintStatement}
            title="طباعة كشف الحساب الكامل"
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold flex items-center gap-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5" /> طباعة كشف
          </button>
        </div>
      </div>

      {/* ملخص الأرصدة + شريط نسبة السداد */}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">
              {isCustomer ? "صافي المبيعات الآجلة" : "إجمالي فواتير الشراء"}
            </div>
            <div className="font-mono font-bold text-sm text-white mt-0.5">
              {party.totalCreditAmount.toFixed(2)} ر.س
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400">إجمالي المسدد</div>
            <div className="font-mono font-bold text-sm text-emerald-400 mt-0.5">
              {party.totalPaidAmount.toFixed(2)} ر.س
            </div>
          </div>

          <div
            className={`rounded-xl p-2.5 border ${
              party.remainingBalance > 0
                ? isCustomer
                  ? "bg-amber-950/25 border-amber-800/70"
                  : "bg-rose-950/25 border-rose-800/70"
                : "bg-emerald-950/25 border-emerald-800/70"
            }`}
          >
            <div className="text-[10px] text-slate-400">
              {isCustomer ? "المتبقي على العميل" : "المتبقي للمستودع"}
            </div>
            <div
              className={`font-mono font-extrabold text-sm mt-0.5 ${
                party.remainingBalance > 0
                  ? isCustomer
                    ? "text-amber-400"
                    : "text-rose-400"
                  : "text-emerald-400"
              }`}
            >
              {party.remainingBalance.toFixed(2)} ر.س
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span>نسبة السداد:</span>
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${settledPercent}%` }}
            />
          </div>
          <span className="font-mono font-bold text-emerald-400">
            {settledPercent}%
          </span>
        </div>
      </div>

      {/* فلاتر جدول الحركات + ترتيب العرض */}
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

        <button
          type="button"
          onClick={() => setNewestFirst((prev) => !prev)}
          className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-[11px] flex items-center gap-1.5 transition"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-sky-400" />
          {newestFirst ? "الأحدث أولاً" : "الأقدم أولاً"}
        </button>
      </div>

      {/* جدول الحركات الزمني (Running Balance) */}
      {displayedRows.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          لا توجد حركات مطابقة لفلتر العرض المحدد.
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[380px] overflow-y-auto rounded-xl border border-slate-800">
          <table className="w-full text-right text-[11px]">
            <thead className="bg-slate-950 sticky top-0 z-10">
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 px-2.5">التاريخ</th>
                <th className="py-2 px-2.5">نوع الحركة والمرجع</th>
                <th className="py-2 px-2.5 text-center">إضافة (+)</th>
                <th className="py-2 px-2.5 text-center">تسديد / خصم (-)</th>
                <th className="py-2 px-2.5 text-center">الرصيد التراكمي</th>
                <th className="py-2 px-2.5">ملاحظات / إيصال</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {displayedRows.map((row) => (
                <tr
                  key={row.rowKey}
                  className="hover:bg-slate-800/40 transition"
                >
                  <td className="py-2.5 px-2.5 text-slate-400 whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString("ar-SA", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>

                  <td className="py-2.5 px-2.5 font-sans">
                    <div className="flex items-center gap-1.5">
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
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                      {row.referenceId}
                    </div>
                  </td>

                  <td className="py-2.5 px-2.5 text-center font-bold text-amber-400">
                    {row.addition > 0 ? `+${row.addition.toFixed(2)}` : "—"}
                  </td>

                  <td className="py-2.5 px-2.5 text-center font-bold text-emerald-400">
                    {row.deduction > 0 ? `-${row.deduction.toFixed(2)}` : "—"}
                  </td>

                  <td className="py-2.5 px-2.5 text-center font-extrabold text-white">
                    {row.runningBalance.toFixed(2)}
                  </td>

                  <td className="py-2.5 px-2.5 font-sans">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 truncate max-w-[140px]">
                        {row.notes || "—"}
                      </span>
                      {row.payment && (
                        <button
                          type="button"
                          onClick={() =>
                            onReprintVoucher({
                              id: row.payment!.id,
                              partyType: row.payment!.partyType,
                              partyName: row.payment!.partyName,
                              amount: row.payment!.amount,
                              createdAt: row.payment!.createdAt,
                              notes: row.payment!.notes,
                              previousBalance: row.previousBalance,
                              remainingBalance: row.runningBalance,
                            })
                          }
                          title="إعادة طباعة السند الحراري (80mm)"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-700 text-slate-300 hover:text-white transition shrink-0"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
