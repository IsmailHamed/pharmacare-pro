import React from "react";
import { InvoiceEntity } from "../../../../domain/entities/Invoice";
import { ThermalReceiptConfig } from "../../../../domain/utils/printTemplates";
import { BarcodeSvg } from "../../common/print/BarcodeSvg";

interface Props {
  invoice: InvoiceEntity;
  receiptConfig: ThermalReceiptConfig;
  pharmacyName: string;
  address?: string;
  phone?: string;
  taxNumber?: string;
  cashierName?: string;
  footerText: string;
}

/**
 * معاينة الإيصال الحراري الحية بمقاس 58mm أو 80mm مع باركود المرتجع وتذييل الصيدلية
 */
export const ReceiptPreviewPane: React.FC<Props> = ({
  invoice,
  receiptConfig,
  pharmacyName,
  address,
  phone,
  taxNumber,
  cashierName,
  footerText,
}) => (
  <div
    style={{
      width: `${receiptConfig.paperWidthMm}mm`,
      padding: `${receiptConfig.marginMm}mm`,
      fontSize: `${(8.2 * receiptConfig.fontScale).toFixed(2)}pt`,
    }}
    className="bg-white text-slate-950 rounded shadow-xl font-mono space-y-2 transition-all"
  >
    {receiptConfig.showPharmacyHeader && (
      <div className="text-center border-b border-dashed border-slate-400 pb-2">
        <div className="font-extrabold text-[1.2em] font-sans">
          {pharmacyName}
        </div>
        {receiptConfig.showPhone && address && (
          <div className="text-[0.88em] font-sans text-slate-600">
            {address}
          </div>
        )}
        {receiptConfig.showPhone && phone && (
          <div className="text-[0.88em]">هاتف: {phone}</div>
        )}
        {taxNumber && (
          <div className="text-[0.88em]">الرقم الضريبي: {taxNumber}</div>
        )}
      </div>
    )}

    <div className="text-[0.9em] space-y-0.5 border-b border-dashed border-slate-400 pb-2 font-sans">
      <div className="flex justify-between gap-2">
        <span>رقم الفاتورة:</span>
        <b className="font-mono">{invoice.id}</b>
      </div>
      <div className="flex justify-between gap-2">
        <span>التاريخ:</span>
        <span className="font-mono">
          {new Date(invoice.createdAt).toLocaleString("ar-SA")}
        </span>
      </div>
      <div className="flex justify-between gap-2">
        <span>العميل:</span>
        <b>{invoice.customerName || "عميل نقدي"}</b>
      </div>
      {receiptConfig.showCashierName && cashierName && (
        <div className="flex justify-between gap-2">
          <span>الصيدلي:</span>
          <b>{cashierName}</b>
        </div>
      )}
      <div className="flex justify-between gap-2">
        <span>النوع / الدفع:</span>
        <b>
          {invoice.type === "SALE" ? "مبيعات" : "مرتجع"} (
          {invoice.paymentMode === "CASH" ? "نقدي" : "آجل"})
        </b>
      </div>
    </div>

    <div className="space-y-1.5 border-b border-dashed border-slate-400 pb-2">
      {invoice.items.map((item) => (
        <div key={item.cartKey} className="text-[0.92em]">
          <div className="font-bold font-sans">
            {item.product.name} ({item.unit === "pack" ? "علبة" : "شريط"})
          </div>
          {receiptConfig.showBarcodeOnItems && item.product.barcode && (
            <div className="text-[0.82em] text-slate-500">
              {item.product.barcode}
            </div>
          )}
          <div className="flex justify-between">
            <span>
              {item.qty} × {item.unitPrice.toFixed(2)}
            </span>
            <b>{(item.qty * item.unitPrice).toFixed(2)}</b>
          </div>
        </div>
      ))}
    </div>

    <div className="space-y-1 text-[0.98em] font-sans">
      <div className="flex justify-between">
        <span>الإجمالي قبل الخصم:</span>
        <span className="font-mono">{invoice.subtotal.toFixed(2)}</span>
      </div>
      {receiptConfig.showItemDiscount && invoice.discountPercent > 0 && (
        <div className="flex justify-between text-slate-600">
          <span>الخصم ({invoice.discountPercent}%):</span>
          <span className="font-mono">
            -{((invoice.subtotal * invoice.discountPercent) / 100).toFixed(2)}
          </span>
        </div>
      )}
      <div className="flex justify-between font-extrabold text-[1.15em] border-t border-slate-400 pt-1">
        <span>الصافي النهائي:</span>
        <span className="font-mono">{invoice.totalAmount.toFixed(2)} ر.س</span>
      </div>
    </div>

    {/* باركود رقم الفاتورة لسهولة مسحه عند المرتجع */}
    <div className="pt-2 border-t border-dashed border-slate-400 text-center">
      <BarcodeSvg code={invoice.id} />
      <div className="font-mono text-[0.9em] tracking-widest font-bold">
        *{invoice.id}*
      </div>
      {footerText && (
        <div className="text-[0.82em] font-sans text-slate-600 mt-1">
          {footerText}
        </div>
      )}
    </div>
  </div>
);
