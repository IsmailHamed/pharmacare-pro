import React, { useMemo, useState } from "react";
import { usePosStore } from "../../application/store/usePosStore";
import { InvoiceEntity } from "../../domain/entities/Invoice";
import {
  FileText,
  X,
  Search,
  Printer,
  Undo2,
  Eye,
  Calendar,
  User,
  CreditCard,
  Banknote,
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const InvoicesHistoryModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { invoices, setLastPrintedInvoice, loadInvoiceForReturn } =
    usePosStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "SALE" | "RETURN">(
    "ALL",
  );
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | "CASH" | "CREDIT">(
    "ALL",
  );
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceEntity | null>(
    null,
  );

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (typeFilter !== "ALL" && inv.type !== typeFilter) return false;
      if (paymentFilter !== "ALL" && inv.paymentMode !== paymentFilter)
        return false;

      if (!q) return true;

      const matchesId = inv.id.toLowerCase().includes(q);
      const matchesCustomer = inv.customerName.toLowerCase().includes(q);
      const matchesDrug = inv.items.some(
        (item) =>
          item.product.name.toLowerCase().includes(q) ||
          item.product.barcode.includes(q),
      );

      return matchesId || matchesCustomer || matchesDrug;
    });
  }, [invoices, searchQuery, typeFilter, paymentFilter]);

  if (!isOpen) return null;

  const activeInvoice = selectedInvoice || filteredInvoices[0] || null;

  const handleReprint = (invoice: InvoiceEntity) => {
    setLastPrintedInvoice(invoice);
    onClose();
  };

  const handleReturnInvoice = (invoice: InvoiceEntity) => {
    const ok = loadInvoiceForReturn(invoice.id);
    if (ok) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl h-[82vh] flex flex-col overflow-hidden shadow-2xl">
        {/* رأس النافذة */}
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-white text-sm">
              سجل الفواتير السابقة وإعادة الطباعة والاسترداد
            </h3>
            <span className="bg-slate-900 border border-slate-700 text-slate-300 font-mono text-[10px] px-2 py-0.5 rounded-full">
              إجمالي السجلات: {filteredInvoices.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-900 p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* شريط البحث والفلترة */}
        <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center gap-3 flex-wrap shrink-0">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الفاتورة (INV-...)، اسم العميل، أو اسم/باركود الدواء..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-white outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setTypeFilter("ALL")}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                typeFilter === "ALL"
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              الكل
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("SALE")}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                typeFilter === "SALE"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              مبيعات
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("RETURN")}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                typeFilter === "RETURN"
                  ? "bg-rose-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              مرتجعات
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setPaymentFilter("ALL")}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                paymentFilter === "ALL"
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              كل طرق الدفع
            </button>
            <button
              type="button"
              onClick={() => setPaymentFilter("CASH")}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                paymentFilter === "CASH"
                  ? "bg-sky-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              نقدي
            </button>
            <button
              type="button"
              onClick={() => setPaymentFilter("CREDIT")}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                paymentFilter === "CREDIT"
                  ? "bg-amber-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              آجل (ذمم)
            </button>
          </div>
        </div>

        {/* القسم الرئيسي: قائمة الفواتير يميناً + تفاصيل الفاتورة المحددة يساراً */}
        <div className="flex-1 flex overflow-hidden">
          {/* قائمة الفواتير */}
          <div className="w-7/12 border-l border-slate-800 overflow-y-auto p-3 space-y-2">
            {filteredInvoices.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <FileText className="w-10 h-10 mb-2 opacity-20" />
                <p>لا توجد فواتير مطابقة لمعايير البحث</p>
              </div>
            ) : (
              filteredInvoices.map((inv) => {
                const isSelected = activeInvoice?.id === inv.id;
                return (
                  <div
                    key={inv.id}
                    onClick={() => setSelectedInvoice(inv)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? "bg-slate-800/90 border-emerald-500 shadow"
                        : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-white text-xs">
                          {inv.id}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            inv.type === "SALE"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : "bg-rose-950 text-rose-300 border border-rose-800"
                          }`}
                        >
                          {inv.type === "SALE" ? "فاتورة بيع" : "فاتورة مرتجع"}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                            inv.paymentMode === "CASH"
                              ? "bg-sky-950 text-sky-300 border border-sky-800"
                              : "bg-amber-950 text-amber-300 border border-amber-800"
                          }`}
                        >
                          {inv.paymentMode === "CASH" ? (
                            <>
                              <Banknote className="w-3 h-3" /> نقدي
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-3 h-3" /> آجل
                            </>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />{" "}
                          {inv.customerName || "عميل نقدي"}
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3" />
                          {new Date(inv.createdAt).toLocaleString("ar-SA")}
                        </span>
                        <span>({inv.items.length} أصناف)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <div className="text-[10px] text-slate-400">الصافي</div>
                        <div
                          className={`font-mono font-extrabold text-sm ${
                            inv.type === "RETURN"
                              ? "text-rose-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {inv.totalAmount.toFixed(2)} ر.س
                        </div>
                      </div>
                      <Eye className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* تفاصيل الفاتورة المحددة وأزرار الإجراءات */}
          <div className="w-5/12 bg-slate-950 p-4 flex flex-col justify-between overflow-y-auto">
            {activeInvoice ? (
              <>
                <div className="space-y-4">
                  <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                    <div>
                      <div className="text-slate-400 text-[11px]">
                        تفاصيل الفاتورة المحددة
                      </div>
                      <div className="font-mono font-extrabold text-base text-white mt-0.5">
                        {activeInvoice.id}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-slate-400 text-[11px]">العميل</div>
                      <div className="font-bold text-white">
                        {activeInvoice.customerName || "عميل نقدي"}
                      </div>
                    </div>
                  </div>

                  {/* جدول أصناف الفاتورة */}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    <div className="text-slate-400 font-bold text-[11px]">
                      الأدوية المصروفة في الفاتورة ({activeInvoice.items.length}
                      ):
                    </div>
                    {activeInvoice.items.map((item) => (
                      <div
                        key={item.cartKey}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-white">
                            {item.product.name}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            الوحدة:{" "}
                            <b className="text-slate-300">
                              {item.unit === "pack" ? "علبة كاملة" : "شريط فرط"}
                            </b>{" "}
                            | السعر: {item.unitPrice.toFixed(2)} × {item.qty}
                          </div>
                        </div>
                        <div className="font-mono font-bold text-emerald-400">
                          {(item.unitPrice * item.qty).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* الملخص المالي للفاتورة */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1.5">
                    <div className="flex justify-between text-slate-400">
                      <span>الإجمالي الفرعي:</span>
                      <span className="font-mono">
                        {activeInvoice.subtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>نسبة الخصم:</span>
                      <span className="font-mono">
                        {activeInvoice.discountPercent}%
                      </span>
                    </div>
                    <div className="flex justify-between font-extrabold text-sm text-white pt-1.5 border-t border-slate-800">
                      <span>الصافي النهائي:</span>
                      <span className="font-mono text-emerald-400">
                        {activeInvoice.totalAmount.toFixed(2)} ر.س
                      </span>
                    </div>
                  </div>
                </div>

                {/* أزرار إعادة الطباعة واسترداد الفاتورة للمرتجع */}
                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleReprint(activeInvoice)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Printer className="w-4 h-4" /> معاينة وإعادة طباعة الفاتورة
                    ولصاقات الجرعات
                  </button>

                  {activeInvoice.type === "SALE" && (
                    <button
                      type="button"
                      onClick={() => handleReturnInvoice(activeInvoice)}
                      className="w-full bg-amber-600/20 hover:bg-amber-600 border border-amber-600/60 text-amber-300 hover:text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition"
                    >
                      <Undo2 className="w-4 h-4" /> استرداد هذه الفاتورة بالكامل
                      لشاشة المرتجع
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">
                اختر فاتورة من القائمة لعرض تفاصيلها
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
