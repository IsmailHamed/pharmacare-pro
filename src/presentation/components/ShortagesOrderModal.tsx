import React, { useEffect, useMemo, useState } from "react";
import { usePosStore } from "../../application/store/usePosStore";
import {
  ClipboardList,
  X,
  FileSpreadsheet,
  Copy,
  Check,
  AlertTriangle,
  Building2,
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortagesOrderModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { products, settings, setNotification } = usePosStore();

  // التحقق من صلاحية المستخدم الحالي للاطلاع على التكلفة المرجحة والأرباح (القيمة الافتراضية الآمنة: false)
  const canViewCostAndProfit = usePosStore(
    (s) => s.currentUser?.permissions.canViewCostAndProfit ?? false,
  );

  const [supplierName, setSupplierName] = useState("مستودع الأدوية المركزي");
  const [orderQtyMap, setOrderQtyMap] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);

  // استخراج كافة الأصناف الواقعة عند أو تحت حد الطلب (minLimit)
  const shortageProducts = useMemo(
    () =>
      products
        .filter((p) => p.stockPacks <= p.minLimit)
        .sort((a, b) => a.stockPacks - b.stockPacks),
    [products],
  );

  // تهيئة الكميات المقترحة تلقائياً لكل صنف ناقص
  useEffect(() => {
    const initialMap: Record<string, number> = {};
    shortageProducts.forEach((p) => {
      const suggested = Math.max(5, p.minLimit * 2 - p.stockPacks);
      initialMap[p.id] = suggested;
    });
    setOrderQtyMap(initialMap);
  }, [shortageProducts]);

  if (!isOpen) return null;

  const getOrderQty = (productId: string, fallback: number): number =>
    orderQtyMap[productId] !== undefined ? orderQtyMap[productId] : fallback;

  // حساب التكلفة التقديرية الإجمالية للطلبية (تُعرض فقط لمن يمتلك صلاحية canViewCostAndProfit)
  const totalEstimatedCost = shortageProducts.reduce((sum, p) => {
    const qty = getOrderQty(p.id, Math.max(5, p.minLimit * 2 - p.stockPacks));
    return sum + qty * p.weightedCostPrice;
  }, 0);

  // بناء نص طلبية مرتب لإرساله عبر واتساب لمندوب المستودع (خالي من أسعار التكلفة السرية)
  const buildWhatsAppOrderText = (): string => {
    const dateStr = new Date().toLocaleDateString("ar-SA");
    const lines = shortageProducts
      .map((p, idx) => {
        const qty = getOrderQty(
          p.id,
          Math.max(5, p.minLimit * 2 - p.stockPacks),
        );
        if (qty <= 0) return null;
        return `${idx + 1}. ${p.name} (${p.scientificName}) — المطلوب: [${qty} علبة]`;
      })
      .filter(Boolean);

    return [
      `📋 *طلبية نواقص أدوية - ${settings.pharmacyName}*`,
      `التاريخ: ${dateStr}`,
      `إلى السادة: ${supplierName}`,
      `--------------------------------`,
      ...lines,
      `--------------------------------`,
      `إجمالي الأصناف المطلوبة: ${lines.length} صنف`,
      `هاتف الصيدلية: ${settings.phone}`,
    ].join("\n");
  };

  const handleCopyWhatsApp = async () => {
    const text = buildWhatsAppOrderText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    setNotification({
      type: "success",
      message: "تم نسخ نص طلبية النواقص! يمكنك لصقها مباشرة في واتساب المندوب.",
    });
  };

  // تصدير ملف CSV متوافق مع Excel بالترميز العربي (UTF-8 BOM)
  // يتم استبعاد أعمدة التكلفة تلقائياً إذا لم يمتلك المستخدم صلاحية رؤية التكلفة والأرباح
  const handleExportCsvOrder = () => {
    const headers = [
      "الباركود",
      "الاسم التجاري للدواء",
      "المادة الفعالة",
      "الرصيد الحالي (علبة)",
      "حد الطلب الأدنى",
      "الكمية المطلوبة (علبة)",
      ...(canViewCostAndProfit
        ? ["آخر تكلفة مرجحة للعلبة", "التكلفة التقديرية للسطر"]
        : []),
    ];

    const rows = shortageProducts
      .map((p) => {
        const qty = getOrderQty(
          p.id,
          Math.max(5, p.minLimit * 2 - p.stockPacks),
        );
        if (qty <= 0) return null;

        const baseColumns = [
          `"${p.barcode}"`,
          `"${p.name}"`,
          `"${p.scientificName}"`,
          p.stockPacks,
          p.minLimit,
          qty,
        ];

        // إضافة قيم التكلفة فقط للمستخدمين المخوّلين
        if (canViewCostAndProfit) {
          baseColumns.push(
            p.weightedCostPrice.toFixed(2),
            (qty * p.weightedCostPrice).toFixed(2),
          );
        }

        return baseColumns.join(",");
      })
      .filter(Boolean);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const datePart = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `Purchase_Order_${datePart}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotification({
      type: "success",
      message: `تم تصدير ملف طلبية المستودع (Purchase_Order_${datePart}.csv) بنجاح.`,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* رأس النافذة */}
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-white text-sm">
              دفتر النواقص الذكي وتوليد طلبية المستودع (Purchase Order)
            </h3>
            <span className="bg-sky-950 border border-sky-800 text-sky-300 font-mono text-[10px] px-2 py-0.5 rounded-full">
              {shortageProducts.length} صنف تحت حد الطلب
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-900 p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* شريط اسم المستودع والتكلفة التقديرية (مخفية عن غير المخولين) */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400 shrink-0">
              اسم المستودع الموجه له الطلب:
            </span>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white outline-none focus:border-sky-500"
            />
          </div>

          {canViewCostAndProfit && (
            <div className="bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl flex items-center gap-2">
              <span className="text-slate-400">التكلفة التقديرية للطلبية:</span>
              <b className="font-mono text-sm text-amber-400">
                {totalEstimatedCost.toFixed(2)} ر.س
              </b>
            </div>
          )}
        </div>

        {/* جدول النواقص وتحديد الكميات */}
        <div className="flex-1 overflow-y-auto p-4">
          {shortageProducts.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <p className="text-sm font-bold text-emerald-400">
                ممتاز! لا توجد أي نواقص تحت حد الطلب في الصيدلية حالياً.
              </p>
            </div>
          ) : (
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                  <th className="py-2 px-2">الدواء / المادة الفعالة</th>
                  <th className="py-2 px-2 text-center">الرصيد الفعلي</th>
                  <th className="py-2 px-2 text-center">حد الطلب</th>
                  {/* إخفاء عمود التكلفة عن غير المخولين */}
                  {canViewCostAndProfit && (
                    <th className="py-2 px-2 text-center">آخر تكلفة للعلبة</th>
                  )}
                  <th className="py-2 px-2 text-center">
                    الكمية المطلوبة (علبة)
                  </th>
                  {/* إخفاء عمود الإجمالي التقديري بالتكلفة عن غير المخولين */}
                  {canViewCostAndProfit && (
                    <th className="py-2 px-2 text-left">الإجمالي التقديري</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {shortageProducts.map((p) => {
                  const defaultSuggested = Math.max(
                    5,
                    p.minLimit * 2 - p.stockPacks,
                  );
                  const qty = getOrderQty(p.id, defaultSuggested);

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-2">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          {p.stockPacks === 0 && (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          )}
                          {p.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {p.scientificName} |{" "}
                          <span className="font-mono">{p.barcode}</span>
                        </div>
                      </td>

                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                            p.stockPacks === 0
                              ? "bg-rose-950 text-rose-300 border border-rose-800"
                              : "bg-amber-950 text-amber-300 border border-amber-800"
                          }`}
                        >
                          {p.stockPacks} علبة
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center font-mono text-slate-300">
                        {p.minLimit}
                      </td>

                      {canViewCostAndProfit && (
                        <td className="py-2.5 px-2 text-center font-mono text-amber-400">
                          {p.weightedCostPrice.toFixed(2)}
                        </td>
                      )}

                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="number"
                          min={0}
                          max={500}
                          value={qty}
                          onChange={(e) =>
                            setOrderQtyMap((prev) => ({
                              ...prev,
                              [p.id]: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="w-20 bg-slate-800 border border-sky-700 rounded-lg p-1.5 text-center font-mono font-bold text-white outline-none focus:border-sky-400"
                        />
                      </td>

                      {canViewCostAndProfit && (
                        <td className="py-2.5 px-2 text-left font-mono font-bold text-emerald-400">
                          {(qty * p.weightedCostPrice).toFixed(2)}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* أزرار التصدير والنسخ للواتساب */}
        <div className="p-4 bg-slate-800 border-t border-slate-700 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-1">
            <button
              type="button"
              disabled={shortageProducts.length === 0}
              onClick={() => void handleCopyWhatsApp()}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" /> تم نسخ نص الطلبية للواتساب!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> نسخ طلبية النواقص (WhatsApp)
                </>
              )}
            </button>

            <button
              type="button"
              disabled={shortageProducts.length === 0}
              onClick={handleExportCsvOrder}
              className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
            >
              <FileSpreadsheet className="w-4 h-4" /> تصدير ملف الطلبية (Excel /
              CSV)
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
