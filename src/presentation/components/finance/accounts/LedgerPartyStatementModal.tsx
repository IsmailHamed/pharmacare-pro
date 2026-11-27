import React from "react";
import { PartyAccountSummary } from "../../../../domain/entities";
import {
  LedgerInvoiceItem,
  LedgerPartyStatement,
  LedgerPaymentItem,
  LedgerPurchaseInvoiceItem,
} from "../LedgerPartyStatement";
import { LedgerVoucherReceiptData } from "../LedgerVoucherReceiptModal";
import { Building2, Users, X } from "lucide-react";

interface Props {
  party: PartyAccountSummary | null;
  invoices: LedgerInvoiceItem[];
  purchaseInvoices: LedgerPurchaseInvoiceItem[];
  ledgerPayments: LedgerPaymentItem[];
  onClose: () => void;
  onOpenPayment: (party: PartyAccountSummary) => void;
  onReprintVoucher: (voucher: LedgerVoucherReceiptData) => void;
}

/**
 * نافذة تفاصيل العمليات وكشف الحساب التراكمي عند الضغط على صف العميل / المستودع
 */
export const LedgerPartyStatementModal: React.FC<Props> = ({
  party,
  invoices,
  purchaseInvoices,
  ledgerPayments,
  onClose,
  onOpenPayment,
  onReprintVoucher,
}) => {
  if (!party) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40 p-4 text-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-slate-950 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {party.partyType === "SUPPLIER" ? (
              <Building2 className="w-4 h-4 text-purple-400 shrink-0" />
            ) : (
              <Users className="w-4 h-4 text-sky-400 shrink-0" />
            )}
            <h3 className="font-bold text-white text-sm truncate">
              تفاصيل العمليات وكشف حساب: {party.partyName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg transition"
            title="إغلاق (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <LedgerPartyStatement
            party={party}
            invoices={invoices}
            purchaseInvoices={purchaseInvoices}
            ledgerPayments={ledgerPayments}
            onOpenPayment={onOpenPayment}
            onReprintVoucher={onReprintVoucher}
          />
        </div>
      </div>
    </div>
  );
};
