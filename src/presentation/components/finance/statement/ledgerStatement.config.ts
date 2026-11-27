import { PartyAccountSummary } from "../../../../domain/entities";
import { usePosStore } from "../../../../application/store/usePosStore";
import {
  escapePrintHtml,
  printHtmlDocument,
} from "../../../../domain/utils/printTemplates";

type PosStoreState = ReturnType<typeof usePosStore.getState>;
export type LedgerInvoiceItem = PosStoreState["invoices"][number];
export type LedgerPurchaseInvoiceItem =
  PosStoreState["purchaseInvoices"][number];
export type LedgerPaymentItem = NonNullable<
  PosStoreState["ledgerPayments"]
>[number];

export type MovementKind = "INVOICE" | "RETURN" | "PAYMENT";
export type StatementFilter = "ALL" | "INVOICES" | "PAYMENTS";

export interface StatementLineItem {
  key: string;
  name: string;
  barcode?: string;
  unitLabel: string;
  qty: number;
  bonusQty?: number;
  unitPrice: number;
  lineTotal: number;
}

export interface StatementRow {
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
  performedByName?: string;
  subtotal?: number;
  discountPercent?: number;
  items?: StatementLineItem[];
  payment?: LedgerPaymentItem;
}

export const getDebtAgeDays = (isoDate: string): number => {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
};

/**
 * استخراج أصناف فواتير الشراء من المستودع بشكل آمن لعرضها داخل الصف القابل للتوسيع
 */
export const extractPurchaseLineItems = (
  purchase: LedgerPurchaseInvoiceItem,
): StatementLineItem[] => {
  const rawItems = (purchase as unknown as { items?: unknown }).items;
  if (!Array.isArray(rawItems)) return [];

  return rawItems.map((entry, idx) => {
    const raw = (entry ?? {}) as Record<string, unknown>;
    const nestedProduct = (raw.product ?? {}) as Record<string, unknown>;
    const name = String(
      raw.productName || raw.name || nestedProduct.name || `صنف #${idx + 1}`,
    );
    const barcodeValue = raw.barcode || nestedProduct.barcode;
    const qty = Number(raw.paidQty ?? raw.qty ?? raw.quantity ?? 0);
    const bonusQty = Number(raw.bonusQty ?? raw.bonus ?? 0);
    const unitPrice = Number(
      raw.unitCost ?? raw.costPrice ?? raw.unitPrice ?? 0,
    );
    const computedTotal = Number(
      raw.totalCost ?? raw.lineTotal ?? raw.total ?? qty * unitPrice,
    );

    return {
      key: `${purchase.id}-pur-${idx}`,
      name,
      barcode: barcodeValue ? String(barcodeValue) : undefined,
      unitLabel: "علبة",
      qty,
      bonusQty: bonusQty > 0 ? bonusQty : undefined,
      unitPrice: Number(unitPrice.toFixed(2)),
      lineTotal: Number(computedTotal.toFixed(2)),
    };
  });
};

/**
 * تجميع جميع حركات الطرف المختار وترتيبها زمنياً لحساب الرصيد التراكمي (Running Balance)
 */
