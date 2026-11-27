import React, { useMemo, useState } from "react";
import { usePosStore } from "../../../../application/store/usePosStore";
import { PurchaseOrderLineDraftInput } from "../../../../application/store/storeTypes";
import { ProductEntity, SupplierEntity } from "../../../../domain/entities";
import { ProductQuickPicker } from "../../common/ProductQuickPicker";
import { Plus, Save, Trash2, X } from "lucide-react";

interface Props {
  products: ProductEntity[];
  activeSuppliers: SupplierEntity[];
  canViewCost: boolean;
  isScannerEnabled: boolean;
  onClose: () => void;
  onCreated: (createdOrderId: string) => void;
}

/**
 * لوحة إنشاء أمر شراء مباشر بأصناف حرة (خارج دفتر النواقص)
 */
export const DirectPurchaseOrderPanel: React.FC<Props> = ({
  products,
  activeSuppliers,
  canViewCost,
  isScannerEnabled,
  onClose,
  onCreated,
}) => {
  const { createPurchaseOrdersBatch, setNotification } = usePosStore();

  const [newOrderSupplierId, setNewOrderSupplierId] = useState("");
  const [useManualSupplierName, setUseManualSupplierName] = useState(
    () => activeSuppliers.length === 0,
  );
  const [manualSupplierName, setManualSupplierName] = useState("");
  const [manualSupplierPhone, setManualSupplierPhone] = useState("");
  const [newOrderNotes, setNewOrderNotes] = useState("");
  const [newOrderItems, setNewOrderItems] = useState<
    PurchaseOrderLineDraftInput[]
  >([]);
  const [savingNewOrder, setSavingNewOrder] = useState(false);

  const handleAddProductToNewOrder = (product: ProductEntity) => {
    setNewOrderItems((prev) => {
      const idx = prev.findIndex((it) => it.product.id === product.id);
      if (idx !== -1) {
        return prev.map((it, i) =>
          i === idx ? { ...it, orderedPacks: it.orderedPacks + 1 } : it,
        );
      }
      return [{ product, orderedPacks: 1 }, ...prev];
    });
  };

  const newOrderEstimatedTotal = useMemo(
    () =>
      newOrderItems.reduce(
        (sum, it) =>
          sum + it.orderedPacks * (it.product.weightedCostPrice || 0),
        0,
      ),
    [newOrderItems],
  );

  const handleCreateDirectOrder = async () => {
    if (savingNewOrder) return;

    const selectedSup = !useManualSupplierName
      ? activeSuppliers.find((s) => s.id === newOrderSupplierId) || null
      : null;

    const resolvedSupplierName = selectedSup
      ? selectedSup.name
      : manualSupplierName.trim();

    if (!resolvedSupplierName) {
      setNotification({
        type: "warning",
        message: "يرجى اختيار المستودع أو إدخال اسمه قبل حفظ أمر الشراء.",
      });
      return;
    }

    const validItems = newOrderItems.filter((it) => it.orderedPacks > 0);
    if (validItems.length === 0) {
      setNotification({
        type: "warning",
        message: "أضف صنفاً واحداً على الأقل بكمية أكبر من الصفر.",
      });
      return;
    }

    setSavingNewOrder(true);
    try {
      const created = await createPurchaseOrdersBatch([
        {
          supplierId: selectedSup?.id,
          supplierName: resolvedSupplierName,
          supplierPhone:
            selectedSup?.phone || manualSupplierPhone.trim() || undefined,
          salesRepName: selectedSup?.salesRepName,
          notes: newOrderNotes.trim() || undefined,
          items: validItems,
        },
      ]);

      if (created.length > 0) {
        onCreated(created[0].id);
        onClose();
      }
    } finally {
      setSavingNewOrder(false);
    }
  };

  const inputCls =
    "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500";

  return (
    <div className="bg-slate-950 border border-amber-700/60 rounded-2xl p-4 space-y-4 shadow-lg">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="font-bold text-amber-300 text-xs flex items-center gap-2">
          <Plus className="w-4 h-4" />
          إنشاء أمر شراء مباشر (يمكنك طلب أي دواء حتى لو لم يصل لحد النقص)
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* اختيار المستودع والملاحظات */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-slate-400 text-[11px]">
              المستودع / المورد *
            </label>
            {activeSuppliers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setUseManualSupplierName((prev) => !prev);
                  setNewOrderSupplierId("");
                  setManualSupplierName("");
                }}
                className="text-[10.5px] text-sky-400 hover:text-sky-300 font-bold"
              >
                {useManualSupplierName
                  ? "الاختيار من الدليل"
                  : "+ إدخال اسم يدوي"}
              </button>
            )}
          </div>

          {!useManualSupplierName && activeSuppliers.length > 0 ? (
            <select
              value={newOrderSupplierId}
              onChange={(e) => setNewOrderSupplierId(e.target.value)}
              className={inputCls}
            >
              <option value="">-- اختر المستودع من الدليل --</option>
              {activeSuppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                  {sup.salesRepName ? ` (${sup.salesRepName})` : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={manualSupplierName}
              onChange={(e) => setManualSupplierName(e.target.value)}
              placeholder="اسم المستودع أو الشركة..."
              className={inputCls}
            />
          )}
        </div>

        {useManualSupplierName && (
          <div>
            <label className="block text-slate-400 text-[11px] mb-1">
              رقم واتساب المستودع (اختياري)
            </label>
            <input
              type="text"
              value={manualSupplierPhone}
              onChange={(e) => setManualSupplierPhone(e.target.value)}
              placeholder="مثال: 9639xxxxxxxx"
              className={`${inputCls} font-mono`}
            />
          </div>
        )}

        <div className={useManualSupplierName ? "" : "md:col-span-2"}>
          <label className="block text-slate-400 text-[11px] mb-1">
            ملاحظات الطلبية (عرض بونص / طلب مستعجل...)
          </label>
          <input
            type="text"
            value={newOrderNotes}
            onChange={(e) => setNewOrderNotes(e.target.value)}
            placeholder="ملاحظة اختيارية تُرفق في رسالة الطلبية..."
            className={inputCls}
          />
        </div>
      </div>

      {/* شريط البحث والباركود الموحّد لإدراج أي صنف حر */}
      <ProductQuickPicker
        products={products}
        onSelectProduct={handleAddProductToNewOrder}
        showCost={canViewCost}
        enableBarcodeScanner={isScannerEnabled}
        enableF2Shortcut={isScannerEnabled}
        accent="indigo"
        inputBgClass="bg-slate-900"
        actionLabel="إضافة للأمر"
        placeholder="امسح الباركود أو ابحث بالاسم أو المادة الفعالة لإضافة أي صنف لأمر الشراء..."
      />

      {/* قائمة الأصناف المختارة للأمر الجديد */}
      {newOrderItems.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-[11px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
                  <th className="py-2 px-3">الدواء والباركود</th>
                  <th className="py-2 px-2 text-center">الرصيد الحالي</th>
                  <th className="py-2 px-2 text-center">
                    الكمية المطلوبة (علبة)
                  </th>
                  {canViewCost && (
                    <th className="py-2 px-3 text-left">تقديري</th>
                  )}
                  <th className="py-2 px-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {newOrderItems.map((entry) => (
                  <tr key={entry.product.id}>
                    <td className="py-2 px-3">
                      <div className="font-bold text-white">
                        {entry.product.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {entry.product.scientificName} |{" "}
                        <span className="font-mono">
                          {entry.product.barcode}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-slate-300">
                      {entry.product.stockPacks} علبة
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        min={1}
                        value={entry.orderedPacks}
                        onChange={(e) => {
                          const nextQty = Math.max(
                            1,
                            Number(e.target.value) || 1,
                          );
                          setNewOrderItems((prev) =>
                            prev.map((it) =>
                              it.product.id === entry.product.id
                                ? { ...it, orderedPacks: nextQty }
                                : it,
                            ),
                          );
                        }}
                        className="w-20 bg-slate-950 border border-amber-700/70 rounded-lg px-2 py-1 text-center font-mono font-bold text-white outline-none focus:border-amber-400"
                      />
                    </td>
                    {canViewCost && (
                      <td className="py-2 px-3 text-left font-mono font-bold text-amber-300">
                        {(
                          entry.orderedPacks *
                          (entry.product.weightedCostPrice || 0)
                        ).toFixed(2)}{" "}
                        ر.س
                      </td>
                    )}
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setNewOrderItems((prev) =>
                            prev.filter(
                              (it) => it.product.id !== entry.product.id,
                            ),
                          )
                        }
                        title="حذف الصنف"
                        className="p-1 rounded-lg bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-rose-200 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* تذييل حفظ الأمر المباشر */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-slate-800">
        <div className="text-[11px] text-slate-400 font-mono">
          عدد الأصناف: <b className="text-white">{newOrderItems.length}</b>
          {canViewCost && newOrderItems.length > 0 && (
            <span className="mr-3">
              التقديري:{" "}
              <b className="text-amber-300">
                {newOrderEstimatedTotal.toFixed(2)} ر.س
              </b>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={newOrderItems.length === 0 || savingNewOrder}
            onClick={() => void handleCreateDirectOrder()}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold inline-flex items-center gap-1.5 shadow transition"
          >
            <Save className="w-4 h-4" />
            حفظ كمسودة أمر شراء
          </button>
        </div>
      </div>
    </div>
  );
};
