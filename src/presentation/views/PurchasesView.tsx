import React, { useCallback, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { usePosStore } from "../../application/store/usePosStore";
import { ProductEntity } from "../../domain/entities";
import { parseLasaDisplay } from "../../domain/utils/lasaFormatter";
import {
  PackagePlus,
  CheckCircle2,
  Trash2,
  ClipboardList,
  FileText,
  Building2,
  Settings2,
  Barcode,
} from "lucide-react";
import {
  AddPurchaseWithBonusUseCase,
  PurchaseLineInput,
} from "../../application/use-cases/AddPurchaseWithBonus";
import { ProductQuickPicker } from "../components/common/ProductQuickPicker";
import { SuppliersManagerModal } from "../components/purchases/SuppliersManagerModal";
import { PurchaseShortagesTab } from "../components/purchases/PurchaseShortagesTab";
import { PurchaseReportsTab } from "../components/purchases/PurchaseReportsTab";

type PurchasesSubTab = "entry" | "shortages" | "reports";

interface DraftLine {
  uid: string;
  productId: string;
  batchNumber: string;
  expiryDate: string;
  purchasedPacks: number;
  bonusPacks: number;
  purchasePricePerPack: number;
  newPackSalePrice: number;
}

const createDraftLineForProduct = (product: ProductEntity): DraftLine => ({
  uid: uuidv4(),
  productId: product.id,
  batchNumber: "",
  expiryDate: new Date().toISOString().slice(0, 10),
  purchasedPacks: 1,
  bonusPacks: 0,
  purchasePricePerPack: Number(product.weightedCostPrice.toFixed(2)) || 0,
  newPackSalePrice: 0,
});

export const PurchasesView: React.FC = () => {
  const canManagePurchases = usePosStore(
    (s) => s.currentUser?.permissions.canManagePurchases ?? false,
  );
  const canViewCost = usePosStore(
    (s) => s.currentUser?.permissions.canViewCostAndProfit ?? false,
  );
  const { products, purchaseInvoices, suppliers, createPurchaseWithBonus } =
    usePosStore();

  const [activeSubTab, setActiveSubTab] = useState<PurchasesSubTab>("entry");
  const [showSuppliersModal, setShowSuppliersModal] = useState(false);

  const [supplier, setSupplier] = useState("");
  const [useManualSupplier, setUseManualSupplier] = useState(false);
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "CREDIT">("CASH");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [lastAddedUid, setLastAddedUid] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const batchInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.isActive),
    [suppliers],
  );

  // استخراج وترتيب الأصناف الواقعة عند أو تحت حد الطلب لتبويب دفتر النواقص والطلبيات
  const shortageProducts = useMemo(
    () =>
      products
        .filter((p) => p.stockPacks <= p.minLimit)
        .sort((a, b) => a.stockPacks - b.stockPacks),
    [products],
  );

  const productsById = useMemo(() => {
    const map = new Map<string, ProductEntity>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

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

  const handleAddProductLine = useCallback((product: ProductEntity) => {
    const newLine = createDraftLineForProduct(product);
    setLines((prev) => [newLine, ...prev]);
    setLastAddedUid(newLine.uid);

    // تركيز تلقائي على حقل التشغيلة للسطر المضاف لتسريع الإدخال بلوحة المفاتيح
    window.setTimeout(() => {
      batchInputRefs.current[newLine.uid]?.focus();
    }, 40);
  }, []);

  const updateLine = (uid: string, patch: Partial<DraftLine>) => {
    setLines((prev) =>
      prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)),
    );
  };

  const removeLine = (uid: string) => {
    setLines((prev) => prev.filter((l) => l.uid !== uid));
  };

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
      await createPurchaseWithBonus(
        supplier.trim(),
        supplierInvoiceNumber.trim(),
        paymentMode,
        validLines,
      );
      setSupplier("");
      setUseManualSupplier(false);
      setSupplierInvoiceNumber("");
      setLines([]);
      setLastAddedUid(null);
      setToast(
        "تم حفظ فاتورة المشتريات وتحديث التكلفة المرجحة والمخزون بنجاح!",
      );
      window.setTimeout(() => setToast(""), 3500);
    } catch (err) {
      alert(err instanceof Error ? err.message : "خطأ غير متوقع");
    }
  };

  const inputCls =
    "w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-indigo-500";

  if (!canManagePurchases) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 p-6">
        <div className="p-8 bg-rose-950/20 border border-rose-900/60 rounded-2xl text-rose-300 text-center max-w-md">
          <h3 className="font-bold text-sm">
            غير مصرح لك بالوصول لقسم المشتريات
          </h3>
          <p className="text-xs text-rose-400/80 mt-1">
            يرجى التبديل إلى حساب صيدلي أو مدير نظام يمتلك صلاحية إدارة
            المشتريات.
          </p>
        </div>
      </div>
    );
  }

  const isEntryScannerActive = activeSubTab === "entry" && !showSuppliersModal;

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-950 text-slate-200 text-xs">
      {toast && (
        <div className="mb-4 bg-emerald-900/80 border border-emerald-600 text-emerald-200 p-3 rounded-xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" /> {toast}
          </div>
          <button
            type="button"
            onClick={() => setActiveSubTab("reports")}
            className="text-[11px] font-bold bg-emerald-950/80 hover:bg-emerald-950 border border-emerald-700 px-3 py-1 rounded-lg transition"
          >
            عرض في تقارير الشراء
          </button>
        </div>
      )}

      {/* الترويسة العليا الموحدة + زر إدارة دليل المستودعات */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-indigo-400" /> المشتريات،
            البونص، وطلبيات المستودعات
          </h2>
          <p className="text-slate-400 mt-0.5">
            إدخال فواتير الشراء بالباركود والتكلفة المرجحة، توزيع طلبيات النواقص
            على المستودعات، وتقارير المشتريات التفصيلية.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowSuppliersModal(true)}
          className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-indigo-300 hover:text-white font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow transition"
        >
          <Building2 className="w-4 h-4 text-indigo-400" />
          <span>إدارة دليل المستودعات</span>
          <span className="font-mono text-[10px] bg-indigo-950 border border-indigo-800 text-indigo-200 px-2 py-0.5 rounded-full">
            {activeSuppliers.length}
          </span>
        </button>
      </div>

      {/* شريط التبويبات الداخلية الثلاثة */}
      <div className="mb-5 flex items-center gap-2 flex-wrap bg-slate-900 p-1.5 rounded-xl border border-slate-800 w-fit">
        <button
          type="button"
          onClick={() => setActiveSubTab("entry")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition ${
            activeSubTab === "entry"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <PackagePlus className="w-4 h-4" />
          إدخال فاتورة شراء وبونص
          {lines.length > 0 && (
            <span
              className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                activeSubTab === "entry"
                  ? "bg-indigo-950/60 text-indigo-100"
                  : "bg-indigo-950 text-indigo-300"
              }`}
            >
              {lines.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("shortages")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition ${
            activeSubTab === "shortages"
              ? "bg-sky-600 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          دفتر النواقص والطلبيات
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
              activeSubTab === "shortages"
                ? "bg-sky-950/60 text-sky-100"
                : shortageProducts.length > 0
                  ? "bg-rose-600 text-white"
                  : "bg-slate-800 text-slate-400"
            }`}
          >
            {shortageProducts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("reports")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition ${
            activeSubTab === "reports"
              ? "bg-emerald-700 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          تقارير وسجل فواتير الشراء
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
              activeSubTab === "reports"
                ? "bg-emerald-950/60 text-emerald-100"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            {purchaseInvoices.length}
          </span>
        </button>
      </div>

      {/* التبويب 1: نموذج إدخال فاتورة الشراء والبونص */}
      {activeSubTab === "entry" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="text-[11px] text-slate-400 bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2">
            معادلة التكلفة المرجحة: (تكلفة الرصيد السابق + قيمة المشتريات) ÷
            (الرصيد + المشترى + البونص المجاني).
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
                    onClick={() => setShowSuppliersModal(true)}
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
                  <option value="__MANUAL__">
                    + إدخال اسم مستودع يدوياً...
                  </option>
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

          {/* شريط الالتقاط الموحّد: قارئ الباركود الليزري + البحث الضبابي والصوتي مع LASA */}
          <div className="pt-2 border-t border-slate-800/80">
            <ProductQuickPicker
              products={products}
              onSelectProduct={handleAddProductLine}
              showCost={canViewCost}
              enableBarcodeScanner={isEntryScannerActive}
              enableF2Shortcut={isEntryScannerActive}
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
                امسح باركود الدواء أو ابحث عنه من الشريط أعلاه لإضافته إلى
                فاتورة الشراء
              </p>
              <p className="text-[11px] text-slate-500">
                يمكنك إضافة نفس الصنف أكثر من مرة بتشغيلات وتواريخ صلاحية
                مختلفة.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {linePreview.map((r, idx) => {
                const product = r.product;
                if (!product) return null;
                const lasa = parseLasaDisplay(product.name, product.category);
                const isLatest = r.line.uid === lastAddedUid;

                return (
                  <div
                    key={r.line.uid}
                    className={`bg-slate-950 border rounded-xl p-3.5 space-y-3 transition ${
                      isLatest
                        ? "border-indigo-500/80 shadow-[0_0_12px_rgba(99,102,241,0.12)]"
                        : "border-slate-800"
                    }`}
                  >
                    {/* رأس البند: هوية الدواء بشارات LASA + الرصيد والتكلفة الفعلية + زر الحذف */}
                    <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-800/80 pb-2">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="font-mono text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                          #{linePreview.length - idx}
                        </span>
                        <span className="font-bold text-white text-xs">
                          {lasa.baseName}
                        </span>
                        {lasa.strengths.map((s) => (
                          <span
                            key={s.text}
                            dir="ltr"
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[10.5px] font-black font-mono ${s.badgeClass}`}
                          >
                            {s.text}
                          </span>
                        ))}
                        {lasa.modifiers.map((mod) => (
                          <span
                            key={mod}
                            className="inline-flex items-center px-1.5 py-0.5 rounded border bg-yellow-500/15 text-yellow-200 border-yellow-400/70 text-[10px] font-extrabold"
                          >
                            {mod}
                          </span>
                        ))}
                        {lasa.dosageForm && (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[10px] ${lasa.dosageForm.badgeClass}`}
                          >
                            {lasa.dosageForm.label}
                          </span>
                        )}
                        <span className="text-[10.5px] text-slate-400">
                          — {product.scientificName}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          {product.barcode}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10.5px] text-slate-400 font-mono">
                          الرصيد الحالي:{" "}
                          <b className="text-slate-200">
                            {product.stockPacks} علبة
                          </b>
                        </span>
                        {r.calc && (
                          <span className="text-[10.5px] bg-amber-950/50 border border-amber-800/70 text-amber-300 px-2 py-0.5 rounded-lg font-mono">
                            تكلفة مرجحة جديدة:{" "}
                            <b>{r.calc.newWeightedCostPrice.toFixed(2)}</b> ر.س
                          </span>
                        )}
                        {r.calc && (
                          <span className="text-[11px] font-mono font-extrabold text-white">
                            {r.calc.lineTotalCost.toFixed(2)} ر.س
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeLine(r.line.uid)}
                          title="حذف البند من الفاتورة"
                          className="bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-rose-200 rounded-lg p-1.5 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* حقول الإدخال الرقمية والتشغيلة للبند */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 items-end">
                      <div>
                        <label className="block text-slate-400 mb-1 text-[10.5px]">
                          رقم التشغيلة (Batch) *
                        </label>
                        <input
                          ref={(el) => {
                            batchInputRefs.current[r.line.uid] = el;
                          }}
                          type="text"
                          value={r.line.batchNumber}
                          onChange={(e) =>
                            updateLine(r.line.uid, {
                              batchNumber: e.target.value,
                            })
                          }
                          className={`${inputCls} font-mono`}
                          placeholder="BATCH-01"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 text-[10.5px]">
                          تاريخ الصلاحية *
                        </label>
                        <input
                          type="date"
                          value={r.line.expiryDate}
                          onChange={(e) =>
                            updateLine(r.line.uid, {
                              expiryDate: e.target.value,
                            })
                          }
                          className={`${inputCls} font-mono`}
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 text-[10.5px]">
                          الكمية المشتراة (علبة)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={r.line.purchasedPacks}
                          onChange={(e) =>
                            updateLine(r.line.uid, {
                              purchasedPacks: Math.max(
                                0,
                                Number(e.target.value) || 0,
                              ),
                            })
                          }
                          className={`${inputCls} font-mono text-center font-bold`}
                        />
                      </div>

                      <div>
                        <label className="block text-emerald-400 font-bold mb-1 text-[10.5px]">
                          + بونص مجاني
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={r.line.bonusPacks}
                          onChange={(e) =>
                            updateLine(r.line.uid, {
                              bonusPacks: Math.max(
                                0,
                                Number(e.target.value) || 0,
                              ),
                            })
                          }
                          className="w-full bg-emerald-950 border border-emerald-800 rounded-lg p-2 text-emerald-300 font-mono font-bold text-center outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 text-[10.5px]">
                          سعر شراء العلبة
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={r.line.purchasePricePerPack}
                          onChange={(e) =>
                            updateLine(r.line.uid, {
                              purchasePricePerPack: Math.max(
                                0,
                                Number(e.target.value) || 0,
                              ),
                            })
                          }
                          className={`${inputCls} font-mono text-center font-bold`}
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 text-[10.5px]">
                          سعر بيع جديد (اختياري)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={
                            r.line.newPackSalePrice > 0
                              ? r.line.newPackSalePrice
                              : ""
                          }
                          onChange={(e) =>
                            updateLine(r.line.uid, {
                              newPackSalePrice: Math.max(
                                0,
                                Number(e.target.value) || 0,
                              ),
                            })
                          }
                          placeholder={`الحالي: ${product.packPrice.toFixed(2)}`}
                          className={`${inputCls} font-mono text-center`}
                        />
                      </div>
                    </div>
                  </div>
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
                      window.confirm(
                        "هل تريد تفريغ جميع بنود الفاتورة الحالية؟",
                      )
                    ) {
                      setLines([]);
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
                اعتماد الفاتورة وتحديث المخزون
              </button>
            </div>
          </div>
        </div>
      )}

      {/* التبويب 2: دفتر النواقص وتوزيع طلبيات المستودعات */}
      {activeSubTab === "shortages" && (
        <PurchaseShortagesTab
          shortageProducts={shortageProducts}
          canViewCost={canViewCost}
          onOpenSuppliersModal={() => setShowSuppliersModal(true)}
        />
      )}

      {/* التبويب 3: تقارير وسجل فواتير الشراء المفصّل */}
      {activeSubTab === "reports" && (
        <PurchaseReportsTab purchaseInvoices={purchaseInvoices} />
      )}

      {/* نافذة إدارة دليل المستودعات */}
      <SuppliersManagerModal
        isOpen={showSuppliersModal}
        onClose={() => setShowSuppliersModal(false)}
      />
    </div>
  );
};
