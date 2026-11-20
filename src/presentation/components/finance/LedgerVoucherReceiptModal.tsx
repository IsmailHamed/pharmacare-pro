import React, { useEffect } from "react";
import { usePosStore } from "../../../application/store/usePosStore";
import { Printer, X, Receipt, CheckCircle2 } from "lucide-react";

export interface LedgerVoucherReceiptData {
  id: string;
  partyType: "CUSTOMER" | "SUPPLIER";
  partyName: string;
  amount: number;
  createdAt: string;
  notes?: string;
  previousBalance?: number;
  remainingBalance?: number;
  pharmacistName?: string;
}

interface Props {
  voucher: LedgerVoucherReceiptData | null;
  onClose: () => void;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * نافذة معاينة وطباعة سند القبض / سند الصرف الحراري (80mm)
 * تُستخدم فور تسجيل السند أو عند إعادة طباعة أي سند من سجل السندات
 */
export const LedgerVoucherReceiptModal: React.FC<Props> = ({
  voucher,
  onClose,
}) => {
  const settings = usePosStore((s) => s.settings);

  useEffect(() => {
    if (!voucher) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [voucher, onClose]);

  if (!voucher) return null;

  const isCustomer = voucher.partyType === "CUSTOMER";
  const voucherTitle = isCustomer ? "سند قبض نقدي" : "سند صرف نقدي";
  const partyLabel = isCustomer ? "استلمنا من العميل" : "دُفع إلى المستودع";
  const formattedDate = new Date(voucher.createdAt).toLocaleString("ar-SA");

  const handlePrintThermal = () => {
    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(voucherTitle)} - ${escapeHtml(voucher.id)}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 4mm;
      width: 76mm;
      font-family: "Tahoma", "Segoe UI", Arial, sans-serif;
      font-size: 11px;
      color: #000;
      background: #fff;
    }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .mono { font-family: "Consolas", monospace; }
    .title { font-size: 14px; font-weight: 800; margin: 2px 0; }
    .badge {
      display: inline-block;
      border: 1.5px solid #000;
      padding: 2px 10px;
      font-weight: 800;
      font-size: 12px;
      margin: 6px 0;
    }
    .divider { border-top: 1px dashed #000; margin: 7px 0; }
    .row { display: flex; justify-content: space-between; gap: 6px; margin: 4px 0; }
    .amount-box {
      border: 1.5px solid #000;
      padding: 6px;
      margin: 8px 0;
      text-align: center;
    }
    .amount-val { font-size: 18px; font-weight: 900; }
    .footer { font-size: 10px; margin-top: 10px; text-align: center; }
  </style>
</head>
<body>
  <div class="center">
    <div class="title">${escapeHtml(settings.pharmacyName)}</div>
    <div>هاتف: <span class="mono">${escapeHtml(settings.phone)}</span></div>
    <div class="badge">${escapeHtml(voucherTitle)}</div>
  </div>
  <div class="divider"></div>
  <div class="row"><span>رقم السند:</span><span class="mono bold">${escapeHtml(voucher.id)}</span></div>
  <div class="row"><span>التاريخ:</span><span class="mono">${escapeHtml(formattedDate)}</span></div>
  <div class="row"><span>${escapeHtml(partyLabel)}:</span><span class="bold">${escapeHtml(voucher.partyName)}</span></div>
  ${
    voucher.pharmacistName
      ? `<div class="row"><span>المسؤول:</span><span>${escapeHtml(voucher.pharmacistName)}</span></div>`
      : ""
  }
  <div class="amount-box">
    <div>المبلغ المسدد</div>
    <div class="amount-val mono">${voucher.amount.toFixed(2)} ر.س</div>
  </div>
  ${
    voucher.previousBalance !== undefined
      ? `<div class="row"><span>الرصيد السابق:</span><span class="mono">${voucher.previousBalance.toFixed(2)} ر.س</span></div>`
      : ""
  }
  ${
    voucher.remainingBalance !== undefined
      ? `<div class="row bold"><span>الرصيد المتبقي الحالي:</span><span class="mono">${voucher.remainingBalance.toFixed(2)} ر.س</span></div>`
      : ""
  }
  ${
    voucher.notes
      ? `<div class="divider"></div><div><span class="bold">ملاحظات:</span> ${escapeHtml(voucher.notes)}</div>`
      : ""
  }
  <div class="divider"></div>
  <div class="row" style="margin-top: 14px;">
    <span>توقيع المستلم: ..............</span>
    <span>توقيع المحاسب: ..............</span>
  </div>
  <div class="footer">شكراً لتعاملكم معنا • مستند مالي معتمد</div>
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
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        {/* رأس النافذة */}
        <div className="p-3.5 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <Receipt
              className={`w-4 h-4 ${
                isCustomer ? "text-sky-400" : "text-purple-400"
              }`}
            />
            <span>معاينة {voucherTitle} (80mm)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-900 p-1 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* معاينة الإيصال الحراري */}
        <div className="p-4 bg-slate-950 flex justify-center">
          <div className="w-full max-w-[300px] bg-white text-slate-900 rounded-xl p-4 shadow-lg space-y-2.5 text-[11px]">
            <div className="text-center border-b border-dashed border-slate-400 pb-2.5">
              <div className="font-extrabold text-sm text-slate-950">
                {settings.pharmacyName}
              </div>
              <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                هاتف: {settings.phone}
              </div>
              <span className="inline-block mt-2 px-3 py-0.5 border-2 border-slate-900 font-extrabold text-xs rounded">
                {voucherTitle}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="text-slate-600">رقم السند:</span>
                <span className="font-mono font-bold">{voucher.id}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-600">التاريخ:</span>
                <span className="font-mono text-[10px]">{formattedDate}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-600">{partyLabel}:</span>
                <span className="font-bold text-slate-950">
                  {voucher.partyName}
                </span>
              </div>
              {voucher.pharmacistName && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600">المسؤول:</span>
                  <span className="font-semibold">
                    {voucher.pharmacistName}
                  </span>
                </div>
              )}
            </div>

