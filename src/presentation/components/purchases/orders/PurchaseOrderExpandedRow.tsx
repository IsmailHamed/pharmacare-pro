import React, { useEffect, useState } from "react";
import { usePosStore } from "../../../../application/store/usePosStore";
import { PurchaseOrderLineDraftInput } from "../../../../application/store/storeTypes";
import {
  ProductEntity,
  PurchaseOrderEntity,
} from "../../../../domain/entities";
import { ProductQuickPicker } from "../../common/ProductQuickPicker";
import { DISPATCH_CHANNEL_LABELS } from "./purchaseOrders.config";
import {
  Check,
  Copy,
  Edit3,
  FileText,
  Package,
  PackageCheck,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

interface Props {
  order: PurchaseOrderEntity;
  colSpan: number;
  products: ProductEntity[];
  canViewCost: boolean;
  canReceive: boolean;
  isEditing: boolean;
  isCopied: boolean;
  onCopyOrder: (order: PurchaseOrderEntity) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onReceiveOrder: (order: PurchaseOrderEntity) => void;
}

/**
 * صف التفاصيل الموسّع لأمر الشراء: يعرض البنود والتتبع، ويدعم تعديل المسودات وإضافة أصناف حرة
 */
export const PurchaseOrderExpandedRow: React.FC<Props> = ({
  order,
  colSpan,
  products,
  canViewCost,
  canReceive,
  isEditing,
  isCopied,
  onCopyOrder,
  onStartEdit,
  onCancelEdit,
  onReceiveOrder,
}) => {
  const updatePurchaseOrderItems = usePosStore(
    (s) => s.updatePurchaseOrderItems,
  );

  // حالة تعديل بنود وملاحظات أمر الشراء + الأصناف الحرة المضافة للمسودة (متاحة لـ DRAFT فقط)
  const [draftQtyMap, setDraftQtyMap] = useState<Record<string, number>>({});
  const [draftAddedItems, setDraftAddedItems] = useState<
    PurchaseOrderLineDraftInput[]
  >([]);
  const [draftNotes, setDraftNotes] = useState("");

  useEffect(() => {
    if (!isEditing) {
      setDraftQtyMap({});
      setDraftAddedItems([]);
      setDraftNotes("");
      return;
    }

    const qtyMap: Record<string, number> = {};
    order.items.forEach((it) => {
      qtyMap[it.id] = it.orderedPacks;
    });
    setDraftQtyMap(qtyMap);
    setDraftAddedItems([]);
    setDraftNotes(order.notes || "");
  }, [isEditing, order]);

  const handleAddFreeProductToEditingDraft = (product: ProductEntity) => {
    // إذا كان الصنف موجوداً في بنود المسودة الأصلية نزيد كميته مباشرة
    const existingItem = order.items.find((it) => it.productId === product.id);
    if (existingItem) {
      setDraftQtyMap((prev) => ({
        ...prev,
        [existingItem.id]:
          (prev[existingItem.id] ?? existingItem.orderedPacks) + 1,
      }));
      return;
    }

    // وإلا نضيفه إلى قائمة الأصناف المضافة أو نزيد كميته إن كان أُضيف في نفس الجلسة
    setDraftAddedItems((prev) => {
      const idx = prev.findIndex((it) => it.product.id === product.id);
      if (idx !== -1) {
        return prev.map((it, i) =>
          i === idx ? { ...it, orderedPacks: it.orderedPacks + 1 } : it,
        );
      }
      return [{ product, orderedPacks: 1 }, ...prev];
    });
  };

  const handleSaveOrderEdits = async () => {
    const updates = order.items.map((it) => ({
      itemId: it.id,
      orderedPacks:
        draftQtyMap[it.id] !== undefined ? draftQtyMap[it.id] : it.orderedPacks,
    }));
    await updatePurchaseOrderItems(
      order.id,
      updates,
      draftNotes,
      draftAddedItems,
    );
    onCancelEdit();
  };

  return (
    <tr className="bg-slate-950/90">
      <td colSpan={colSpan} className="p-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
          {/* شريط معلومات التتبع وأزرار التعديل والنسخ */}
          <div className="px-3.5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3 text-[11px]">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-bold text-slate-200 inline-flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-sky-400" />
                أصناف أمر الشراء (
                {order.items.length + (isEditing ? draftAddedItems.length : 0)})
              </span>
              {order.sentAt && (
                <span className="text-sky-300 text-[10.5px]">
                  آخر إرسال:{" "}
                  <b className="font-mono">
                    {new Date(order.sentAt).toLocaleString("ar-SA")}
                  </b>
                  {order.dispatchChannel && (
                    <span className="text-slate-400 mr-1">
                      ({DISPATCH_CHANNEL_LABELS[order.dispatchChannel]})
                    </span>
                  )}
                </span>
              )}
              {order.completedAt && (
                <span className="text-emerald-300 text-[10.5px]">
                  اكتمل الاستلام:{" "}
                  <b className="font-mono">
                    {new Date(order.completedAt).toLocaleString("ar-SA")}
                  </b>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onCopyOrder(order)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-[10.5px] inline-flex items-center gap-1 transition"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    تم النسخ
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-sky-400" />
                    نسخ نص الطلبية
                  </>
                )}
              </button>

              {order.status === "DRAFT" && !isEditing && (
                <button
                  type="button"
                  onClick={onStartEdit}
                  className="px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600 border border-amber-600/60 text-amber-300 hover:text-white font-bold text-[10.5px] inline-flex items-center gap-1 transition"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  تعديل وإضافة أصناف حرة
                </button>
              )}

              {isEditing && (
                <>
                  <button
                    type="button"
                    onClick={() => void handleSaveOrderEdits()}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10.5px] inline-flex items-center gap-1 transition"
                  >
                    <Save className="w-3.5 h-3.5" />
                    حفظ التعديلات
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10.5px] inline-flex items-center gap-1 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                    إلغاء
                  </button>
                </>
              )}
            </div>
          </div>

          {/* شريط إضافة أصناف حرة إلى المسودة أثناء التعديل */}
          {isEditing && (
            <div className="p-3 bg-slate-950/70 border-b border-slate-800 space-y-2">
              <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                إضافة صنف حر إلى هذه المسودة (بالباركود أو البحث):
              </div>
              <ProductQuickPicker
                products={products}
                onSelectProduct={handleAddFreeProductToEditingDraft}
                showCost={canViewCost}
                enableBarcodeScanner={isEditing}
                enableF2Shortcut={isEditing}
                accent="indigo"
                inputBgClass="bg-slate-900"
                actionLabel="إضافة للمسودة"
                placeholder="امسح الباركود أو ابحث عن أي دواء لإضافته لمسودة أمر الشراء..."
              />
            </div>
          )}

          {/* جدول بنود أمر الشراء */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-[11px]">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400 text-[10px]">
                  <th className="py-2 px-3">الدواء والباركود</th>
                  <th className="py-2 px-2 text-center">المطلوب</th>
                  <th className="py-2 px-2 text-center">المستلم</th>
                  <th className="py-2 px-2 text-center">المتبقي</th>
                  {canViewCost && (
                    <>
                      <th className="py-2 px-2 text-center">تكلفة تقديرية</th>
                      <th className="py-2 px-3 text-left">إجمالي السطر</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {/* الأصناف الحرة المضافة حديثاً قبل الحفظ */}
                {isEditing &&
                  draftAddedItems.map((added) => {
                    const unitCost = added.product.weightedCostPrice || 0;
                    const lineEst = added.orderedPacks * unitCost;
                    return (
                      <tr
                        key={`added-${added.product.id}`}
                        className="bg-amber-950/20"
                      >
                        <td className="py-2 px-3">
                          <div className="font-bold text-amber-200 flex items-center gap-1.5">
                            <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-amber-600/30 border border-amber-500/60 text-amber-200">
                              جديد
                            </span>
                            <span>{added.product.name}</span>
                          </div>
                          <div className="text-[9.5px] text-slate-400 flex items-center gap-2 flex-wrap">
                            <span className="font-mono">
                              {added.product.barcode}
                            </span>
                            {added.product.scientificName && (
                              <span>— {added.product.scientificName}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              value={added.orderedPacks}
                              onChange={(e) => {
                                const val = Math.max(
                                  1,
                                  Number(e.target.value) || 1,
                                );
                                setDraftAddedItems((prev) =>
                                  prev.map((it) =>
                                    it.product.id === added.product.id
                                      ? { ...it, orderedPacks: val }
                                      : it,
                                  ),
                                );
                              }}
                              className="w-16 bg-slate-950 border border-amber-600 rounded-lg px-2 py-1 text-center font-mono font-bold text-white outline-none focus:border-amber-400"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setDraftAddedItems((prev) =>
                                  prev.filter(
                                    (it) => it.product.id !== added.product.id,
                                  ),
                                )
                              }
                              title="إزالة الصنف المضاف"
                              className="p-1 rounded bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-rose-200 transition"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-slate-500">
                          0 علبة
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-bold text-amber-300">
                          {added.orderedPacks} علبة
                        </td>
                        {canViewCost && (
                          <>
                            <td className="py-2 px-2 text-center font-mono text-slate-300">
                              {unitCost.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-left font-mono font-bold text-amber-300">
                              {lineEst.toFixed(2)} ر.س
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}

                {/* بنود الأمر المحفوظة */}
                {order.items.map((item) => {
                  const currentQty = isEditing
                    ? (draftQtyMap[item.id] ?? item.orderedPacks)
                    : item.orderedPacks;
                  const remaining = Math.max(
                    0,
                    currentQty - item.receivedPacks,
                  );
                  const lineEst = currentQty * item.estimatedUnitCost;

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/35">
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-100">
                          {item.productName}
                        </div>
                        <div className="text-[9.5px] text-slate-500 flex items-center gap-2 flex-wrap">
                          <span className="font-mono">{item.barcode}</span>
                          {item.scientificName && (
                            <span>— {item.scientificName}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-2 px-2 text-center">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              value={currentQty}
                              onChange={(e) =>
                                setDraftQtyMap((prev) => ({
                                  ...prev,
                                  [item.id]: Math.max(
                                    0,
                                    Number(e.target.value) || 0,
                                  ),
                                }))
                              }
                              className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono font-bold text-white outline-none focus:border-sky-500"
                            />
                            <span className="text-[10px] text-slate-500">
                              (0 للحذف)
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono font-bold text-white">
                            {item.orderedPacks} علبة
                          </span>
                        )}
                      </td>

                      <td className="py-2 px-2 text-center font-mono font-bold text-emerald-400">
                        {item.receivedPacks} علبة
                      </td>

                      <td className="py-2 px-2 text-center font-mono font-bold">
                        <span
                          className={
                            remaining > 0 ? "text-amber-300" : "text-slate-500"
                          }
                        >
                          {remaining} علبة
                        </span>
                      </td>

                      {canViewCost && (
                        <>
                          <td className="py-2 px-2 text-center font-mono text-slate-300">
                            {item.estimatedUnitCost.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-left font-mono font-bold text-amber-300">
                            {lineEst.toFixed(2)} ر.س
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* الملاحظات وفواتير الشراء المرتبطة */}
          <div className="px-3.5 py-2.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
            <div className="flex-1 min-w-[220px] space-y-1.5">
              {isEditing ? (
                <input
                  type="text"
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  placeholder="أضف ملاحظة لأمر الشراء (اختياري)..."
                  className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-[11px] text-white outline-none focus:border-sky-500"
                />
              ) : (
                order.notes && (
                  <div className="text-[11px] text-slate-400">
                    <b className="text-slate-300">ملاحظات:</b> {order.notes}
                  </div>
                )
              )}

              {order.linkedPurchaseInvoiceIds.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-[10.5px]">
                  <span className="text-slate-400 inline-flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    فواتير الاستلام المرتبطة:
                  </span>
                  {order.linkedPurchaseInvoiceIds.map((invId) => (
                    <span
                      key={invId}
                      className="font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-800/70 text-emerald-300"
                    >
                      {invId}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {canReceive && !isEditing && (
              <button
                type="button"
                onClick={() => onReceiveOrder(order)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition"
              >
                <PackageCheck className="w-3.5 h-3.5" />
                {order.status === "PARTIAL"
                  ? "استلام الأصناف المتبقية كفاتورة شراء"
                  : "استلام وإنشاء فاتورة شراء"}
              </button>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
};
