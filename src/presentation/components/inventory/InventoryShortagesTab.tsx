import React, { useEffect, useMemo, useState } from "react";
import { ProductEntity } from "../../../domain/entities";
import { usePosStore } from "../../../application/store/usePosStore";
import {
  ClipboardList,
  FileSpreadsheet,
  Copy,
  Check,
  AlertTriangle,
  Building2,
  Search,
  RotateCcw,
} from "lucide-react";

interface Props {
  shortageProducts: ProductEntity[];
  canViewCost: boolean;
}

const getSuggestedQty = (product: ProductEntity): number =>
  Math.max(5, product.minLimit * 2 - product.stockPacks);

/**
 * تبويب دفتر النواقص الذكي وتوليد طلبية المستودع (Purchase Order)
 * مدمج داخل شاشة المخزون والصلاحيات مع احترام صلاحية عرض التكلفة (canViewCost)
 */
export const InventoryShortagesTab: React.FC<Props> = ({
  shortageProducts,
  canViewCost,
}) => {
  const { settings, setNotification } = usePosStore();

  const [supplierName, setSupplierName] = useState("مستودع الأدوية المركزي");
  const [orderQtyMap, setOrderQtyMap] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  // تهيئة الكميات المقترحة للأصناف الجديدة مع الحفاظ على التعديلات اليدوية للصيدلي
  useEffect(() => {
    setOrderQtyMap((prev) => {
      const next: Record<string, number> = {};
      shortageProducts.forEach((p) => {
        next[p.id] = prev[p.id] !== undefined ? prev[p.id] : getSuggestedQty(p);
      });
      return next;
    });
  }, [shortageProducts]);

  const getOrderQty = (product: ProductEntity): number =>
    orderQtyMap[product.id] !== undefined
      ? orderQtyMap[product.id]
      : getSuggestedQty(product);

  const handleResetSuggested = () => {
    const resetMap: Record<string, number> = {};
    shortageProducts.forEach((p) => {
      resetMap[p.id] = getSuggestedQty(p);
    });
    setOrderQtyMap(resetMap);
  };

  // تصفية العرض فقط للبحث السريع، بينما يشمل التصدير والنسخ كامل أصناف الطلبية ذات الكمية > 0
  const filteredShortages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return shortageProducts;
    return shortageProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.scientificName.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q),
    );
  }, [shortageProducts, searchQuery]);

  const outOfStockCount = useMemo(
    () => shortageProducts.filter((p) => p.stockPacks === 0).length,
    [shortageProducts],
  );

  const activeOrderItems = useMemo(
    () =>
      shortageProducts
        .map((product) => ({
          product,
          qty:
            orderQtyMap[product.id] !== undefined
              ? orderQtyMap[product.id]
              : getSuggestedQty(product),
        }))
        .filter((entry) => entry.qty > 0),
    [shortageProducts, orderQtyMap],
  );

  // حساب التكلفة التقديرية الإجمالية للطلبية (تُعرض فقط لمن يمتلك صلاحية canViewCost)
  const totalEstimatedCost = useMemo(
    () =>
      activeOrderItems.reduce(
        (sum, { product, qty }) => sum + qty * product.weightedCostPrice,
        0,
      ),
    [activeOrderItems],
  );

  // بناء نص طلبية مرتب لإرساله عبر واتساب لمندوب المستودع (خالي من أسعار التكلفة السرية)
  const buildWhatsAppOrderText = (): string => {
    const dateStr = new Date().toLocaleDateString("ar-SA");
    const lines = activeOrderItems.map(
      ({ product, qty }, idx) =>
        `${idx + 1}. ${product.name} (${product.scientificName}) — المطلوب: [${qty} علبة]`,
    );

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
    if (activeOrderItems.length === 0) return;
    const text = buildWhatsAppOrderText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
    setNotification({
      type: "success",
      message: "تم نسخ نص طلبية النواقص! يمكنك لصقها مباشرة في واتساب المندوب.",
    });
  };

  // تصدير ملف CSV متوافق مع Excel بالترميز العربي (UTF-8 BOM)
  // يتم استبعاد أعمدة التكلفة تلقائياً إذا لم يمتلك المستخدم صلاحية رؤية التكلفة والأرباح
  const handleExportCsvOrder = () => {
    if (activeOrderItems.length === 0) return;

    const headers = [
      "الباركود",
      "الاسم التجاري للدواء",
      "المادة الفعالة",
      "الرصيد الحالي (علبة)",
      "حد الطلب الأدنى",
      "الكمية المطلوبة (علبة)",
      ...(canViewCost
        ? ["آخر تكلفة مرجحة للعلبة", "التكلفة التقديرية للسطر"]
        : []),
    ];

    const rows = activeOrderItems.map(({ product, qty }) => {
      const baseColumns: (string | number)[] = [
        `"${product.barcode}"`,
        `"${product.name}"`,
        `"${product.scientificName}"`,
        product.stockPacks,
        product.minLimit,
        qty,
      ];

      if (canViewCost) {
        baseColumns.push(
          product.weightedCostPrice.toFixed(2),
          (qty * product.weightedCostPrice).toFixed(2),
        );
      }

      return baseColumns.join(",");
    });

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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* الترويسة وملخص النواقص */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-sky-400" /> دفتر النواقص
            الذكي وتوليد طلبية المستودع (Purchase Order)
          </h3>
          <p className="text-slate-400 text-[11px] mt-0.5">
            مراجعة الأصناف الواقعة عند أو تحت حد الطلب، تعديل الكميات المطلوبة،
            ونسخ الطلبية للواتساب أو تصديرها لـ Excel.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] text-slate-400">أصناف تحت الحد</div>
            <div className="font-mono font-bold text-sky-300 text-sm">
              {shortageProducts.length}
            </div>
          </div>

          {outOfStockCount > 0 && (
            <div className="bg-rose-950/35 border border-rose-800/70 rounded-xl px-3.5 py-2 text-center">
              <div className="text-[10px] text-rose-300/80">
                نفد بالكامل (0)
              </div>
              <div className="font-mono font-extrabold text-rose-400 text-sm">
                {outOfStockCount}
              </div>
            </div>
          )}

          {canViewCost && (
            <div className="bg-amber-950/30 border border-amber-800/70 rounded-xl px-3.5 py-2 text-center">
              <div className="text-[10px] text-amber-300/80">
                التكلفة التقديرية للطلبية
              </div>
              <div className="font-mono font-extrabold text-amber-400 text-sm">
                {totalEstimatedCost.toFixed(2)} ر.س
              </div>
            </div>
          )}
        </div>
      </div>

      {/* شريط اسم المستودع + أزرار التصدير والنسخ للواتساب */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-slate-400 shrink-0">
            المستودع الموجه له الطلب:
          </span>
          <input
            type="text"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={activeOrderItems.length === 0}
            onClick={() => void handleCopyWhatsApp()}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold py-2 px-3.5 rounded-xl flex items-center gap-1.5 shadow transition"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" /> تم النسخ للواتساب!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> نسخ للواتساب (
                {activeOrderItems.length})
              </>
            )}
          </button>

          <button
            type="button"
            disabled={activeOrderItems.length === 0}
            onClick={handleExportCsvOrder}
            className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold py-2 px-3.5 rounded-xl flex items-center gap-1.5 shadow transition"
          >
            <FileSpreadsheet className="w-4 h-4" /> تصدير الطلبية (Excel / CSV)
          </button>
        </div>
      </div>

      {/* شريط البحث داخل النواقص + إعادة ضبط الكميات المقترحة */}
      {shortageProducts.length > 0 && (
        <div className="flex items-center justify-between gap-3 bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث داخل النواقص بالاسم التجاري، المادة الفعالة، أو الباركود..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pr-9 pl-3 py-1.5 text-white outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-slate-400 font-mono">
              المعروض: <b className="text-white">{filteredShortages.length}</b>{" "}
              • ضمن الطلبية:{" "}
              <b className="text-sky-400">{activeOrderItems.length}</b>
            </span>
            <button
              type="button"
              onClick={handleResetSuggested}
              title="إعادة تعيين جميع الكميات للقيمة المقترحة تلقائياً"
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              الكميات المقترحة
            </button>
          </div>
        </div>
      )}

      {/* جدول النواقص أو الحالة الفارغة */}
      {shortageProducts.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-center gap-2">
          <ClipboardList className="w-9 h-9 text-emerald-500/50 stroke-1" />
          <p className="text-sm font-bold text-emerald-400">
            ممتاز! لا توجد أي نواقص تحت حد الطلب في الصيدلية حالياً.
          </p>
        </div>
      ) : filteredShortages.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          لا توجد أصناف ناقصة مطابقة لـ «{searchQuery.trim()}».
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="py-2 px-2">الدواء / المادة الفعالة</th>
                <th className="py-2 px-2 text-center">الرصيد الفعلي</th>
                <th className="py-2 px-2 text-center">حد الطلب</th>
                {canViewCost && (
                  <th className="py-2 px-2 text-center">آخر تكلفة للعلبة</th>
                )}
                <th className="py-2 px-2 text-center">
                  الكمية المطلوبة (علبة)
                </th>
                {canViewCost && (
                  <th className="py-2 px-2 text-left">الإجمالي التقديري</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredShortages.map((p) => {
                const qty = getOrderQty(p);

                return (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition">
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

                    {canViewCost && (
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

                    {canViewCost && (
                      <td className="py-2.5 px-2 text-left font-mono font-bold text-emerald-400">
                        {(qty * p.weightedCostPrice).toFixed(2)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
