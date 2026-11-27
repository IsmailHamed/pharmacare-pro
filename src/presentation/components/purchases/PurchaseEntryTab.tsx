import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { v4 as uuidv4 } from "uuid";
import {
  ProductEntity,
  PurchaseOrderEntity,
  SupplierEntity,
} from "../../../domain/entities";
import {
  AddPurchaseWithBonusUseCase,
  PurchaseLineInput,
} from "../../../application/use-cases/AddPurchaseWithBonus";
import { ProductQuickPicker } from "../common/ProductQuickPicker";
import {
  PurchaseDraftLine,
  PurchaseInvoiceLineCard,
} from "./entry/PurchaseInvoiceLineCard";
import { Settings2, Barcode, ClipboardCheck, X } from "lucide-react";

interface Props {
  products: ProductEntity[];
  activeSuppliers: SupplierEntity[];
  canViewCost: boolean;
  isScannerActive: boolean;
  pendingOrder?: PurchaseOrderEntity | null;
  onClearPendingOrder?: () => void;
  onOpenSuppliersModal: () => void;
  onLinesCountChange?: (count: number) => void;
  onSubmitPurchase: (
    supplierName: string,
    supplierInvoiceNumber: string,
    paymentMode: "CASH" | "CREDIT",
    lines: PurchaseLineInput[],
    purchaseOrderId?: string,
  ) => Promise<unknown>;
}

const createDraftLineForProduct = (
  product: ProductEntity,
  overrides?: Partial<
    Pick<PurchaseDraftLine, "purchasedPacks" | "purchasePricePerPack">
  >,
): PurchaseDraftLine => ({
  uid: uuidv4(),
  productId: product.id,
  batchNumber: "",
  expiryDate: new Date().toISOString().slice(0, 10),
  purchasedPacks: overrides?.purchasedPacks ?? 1,
  bonusPacks: 0,
  purchasePricePerPack:
    overrides?.purchasePricePerPack ??
    (Number(product.weightedCostPrice.toFixed(2)) || 0),
  newPackSalePrice: 0,
});

/**
 * تبويب إدخال فاتورة الشراء والبونص وحساب التكلفة المرجحة
 * يدعم الاستلام المباشر من أمر شراء (PO) وتعبئة المستودع والكميات المتبقية تلقائياً
 */