            <div className="border-2 border-slate-900 rounded-lg p-2.5 text-center bg-slate-50">
              <div className="text-[10px] text-slate-600">المبلغ المسدد</div>
              <div className="font-mono font-black text-lg text-slate-950">
                {voucher.amount.toFixed(2)} ر.س
              </div>
            </div>

            {(voucher.previousBalance !== undefined ||
              voucher.remainingBalance !== undefined) && (
              <div className="space-y-1 border-t border-dashed border-slate-400 pt-2">
                {voucher.previousBalance !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">الرصيد السابق:</span>
                    <span className="font-mono">
                      {voucher.previousBalance.toFixed(2)} ر.س
                    </span>
                  </div>
                )}
                {voucher.remainingBalance !== undefined && (
                  <div className="flex justify-between font-extrabold text-slate-950">
                    <span>الرصيد المتبقي الحالي:</span>
                    <span className="font-mono">
                      {voucher.remainingBalance.toFixed(2)} ر.س
                    </span>
                  </div>
                )}
              </div>
            )}

            {voucher.notes && (
              <div className="border-t border-dashed border-slate-400 pt-2 text-[10.5px] text-slate-700">
                <b>ملاحظات:</b> {voucher.notes}
              </div>
            )}

            <div className="border-t border-dashed border-slate-400 pt-2 text-center text-[10px] text-slate-500 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              مستند مالي معتمد
            </div>
          </div>
        </div>

        {/* أزرار الطباعة والإغلاق */}
        <div className="p-3.5 bg-slate-800 border-t border-slate-700 flex gap-2">
          <button
            type="button"
            onClick={handlePrintThermal}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 transition"
          >
            <Printer className="w-4 h-4" /> طباعة حرارية (80mm)
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
