import React, { useMemo, useState } from "react";
import { usePosStore } from "../../application/store/usePosStore";
import { PackagePlus, CheckCircle2, Trash2, Plus } from "lucide-react";
import { AddPurchaseWithBonusUseCase } from "../../application/use-cases/AddPurchaseWithBonus";
import { PurchaseLineInput } from "../../application/use-cases/AddPurchaseWithBonus";

interface DraftLine {
  productId: string;
  batchNumber: string;
  expiryDate: string;
  purchasedPacks: number;
  bonusPacks: number;
  purchasePricePerPack: number;
  newPackSalePrice: number;
}

const emptyLine = (productId: string): DraftLine => ({
  productId,
  batchNumber: "",
  expiryDate: new Date().toISOString().slice(0, 10),
  purchasedPacks: 10,
  bonusPacks: 0,
  purchasePricePerPack: 10,
  newPackSalePrice: 0,
});

export const PurchasesView: React.FC = () => {
  const { products, purchaseInvoices, createPurchaseWithBonus } = usePosStore();

  const [supplier, setSupplier] = useState("");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "CREDIT">("CASH");
  const [lines, setLines] = useState<DraftLine[]>(() =>
    products[0] ? [emptyLine(products[0].id)] : [],
  );
  const [toast, setToast] = useState("");

  const linePreview = useMemo(
    () =>
      lines.map((l) => {
        const product = products.find((p) => p.id === l.productId);
        const calc = product
          ? AddPurchaseWithBonusUseCase.calculateWeightedCost(
              product.stockPacks,
              product.weightedCostPrice,
              l.purchasedPacks,
              l.bonusPacks,
              l.purchasePricePerPack,
            )
          : null;
        return { line: l, product, calc };
      }),
    [lines, products],
  );

  const totalInvoice = linePreview.reduce(
    (sum, r) => sum + (r.calc?.lineTotalCost ?? 0),
    0,
  );
  const totalBonusValue = linePreview.reduce(
    (sum, r) => sum + (r.calc?.bonusSavedValue ?? 0),
    0,
  );

  const updateLine = (idx: number, patch: Partial<DraftLine>) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    );
  };

  const handleSave = async () => {
    if (!supplier.trim()) {
      alert("يجب إدخال اسم المستودع أو المورد");
      return;
    }
    const validLines: PurchaseLineInput[] = [];
    for (const r of linePreview) {
      if (!r.product) continue;
      if (r.line.purchasedPacks <= 0 && r.line.bonusPacks <= 0) {
        alert(`أدخل كمية مشتراة أو بونص للصنف ${r.product.name}`);
        return;
      }
      if (!r.line.batchNumber.trim()) {
        alert(`أدخل رقم التشغيلة (Batch) للصنف ${r.product.name}`);
        return;
      }
      validLines.push({
        product: r.product,
        batchNumber: r.line.batchNumber,
        expiryDate: r.line.expiryDate,
        purchasedPacks: r.line.purchasedPacks,
        bonusPacks: r.line.bonusPacks,
        purchasePricePerPack: r.line.purchasePricePerPack,
        newPackSalePrice: r.line.newPackSalePrice,
      });
    }
    if (validLines.length === 0) return;

    try {
      await createPurchaseWithBonus(
        supplier,
        supplierInvoiceNumber,
        paymentMode,
        validLines,
      );
      setSupplier("");
      setSupplierInvoiceNumber("");
      setLines(products[0] ? [emptyLine(products[0].id)] : []);
      setToast(
        "تم حفظ فاتورة المشتريات وتحديث التكلفة المرجحة والمخزون بنجاح!",
      );
      setTimeout(() => setToast(""), 3500);
    } catch (err) {
      alert(err instanceof Error ? err.message : "خطأ غير متوقع");
    }
  };

  const inputCls =
    "w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-indigo-500";

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-950 text-slate-200 text-xs">
      {toast && (
        <div className="mb-4 bg-emerald-900/80 border border-emerald-600 text-emerald-200 p-3 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" /> {toast}
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <PackagePlus className="w-5 h-5 text-indigo-400" /> إدخال فواتير
          المستودعات والبونص
        </h2>
        <p className="text-slate-400 mt-1">
          معادلة التكلفة المرجحة: (تكلفة الرصيد السابق + قيمة المشتريات) ÷
          (الرصيد + المشترى + البونص المجاني).
        </p>
      </div>

      {/* رأس الفاتورة */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4 space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-2">
            <label className="block text-slate-400 mb-1.5">
              المستودع / المورد
            </label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className={inputCls}
              placeholder="مستودع الأدوية الحديث..."
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1.5">
              رقم فاتورة المورد
            </label>
            <input
              type="text"
              value={supplierInvoiceNumber}
              onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
              className={inputCls}
              placeholder="SUP-1234"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1.5">طريقة الدفع</label>
            <select
              value={paymentMode}
              onChange={(e) =>
                setPaymentMode(e.target.value as "CASH" | "CREDIT")
              }
              className={inputCls}
            >
              <option value="CASH">نقدي</option>
              <option value="CREDIT">آجل</option>
            </select>
          </div>
        </div>

        {/* بنود الفاتورة */}
        {linePreview.map((r, idx) => (
          <div
            key={idx}
            className="bg-slate-950 border border-slate-800 rounded-lg p-3 grid grid-cols-8 gap-3 items-end"
          >
            <div className="col-span-2">
              <label className="block text-slate-400 mb-1">الصنف</label>
              <select
                value={r.line.productId}
                onChange={(e) => updateLine(idx, { productId: e.target.value })}
                className={inputCls}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">التشغيلة</label>
              <input
                type="text"
                value={r.line.batchNumber}
                onChange={(e) =>
                  updateLine(idx, { batchNumber: e.target.value })
                }
                className={inputCls}
                placeholder="BATCH-01"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">الصلاحية</label>
              <input
                type="date"
                value={r.line.expiryDate}
                onChange={(e) =>
                  updateLine(idx, { expiryDate: e.target.value })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">كمية مشتراة</label>
              <input
                type="number"
                min={0}
                value={r.line.purchasedPacks}
                onChange={(e) =>
                  updateLine(idx, { purchasedPacks: Number(e.target.value) })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-emerald-400 font-bold mb-1">
                + بونص
              </label>
              <input
                type="number"
                min={0}
                value={r.line.bonusPacks}
                onChange={(e) =>
                  updateLine(idx, { bonusPacks: Number(e.target.value) })
                }
                className="w-full bg-emerald-950 border border-emerald-800 rounded-lg p-2.5 text-emerald-300 font-mono font-bold outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">سعر العلبة</label>
              <input
                type="number"
                min={0}
                step="0.5"
                value={r.line.purchasePricePerPack}
                onChange={(e) =>
                  updateLine(idx, {
                    purchasePricePerPack: Number(e.target.value),
                  })
                }
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              {r.calc && (
                <div className="text-[10px] text-amber-400 font-mono">
                  تكلفة فعلية: {r.calc.newWeightedCostPrice.toFixed(2)} ر.س/علبة
                </div>
              )}
              <button
                onClick={() =>
                  setLines((prev) => prev.filter((_, i) => i !== idx))
                }
                className="bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-rose-300 rounded-lg p-2 flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between">
          <button
            onClick={() =>
              setLines((prev) => [...prev, emptyLine(products[0]?.id ?? "")])
            }
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> إضافة بند
          </button>
          <div className="flex items-center gap-4">
            <span className="text-slate-400">
              قيمة البونص المجاني:{" "}
              <b className="font-mono text-emerald-400">
                {totalBonusValue.toFixed(2)}
              </b>
            </span>
            <span className="text-slate-400">
              إجمالي الفاتورة:{" "}
              <b className="font-mono text-white text-sm">
                {totalInvoice.toFixed(2)} ر.س
              </b>
            </span>
            <button
              onClick={() => void handleSave()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-lg shadow-lg"
            >
              اعتماد الفاتورة وتحديث المخزون
            </button>
          </div>
        </div>
      </div>

      {/* سجل المشتريات */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-slate-800 text-slate-400">
            <tr>
              <th className="py-3 px-4">رقم القيد</th>
              <th className="py-3 px-4">المستودع</th>
              <th className="py-3 px-4">الإجمالي</th>
              <th className="py-3 px-4">قيمة البونص</th>
              <th className="py-3 px-4">التاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {purchaseInvoices.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-500 py-8">
                  لا توجد فواتير مشتريات مسجلة بعد
                </td>
              </tr>
            )}
            {purchaseInvoices.map((pr) => (
              <tr key={pr.id} className="hover:bg-slate-800/30">
                <td className="py-3 px-4 font-mono text-indigo-400">{pr.id}</td>
                <td className="py-3 px-4 font-bold text-white">
                  {pr.supplierName}
                </td>
                <td className="py-3 px-4 font-mono">
                  {pr.totalAmount.toFixed(2)}
                </td>
                <td className="py-3 px-4 font-mono text-emerald-400">
                  {pr.totalBonusValue.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-slate-500 font-mono">
                  {pr.createdAt.slice(0, 16).replace("T", " ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