export const PurchaseEntryTab: React.FC<Props> = ({
  products,
  activeSuppliers,
  canViewCost,
  isScannerActive,
  pendingOrder = null,
  onClearPendingOrder,
  onOpenSuppliersModal,
  onLinesCountChange,
  onSubmitPurchase,
}) => {
  const [supplier, setSupplier] = useState("");
  const [useManualSupplier, setUseManualSupplier] = useState(false);
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "CREDIT">("CASH");
  const [lines, setLines] = useState<PurchaseDraftLine[]>([]);
  const [lastAddedUid, setLastAddedUid] = useState<string | null>(null);

  const batchInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const loadedOrderIdRef = useRef<string | null>(null);

  const setBatchInputRef = useCallback(
    (uid: string, el: HTMLInputElement | null) => {
      batchInputRefs.current[uid] = el;
    },
    [],
  );

  const updateLinesState = useCallback(
    (updater: (prev: PurchaseDraftLine[]) => PurchaseDraftLine[]) => {
      setLines((prev) => {
        const next = updater(prev);
        onLinesCountChange?.(next.length);
        return next;
      });
    },
    [onLinesCountChange],
  );

  const productsById = useMemo(() => {
    const map = new Map<string, ProductEntity>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  // تعبئة النموذج تلقائياً بالكميات المتبقية عند التحويل من أمر شراء (PO)
  useEffect(() => {
    if (!pendingOrder) {
      loadedOrderIdRef.current = null;
      return;
    }

    if (loadedOrderIdRef.current === pendingOrder.id) return;
    loadedOrderIdRef.current = pendingOrder.id;

    const supplierInDirectory = activeSuppliers.some(
      (s) => s.name === pendingOrder.supplierName,
    );
    setUseManualSupplier(!supplierInDirectory);
    setSupplier(pendingOrder.supplierName);

    const prefilledLines: PurchaseDraftLine[] = [];
    for (const item of pendingOrder.items) {
      const remainingPacks = Math.max(
        0,
        item.orderedPacks - item.receivedPacks,
      );
      if (remainingPacks <= 0) continue;

      const matchedProduct = productsById.get(item.productId);
      if (!matchedProduct) continue;

      prefilledLines.push(
        createDraftLineForProduct(matchedProduct, {
          purchasedPacks: remainingPacks,
          purchasePricePerPack:
            item.estimatedUnitCost > 0
              ? Number(item.estimatedUnitCost.toFixed(2))
              : Number(matchedProduct.weightedCostPrice.toFixed(2)) || 0,
        }),
      );
    }

    updateLinesState(() => prefilledLines);
    const firstUid = prefilledLines[0]?.uid ?? null;
    setLastAddedUid(firstUid);

    if (firstUid) {
      window.setTimeout(() => {
        batchInputRefs.current[firstUid]?.focus();
      }, 60);
    }
  }, [pendingOrder, activeSuppliers, productsById, updateLinesState]);

  const linePreview = useMemo(
    () =>
      lines.map((l) => {
        const product = productsById.get(l.productId);
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
    [lines, productsById],
  );

  const totalInvoice = linePreview.reduce(
    (sum, r) => sum + (r.calc?.lineTotalCost ?? 0),
    0,
  );
  const totalBonusValue = linePreview.reduce(
    (sum, r) => sum + (r.calc?.bonusSavedValue ?? 0),
    0,
  );

  const handleAddProductLine = useCallback(
    (product: ProductEntity) => {
      const newLine = createDraftLineForProduct(product);
      updateLinesState((prev) => [newLine, ...prev]);
      setLastAddedUid(newLine.uid);

      window.setTimeout(() => {
        batchInputRefs.current[newLine.uid]?.focus();
      }, 40);
    },
    [updateLinesState],
  );

  const updateLine = useCallback(
    (uid: string, patch: Partial<PurchaseDraftLine>) => {
      updateLinesState((prev) =>
        prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)),
      );
    },
    [updateLinesState],
  );

  const removeLine = useCallback(
    (uid: string) => {
      updateLinesState((prev) => prev.filter((l) => l.uid !== uid));
    },
    [updateLinesState],
  );

  const handleSave = async () => {
    if (!supplier.trim()) {
      alert("يجب اختيار أو إدخال اسم المستودع أو المورد");
      return;
    }
    if (lines.length === 0) {
      alert(
        "أضف صنفاً واحداً على الأقل عبر قراءة الباركود أو البحث قبل الاعتماد",
      );
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
        batchInputRefs.current[r.line.uid]?.focus();
        return;
      }
      validLines.push({
        product: r.product,
        batchNumber: r.line.batchNumber.trim(),
        expiryDate: r.line.expiryDate,
        purchasedPacks: r.line.purchasedPacks,
        bonusPacks: r.line.bonusPacks,
        purchasePricePerPack: r.line.purchasePricePerPack,
        newPackSalePrice: r.line.newPackSalePrice,
      });
    }
    if (validLines.length === 0) return;

    try {
      await onSubmitPurchase(
        supplier.trim(),
        supplierInvoiceNumber.trim(),
        paymentMode,
        validLines,
        pendingOrder?.id,
      );
      setSupplier("");
      setUseManualSupplier(false);
      setSupplierInvoiceNumber("");
      updateLinesState(() => []);
      setLastAddedUid(null);
      loadedOrderIdRef.current = null;
    } catch (err) {
      alert(err instanceof Error ? err.message : "خطأ غير متوقع");
    }
  };

  const inputCls =
    "w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-indigo-500";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* شريط ربط أمر الشراء النشط عند الاستلام من تبويب أوامر الشراء */}
      {pendingOrder && (
        <div className="bg-sky-950/40 border border-sky-700/70 rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <ClipboardCheck className="w-4 h-4 text-sky-400 shrink-0" />
            <div>
              <div className="font-bold text-white text-xs">
                استلام فاتورة مرتبطة بأمر الشراء{" "}
                <span className="font-mono text-sky-300">
                  {pendingOrder.id}
                </span>{" "}
                — {pendingOrder.supplierName}
              </div>
              <div className="text-[11px] text-sky-200/80 mt-0.5">
                تمت تعبئة الأصناف بالكميات المتبقية تلقائياً؛ أدخل أرقام
                التشغيلات وتواريخ الصلاحية والبونص ثم اعتمد الفاتورة لتحديث حالة
                الأمر (استلام جزئي أو كلي).
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              loadedOrderIdRef.current = null;
              onClearPendingOrder?.();
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-bold text-[11px] inline-flex items-center gap-1 transition"
          >
            <X className="w-3.5 h-3.5" />
            فك الارتباط بالأمر
          </button>
        </div>
      )}

      <div className="text-[11px] text-slate-400 bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2">
        معادلة التكلفة المرجحة: (تكلفة الرصيد السابق + قيمة المشتريات) ÷ (الرصيد
        + المشترى + البونص المجاني).
      </div>

      {/* رأس الفاتورة */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-slate-400">المستودع / المورد *</label>
            <div className="flex items-center gap-2">
              {activeSuppliers.length > 0 && useManualSupplier && (
                <button
                  type="button"
                  onClick={() => {
                    setUseManualSupplier(false);
                    setSupplier("");
                  }}
                  className="text-[10.5px] text-sky-400 hover:text-sky-300 font-bold"
                >
                  الاختيار من الدليل
                </button>
              )}
              <button
                type="button"
                onClick={onOpenSuppliersModal}
                className="text-[10.5px] text-indigo-400 hover:text-indigo-300 font-bold inline-flex items-center gap-1"
              >
                <Settings2 className="w-3 h-3" /> إدارة المستودعات
              </button>
            </div>
          </div>

          {activeSuppliers.length > 0 && !useManualSupplier ? (
            <select
              value={supplier}
              onChange={(e) => {
                if (e.target.value === "__MANUAL__") {
                  setUseManualSupplier(true);
                  setSupplier("");
                } else {
                  setSupplier(e.target.value);
                }
              }}
              className={inputCls}
            >
              <option value="">-- اختر المستودع من الدليل --</option>
              {activeSuppliers.map((sup) => (
                <option key={sup.id} value={sup.name}>
                  {sup.name}
                  {sup.salesRepName ? ` (${sup.salesRepName})` : ""}
                </option>
              ))}
              <option value="__MANUAL__">+ إدخال اسم مستودع يدوياً...</option>
            </select>
          ) : (
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className={inputCls}
              placeholder="مستودع الأدوية الحديث..."
            />
          )}
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

      {/* شريط الالتقاط الموحّد */}
      <div className="pt-2 border-t border-slate-800/80">
        <ProductQuickPicker
          products={products}
          onSelectProduct={handleAddProductLine}
          showCost={canViewCost}
          enableBarcodeScanner={isScannerActive}
          enableF2Shortcut={isScannerActive}
          accent="indigo"
          inputBgClass="bg-slate-950"
          actionLabel="إدراج بالفاتورة"
          placeholder="امسح الباركود أو ابحث بالاسم والعيار معاً (مثلاً: pan 500 أو اموكس 1g) أو المادة الفعالة لإضافة بند... (F2)"
        />
      </div>

      {/* قائمة بنود الفاتورة */}
      {linePreview.length === 0 ? (
        <div className="py-12 bg-slate-950/60 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-500 text-center gap-2">
          <Barcode className="w-9 h-9 text-slate-700 stroke-1" />
          <p className="font-bold text-slate-400">
            امسح باركود الدواء أو ابحث عنه من الشريط أعلاه لإضافته إلى فاتورة
            الشراء
          </p>
          <p className="text-[11px] text-slate-500">
            يمكنك إضافة نفس الصنف أكثر من مرة بتشغيلات وتواريخ صلاحية مختلفة.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {linePreview.map((r, idx) => {
            const product = r.product;
            if (!product) return null;
            return (
              <PurchaseInvoiceLineCard
                key={r.line.uid}
                line={r.line}
                product={product}
                calc={r.calc}
                displayIndex={linePreview.length - idx}
                isLatest={r.line.uid === lastAddedUid}
                inputCls={inputCls}
                setBatchInputRef={setBatchInputRef}
                onUpdateLine={updateLine}
                onRemoveLine={removeLine}
              />
            );
          })}
        </div>
      )}

      {/* تذييل الاعتماد وإجماليات الفاتورة */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-slate-800">
        <div className="text-slate-400 font-mono text-[11px]">
          عدد البنود: <b className="text-white">{lines.length}</b>
          {lines.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm("هل تريد تفريغ جميع بنود الفاتورة الحالية؟")
                ) {
                  updateLinesState(() => []);
                  setLastAddedUid(null);
                }
              }}
              className="mr-3 text-rose-400 hover:text-rose-300 font-sans font-bold underline"
            >
              تفريغ البنود
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
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
            type="button"
            disabled={lines.length === 0}
            onClick={() => void handleSave()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold px-6 py-3 rounded-xl shadow-lg transition"
          >
            {pendingOrder
              ? `اعتماد الفاتورة وتحديث الأمر (${pendingOrder.id})`
              : "اعتماد الفاتورة وتحديث المخزون"}
          </button>
        </div>
      </div>
    </div>
  );
};