export const buildChronologicalStatementRows = (params: {
  party: PartyAccountSummary | null;
  invoices: LedgerInvoiceItem[];
  purchaseInvoices: LedgerPurchaseInvoiceItem[];
  ledgerPayments: LedgerPaymentItem[];
}): StatementRow[] => {
  const { party, invoices, purchaseInvoices, ledgerPayments } = params;
  if (!party) return [];

  const rawEntries: Array<
    Omit<StatementRow, "runningBalance" | "previousBalance">
  > = [];

  if (party.partyType === "CUSTOMER") {
    invoices
      .filter((inv) => {
        if (inv.paymentMode !== "CREDIT") return false;
        const name = inv.customerName.trim() || "عميل آجل عام";
        return name === party.partyName;
      })
      .forEach((inv) => {
        const lineItems: StatementLineItem[] = inv.items.map((item, idx) => ({
          key: item.cartKey || `${inv.id}-${idx}`,
          name: item.product.name,
          barcode: item.product.barcode,
          unitLabel: item.unit === "pack" ? "علبة" : "شريط",
          qty: item.qty,
          unitPrice: item.unitPrice,
          lineTotal: Number((item.unitPrice * item.qty).toFixed(2)),
        }));

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
            performedByName: inv.performedByName,
            subtotal: inv.subtotal,
            discountPercent: inv.discountPercent,
            items: lineItems,
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
            performedByName: inv.performedByName,
            subtotal: inv.subtotal,
            discountPercent: inv.discountPercent,
            items: lineItems,
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
        const lineItems = extractPurchaseLineItems(pur);
        rawEntries.push({
          rowKey: `pur-${pur.id}`,
          referenceId: pur.supplierInvoiceNumber || pur.id,
          createdAt: pur.createdAt,
          kind: "INVOICE",
          label: "فاتورة شراء آجلة",
          addition: pur.totalAmount,
          deduction: 0,
          notes: lineItems.length > 0 ? `${lineItems.length} صنف` : undefined,
          items: lineItems,
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
        label: party.partyType === "CUSTOMER" ? "سند قبض نقدي" : "سند صرف نقدي",
        addition: 0,
        deduction: p.amount,
        notes: p.notes || undefined,
        performedByName: p.performedByName,
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
};

/**
 * توليد نص كشف الحساب المنسّق للواتساب مع أسماء الأدوية في آخر 8 حركات
 */
export const buildWhatsAppStatementText = (params: {
  party: PartyAccountSummary;
  chronologicalRows: StatementRow[];
  pharmacyName: string;
  pharmacyPhone?: string;
}): string => {
  const { party, chronologicalRows, pharmacyName, pharmacyPhone } = params;
  const isCustomer = party.partyType === "CUSTOMER";
  const today = new Date().toLocaleDateString("ar-SA");

  const recentLines = chronologicalRows.slice(-8).map((row) => {
    const dateShort = new Date(row.createdAt).toLocaleDateString("ar-SA");
    const amountStr =
      row.addition > 0
        ? `+${row.addition.toFixed(2)}`
        : `-${row.deduction.toFixed(2)}`;
    const mainLine = `• ${dateShort} | ${row.label} (${row.referenceId}): ${amountStr} ر.س → الرصيد: ${row.runningBalance.toFixed(2)}`;

    if (row.items && row.items.length > 0) {
      const medsSummary = row.items
        .map((item) => `${item.name} (${item.qty} ${item.unitLabel})`)
        .join("، ");
      return `${mainLine}\n   الأصناف: ${medsSummary}`;
    }

    return mainLine;
  });

  return [
    `📄 *كشف حساب ${isCustomer ? "عميل" : "مستودع"} - ${pharmacyName}*`,
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
    `هاتف الصيدلية: ${pharmacyPhone || ""}`,
  ].join("\n");
};

/**
 * طباعة كشف حساب A4 تفصيلي مع الأصناف عبر أداة الطباعة المعزولة الموحّدة
 */
export const printPartyStatementA4 = (params: {
  party: PartyAccountSummary;
  chronologicalRows: StatementRow[];
  pharmacyName: string;
  pharmacyPhone?: string;
}): void => {
  const { party, chronologicalRows, pharmacyName, pharmacyPhone } = params;
  const isCustomer = party.partyType === "CUSTOMER";
  const today = new Date().toLocaleString("ar-SA");

  const rowsHtml = chronologicalRows
    .map((row) => {
      const itemsSummaryHtml =
        row.items && row.items.length > 0
          ? `<div class="items-list">${row.items
              .map(
                (item) =>
                  `• ${escapePrintHtml(item.name)} — ${item.qty}${escapePrintHtml(item.unitLabel)} × ${item.unitPrice.toFixed(2)} =${item.lineTotal.toFixed(2)}`,
              )
              .join("<br/>")}</div>`
          : escapePrintHtml(row.notes || "—");

      return `
      <tr>
        <td class="mono">${escapePrintHtml(new Date(row.createdAt).toLocaleDateString("ar-SA"))}</td>
        <td>${escapePrintHtml(row.label)}</td>
        <td class="mono">${escapePrintHtml(row.referenceId)}</td>
        <td class="mono">${row.addition > 0 ? row.addition.toFixed(2) : "—"}</td>
        <td class="mono">${row.deduction > 0 ? row.deduction.toFixed(2) : "—"}</td>
        <td class="mono bold">${row.runningBalance.toFixed(2)}</td>
        <td>${itemsSummaryHtml}</td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>كشف حساب - ${escapePrintHtml(party.partyName)}</title>
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
      vertical-align: top;
    }
    th { background: #f2f4f7; font-weight: 700; }
    .items-list { font-size: 10.5px; line-height: 1.5; color: #333; }
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
      <div class="title">${escapePrintHtml(pharmacyName)}</div>
      <div>هاتف: <span class="mono">${escapePrintHtml(pharmacyPhone || "")}</span></div>
    </div>
    <div style="text-align: left;">
      <div class="bold" style="font-size: 15px;">كشف حساب ${isCustomer ? "عميل آجل" : "مستودع / مورد"}</div>
      <div>الطرف: <span class="bold">${escapePrintHtml(party.partyName)}</span></div>
      <div>تاريخ الطباعة: <span class="mono">${escapePrintHtml(today)}</span></div>
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
        <th>الأصناف / الملاحظات</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="7" style="text-align:center;">لا توجد حركات مسجلة</td></tr>'}
    </tbody>
  </table>
  <div class="footer">كشف حساب صادر إلكترونياً من نظام إدارة الصيدلية</div>
</body>
</html>`;

  printHtmlDocument(html);
};
