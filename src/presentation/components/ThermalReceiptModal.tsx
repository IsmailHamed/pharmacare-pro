import React, { useState } from "react";
import { InvoiceEntity } from "../../domain/entities/Invoice";
import { usePosStore } from "../../application/store/usePosStore";
import { printThermalReceipt } from "../../infrastructure/tauri/printer";
import { Printer, X, Tag, Receipt, Zap } from "lucide-react";

interface Props {
  invoice: InvoiceEntity | null;
  onClose: () => void;
}

export const ThermalReceiptModal: React.FC<Props> = ({ invoice, onClose }) => {
  const { settings, setNotification } = usePosStore();
  const [activeTab, setActiveTab] = useState<"RECEIPT" | "LABELS">("RECEIPT");
  const [dosageMap, setDosageMap] = useState<Record<string, string>>({});
  const [isPrinting, setIsPrinting] = useState(false);

  if (!invoice) return null;

  const getDosageText = (cartKey: string): string =>
    dosageMap[cartKey] ?? "قرص واحد كل 8 ساعات بعد الأكل";

  const handleSilentDirectPrint = async () => {
    setIsPrinting(true);
    const ok = await printThermalReceipt(invoice);
    setIsPrinting(false);

    if (ok) {
      setNotification({
        type: "success",
        message: `تم إرسال الإيصال (${invoice.id}) بالطباعة الصامتة الفورية إلى الطابعة (${settings.thermalPrinterName}).`,
      });
      onClose();
    } else {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* شريط التبديل بين الفاتورة الحرارية ولصاقة الجرعات */}
        <div className="p-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("RECEIPT")}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 ${
                activeTab === "RECEIPT"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-900 text-slate-400"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" /> الإيصال الحراري (80mm)
            </button>
            <button
              onClick={() => setActiveTab("LABELS")}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 ${
                activeTab === "LABELS"
                  ? "bg-sky-600 text-white"
                  : "bg-slate-900 text-slate-400"
              }`}
            >
              <Tag className="w-3.5 h-3.5" /> لصاقات الجرعات (
              {invoice.items.length})
            </button>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-900 p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* محتوى المعاينة */}
        <div className="p-5 bg-slate-950 max-h-[68vh] overflow-y-auto flex flex-col items-center">
          {activeTab === "RECEIPT" ? (
            <div className="bg-white text-slate-950 w-[300px] p-4 rounded shadow-xl font-mono text-[11px] space-y-2">
              <div className="text-center border-b border-dashed border-slate-400 pb-2">
                <div className="font-extrabold text-sm font-sans">
                  {settings.pharmacyName}
                </div>
                {settings.address && (
                  <div className="text-[10px] font-sans text-slate-600">
                    {settings.address}
                  </div>
                )}
                {settings.phone && (
                  <div className="text-[10px]">هاتف: {settings.phone}</div>
                )}
                {settings.taxNumber && (
                  <div className="text-[10px]">
                    الرقم الضريبي: {settings.taxNumber}
                  </div>
                )}
              </div>

              <div className="text-[10px] space-y-0.5 border-b border-dashed border-slate-400 pb-2 font-sans">
                <div className="flex justify-between">
                  <span>رقم الفاتورة:</span>
                  <b className="font-mono">{invoice.id}</b>
                </div>
                <div className="flex justify-between">
                  <span>التاريخ:</span>
                  <span className="font-mono">
                    {new Date(invoice.createdAt).toLocaleString("ar-SA")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>العميل:</span>
                  <b>{invoice.customerName || "عميل نقدي"}</b>
                </div>
                <div className="flex justify-between">
                  <span>النوع / الدفع:</span>
                  <b>
                    {invoice.type === "SALE" ? "مبيعات" : "مرتجع"} (
                    {invoice.paymentMode === "CASH" ? "نقدي" : "آجل"})
                  </b>
                </div>
              </div>

              <div className="space-y-1 border-b border-dashed border-slate-400 pb-2">
                {invoice.items.map((item) => (
                  <div key={item.cartKey} className="text-[10px]">
                    <div className="font-bold font-sans">
                      {item.product.name} (
                      {item.unit === "pack" ? "علبة" : "شريط"})
                    </div>
                    <div className="flex justify-between">
                      <span>
                        {item.qty} × {item.unitPrice.toFixed(2)}
                      </span>
                      <b>{(item.qty * item.unitPrice).toFixed(2)}</b>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-xs font-sans">
                <div className="flex justify-between">
                  <span>الإجمالي قبل الخصم:</span>
                  <span className="font-mono">
                    {invoice.subtotal.toFixed(2)}
                  </span>
                </div>
                {invoice.discountPercent > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>الخصم ({invoice.discountPercent}%):</span>
                    <span className="font-mono">
                      -
                      {(
                        (invoice.subtotal * invoice.discountPercent) /
                        100
                      ).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-sm border-t border-slate-400 pt-1">
                  <span>الصافي النهائي:</span>
                  <span className="font-mono">
                    {invoice.totalAmount.toFixed(2)} ر.س
                  </span>
                </div>
              </div>

              {/* باركود رقم الفاتورة لسهولة مسحه عند المرتجع */}
              <div className="pt-2 border-t border-dashed border-slate-400 text-center">
                <div className="font-mono text-[10px] tracking-widest font-bold">
                  *{invoice.id}*
                </div>
                {settings.receiptFooter && (
                  <div className="text-[9px] font-sans text-slate-600 mt-1">
                    {settings.receiptFooter}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full space-y-3">
              {invoice.items.map((item) => (
                <div
                  key={item.cartKey}
                  className="bg-white text-slate-950 p-3 rounded-xl border-2 border-slate-300 space-y-1.5"
                >
                  <div className="flex justify-between text-[10px] font-bold border-b border-slate-300 pb-1">
                    <span>{settings.pharmacyName}</span>
                    <span>{invoice.customerName || "عميل نقدي"}</span>
                  </div>
                  <div className="font-extrabold text-xs">
                    {item.product.name}
                  </div>
                  <input
                    type="text"
                    value={getDosageText(item.cartKey)}
                    onChange={(e) =>
                      setDosageMap((prev) => ({
                        ...prev,
                        [item.cartKey]: e.target.value,
                      }))
                    }
                    className="w-full bg-amber-50 border border-amber-300 rounded p-1.5 text-slate-900 font-bold text-[11px]"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* أزرار الطباعة الصامتة والعادية */}
        <div className="p-3.5 bg-slate-800 border-t border-slate-700 flex gap-2">
          {activeTab === "RECEIPT" ? (
            <button
              onClick={() => void handleSilentDirectPrint()}
              disabled={isPrinting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-lg"
            >
              <Zap className="w-4 h-4" />
              {isPrinting
                ? "جاري الإرسال للطابعة..."
                : `طباعة صامتة مباشرة (${settings.thermalPrinterName})`}
            </button>
          ) : (
            <button
              onClick={() => window.print()}
              className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-lg"
            >
              <Printer className="w-4 h-4" /> طباعة لصاقات الجرعات
            </button>
          )}

          <button
            onClick={() => window.print()}
            title="فتح نافذة طباعة النظام العادية"
            className="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl flex items-center gap-1"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
