import React, { useMemo, useRef, useState } from "react";
import { usePosStore } from "../../application/store/usePosStore";
import { ProductEntity } from "../../domain/entities";
import { ExcelService } from "../../infrastructure/excel/ExcelService";
import { BarcodeLabelModal } from "../components/BarcodeLabelModal";
import {
  Clock,
  Tag,
  AlertTriangle,
  FileSpreadsheet,
  Upload,
  Plus,
  X,
  Barcode,
  Flame,
  ArchiveRestore,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";

type InventoryFilterMode =
  | "ALL"
  | "LOW_STOCK"
  | "EXP_30"
  | "EXP_90"
  | "EXP_180"
  | "DEAD_STOCK";

export const InventoryView: React.FC = () => {
  const {
    products,
    invoices,
    applyBulkPricing,
    addNewProduct,
    importProductsBatch,
  } = usePosStore();

  const [percent, setPercent] = useState(5);
  const [category, setCategory] = useState("ALL");
  const [filterMode, setFilterMode] = useState<InventoryFilterMode>("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<ProductEntity | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // حقول إضافة دواء جديد
  const [newName, setNewName] = useState("");
  const [newScientific, setNewScientific] = useState("");
  const [newBarcode, setNewBarcode] = useState("");
  const [newCategory, setNewCategory] = useState("عام");
  const [newPackPrice, setNewPackPrice] = useState("25");
  const [newCostPrice, setNewCostPrice] = useState("18");
  const [newStripsPerPack, setNewStripsPerPack] = useState("2");
  const [newStockPacks, setNewStockPacks] = useState("10");
  const [newMinLimit, setNewMinLimit] = useState("5");
  const [newBatchNumber, setNewBatchNumber] = useState("BATCH-01");
  const [newExpiryDate, setNewExpiryDate] = useState("2028-06-30");
  const [newIsControlled, setNewIsControlled] = useState(false);

  const categories = useMemo(
    () => [
      "ALL",
      ...Array.from(new Set(products.map((p) => p.category || "عام"))),
    ],
    [products],
  );

  // دالة حساب الأيام المتبقية لأقرب دفعة صلاحية لكل دواء
  const getNearestExpiryDays = (product: ProductEntity): number => {
    if (!product.batches || product.batches.length === 0) return 9999;
    const nowMs = Date.now();
    const daysList = product.batches
      .filter((b) => b.qtyPacks > 0)
      .map((b) => {
        const expMs = new Date(b.expiryDate).getTime();
        return Math.ceil((expMs - nowMs) / (1000 * 60 * 60 * 24));
      });
    return daysList.length > 0 ? Math.min(...daysList) : 9999;
  };

  // تحديد الأدوية التي تم بيعها خلال آخر 60 يوماً لكشف الرواكد (Dead Stock)
  const soldProductIdsLast60Days = useMemo(() => {
    const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const set = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.type === "SALE" && new Date(inv.createdAt).getTime() >= cutoff) {
        inv.items.forEach((item) => set.add(item.product.id));
      }
    });
    return set;
  }, [invoices]);

  // إحصائيات الرادار الاستباقي للصلاحيات والرواكد
  const radarStats = useMemo(() => {
    let lowStockCount = 0;
    let exp30Count = 0;
    let exp90Count = 0;
    let exp180Count = 0;
    let deadStockCount = 0;

    products.forEach((p) => {
      if (p.stockPacks <= p.minLimit) lowStockCount++;
      const days = getNearestExpiryDays(p);
      if (days <= 30) exp30Count++;
      else if (days <= 90) exp90Count++;
      else if (days <= 180) exp180Count++;

      if (p.stockPacks > p.minLimit && !soldProductIdsLast60Days.has(p.id)) {
        deadStockCount++;
      }
    });

    return {
      lowStockCount,
      exp30Count,
      exp90Count,
      exp180Count,
      deadStockCount,
    };
  }, [products, soldProductIdsLast60Days]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const days = getNearestExpiryDays(p);
      if (filterMode === "LOW_STOCK") return p.stockPacks <= p.minLimit;
      if (filterMode === "EXP_30") return days <= 30;
      if (filterMode === "EXP_90") return days > 30 && days <= 90;
      if (filterMode === "EXP_180") return days > 90 && days <= 180;
      if (filterMode === "DEAD_STOCK")
        return p.stockPacks > p.minLimit && !soldProductIdsLast60Days.has(p.id);
      return true;
    });
  }, [products, filterMode, soldProductIdsLast60Days]);

  const handleBulkUpdate = () => {
    const scope = category === "ALL" ? "جميع الأدوية" : `فئة (${category})`;
    if (
      window.confirm(
        `هل أنت متأكد من ${percent >= 0 ? "زيادة" : "خفض"} أسعار ${scope} بنسبة ${percent}%؟`,
      )
    ) {
      void applyBulkPricing(percent, category);
    }
  };

  const handleExcelFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await ExcelService.importProductsFromExcel(file);
      await importProductsBatch(imported);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "فشل قراءة ملف الإكسل المرفوع",
      );
    } finally {
      e.target.value = "";
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newScientific.trim()) return;

    const packs = Math.max(0, Number(newStockPacks) || 0);
    await addNewProduct({
      barcode: newBarcode.trim() || `628100${Date.now().toString().slice(-7)}`,
      name: newName.trim(),
      scientificName: newScientific.trim(),
      category: newCategory.trim() || "عام",
      packPrice: Math.max(0.5, Number(newPackPrice) || 10),
      weightedCostPrice: Math.max(0.1, Number(newCostPrice) || 7),
      stripsPerPack: Math.max(1, Number(newStripsPerPack) || 1),
      stockPacks: packs,
      stockLooseStrips: 0,
      minLimit: Math.max(1, Number(newMinLimit) || 5),
      isControlled: newIsControlled,
      batches:
        packs > 0
          ? [
              {
                id: `batch-${uuidv4().slice(0, 8)}`,
                batchNumber: newBatchNumber.trim() || "BATCH-01",
                expiryDate: newExpiryDate || "2028-12-31",
                qtyPacks: packs,
              },
            ]
          : [],
    });

    setNewName("");
    setNewScientific("");
    setNewBarcode("");
    setShowAddModal(false);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-950 text-slate-200 text-xs">
      <div className="mb-5 flex justify-between items-end flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" /> المخزون، رادار
            الصلاحيات، وطباعة الباركود (FIFO)
          </h2>
          <p className="text-slate-400 mt-1">
            تنبيهات الصلاحية الاستباقية (30 / 90 / 180 يوماً)، كشف الأدوية
            الراكدة، وتوليد لصاقات الباركود.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg"
          >
            <Plus className="w-4 h-4" /> إضافة دواء جديد
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => void handleExcelFileChange(e)}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg"
          >
            <Upload className="w-4 h-4" /> استيراد من Excel
          </button>

          <button
            onClick={() => ExcelService.exportInventoryReport(products)}
            className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg"
          >
            <FileSpreadsheet className="w-4 h-4" /> تصدير الجرد (Excel)
          </button>

          <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl flex items-center gap-2 shadow-lg">
            <Tag className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-slate-300">تسعير جماعي:</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded p-1.5 text-white outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "ALL" ? "جميع الفئات" : c}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value))}
              className="w-14 bg-slate-800 border border-slate-700 rounded p-1.5 text-center text-white font-mono"
            />
            <span className="text-slate-400">%</span>
            <button
              onClick={handleBulkUpdate}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg"
            >
              تطبيق
            </button>
          </div>
        </div>
      </div>

      {/* شريط رادار الصلاحيات الاستباقي والرواكد (الخطوة 4) */}
      <div className="grid grid-cols-6 gap-2.5 mb-5">
        <button
          onClick={() => setFilterMode("ALL")}
          className={`p-3 rounded-xl border text-right transition ${
            filterMode === "ALL"
              ? "bg-slate-800 border-emerald-500 text-white"
              : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
          }`}
        >
          <div className="text-[11px]">إجمالي الأصناف</div>
          <div className="text-base font-extrabold text-white font-mono mt-0.5">
            {products.length}
          </div>
        </button>

        <button
          onClick={() => setFilterMode("EXP_30")}
          className={`p-3 rounded-xl border text-right transition ${
            filterMode === "EXP_30"
              ? "bg-rose-950/80 border-rose-500 text-rose-200"
              : "bg-slate-900 border-slate-800 text-rose-400 hover:border-rose-800"
          }`}
        >
          <div className="text-[11px] flex items-center gap-1 font-bold">
            <Flame className="w-3.5 h-3.5" /> خطر صلاحية (أقل من 30 يوماً)
          </div>
          <div className="text-base font-extrabold font-mono mt-0.5">
            {radarStats.exp30Count} صنف
          </div>
        </button>

        <button
          onClick={() => setFilterMode("EXP_90")}
          className={`p-3 rounded-xl border text-right transition ${
            filterMode === "EXP_90"
              ? "bg-orange-950/80 border-orange-500 text-orange-200"
              : "bg-slate-900 border-slate-800 text-orange-400 hover:border-orange-800"
          }`}
        >
          <div className="text-[11px] font-bold">
            صلاحية قريبة (31 - 90 يوماً)
          </div>
          <div className="text-base font-extrabold font-mono mt-0.5">
            {radarStats.exp90Count} صنف
          </div>
        </button>

        <button
          onClick={() => setFilterMode("EXP_180")}
          className={`p-3 rounded-xl border text-right transition ${
            filterMode === "EXP_180"
              ? "bg-amber-950/80 border-amber-500 text-amber-200"
              : "bg-slate-900 border-slate-800 text-amber-400 hover:border-amber-800"
          }`}
        >
          <div className="text-[11px] font-bold">
            تنبيه مبكر (91 - 180 يوماً)
          </div>
          <div className="text-base font-extrabold font-mono mt-0.5">
            {radarStats.exp180Count} صنف
          </div>
        </button>

        <button
          onClick={() => setFilterMode("LOW_STOCK")}
          className={`p-3 rounded-xl border text-right transition ${
            filterMode === "LOW_STOCK"
              ? "bg-sky-950/80 border-sky-500 text-sky-200"
              : "bg-slate-900 border-slate-800 text-sky-400 hover:border-sky-800"
          }`}
        >
          <div className="text-[11px] flex items-center gap-1 font-bold">
            <AlertTriangle className="w-3.5 h-3.5" /> نواقص تحت حد الطلب
          </div>
          <div className="text-base font-extrabold font-mono mt-0.5">
            {radarStats.lowStockCount} صنف
          </div>
        </button>

        <button
          onClick={() => setFilterMode("DEAD_STOCK")}
          className={`p-3 rounded-xl border text-right transition ${
            filterMode === "DEAD_STOCK"
              ? "bg-purple-950/80 border-purple-500 text-purple-200"
              : "bg-slate-900 border-slate-800 text-purple-400 hover:border-purple-800"
          }`}
        >
          <div className="text-[11px] flex items-center gap-1 font-bold">
            <ArchiveRestore className="w-3.5 h-3.5" /> أدوية راكدة (لم تُبع)
          </div>
          <div className="text-base font-extrabold font-mono mt-0.5">
            {radarStats.deadStockCount} صنف
          </div>
        </button>
      </div>

      {/* قائمة الأدوية المفلترة */}
      <div className="space-y-3">
        {filteredProducts.map((p) => {
          const nearestDays = getNearestExpiryDays(p);
          const isDeadStock =
            p.stockPacks > p.minLimit && !soldProductIdsLast60Days.has(p.id);

          return (
            <div
              key={p.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between hover:border-slate-700 transition"
            >
              <div>
                <div className="font-bold text-white text-sm flex items-center gap-2 flex-wrap">
                  {p.name}
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {p.barcode}
                  </span>
                  {p.stockPacks <= p.minLimit && (
                    <span className="bg-sky-950 border border-sky-800 text-sky-300 text-[10px] px-2 py-0.5 rounded-full">
                      نواقص (حد الطلب: {p.minLimit})
                    </span>
                  )}
                  {nearestDays <= 30 && (
                    <span className="bg-rose-950 border border-rose-700 text-rose-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      ⚠️ صلاحية حرجة ({nearestDays} يوم)
                    </span>
                  )}
                  {nearestDays > 30 && nearestDays <= 90 && (
                    <span className="bg-orange-950 border border-orange-700 text-orange-300 text-[10px] px-2 py-0.5 rounded-full">
                      صلاحية أقل من 90 يوماً ({nearestDays} يوم)
                    </span>
                  )}
                  {nearestDays > 90 && nearestDays <= 180 && (
                    <span className="bg-amber-950 border border-amber-700 text-amber-300 text-[10px] px-2 py-0.5 rounded-full">
                      تنبيه 180 يوماً ({nearestDays} يوم)
                    </span>
                  )}
                  {isDeadStock && (
                    <span className="bg-purple-950 border border-purple-800 text-purple-300 text-[10px] px-2 py-0.5 rounded-full">
                      راكد (يفضل تصريفه)
                    </span>
                  )}
                  {p.isControlled && (
                    <span className="bg-rose-950 border border-rose-800 text-rose-300 text-[10px] px-2 py-0.5 rounded-full">
                      مراقب 🔒
                    </span>
                  )}
                </div>
                <div className="text-slate-400 mt-1.5">
                  التكلفة المرجحة (بعد البونص):{" "}
                  <b className="font-mono text-amber-400">
                    {p.weightedCostPrice.toFixed(2)}
                  </b>
                  <span className="mx-2 text-slate-600">|</span>
                  سعر البيع:{" "}
                  <b className="font-mono text-emerald-400">
                    {p.packPrice.toFixed(2)}
                  </b>
                  <span className="mx-2 text-slate-600">|</span>
                  هامش الربح:{" "}
                  <b className="font-mono text-sky-400">
                    {(
                      ((p.packPrice - p.weightedCostPrice) /
                        Math.max(0.01, p.weightedCostPrice)) *
                      100
                    ).toFixed(0)}
                    %
                  </b>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* زر طباعة لصاقة الباركود (الخطوة 5) */}
                <button
                  onClick={() => setBarcodeProduct(p)}
                  className="bg-slate-800 hover:bg-emerald-700 text-slate-200 hover:text-white border border-slate-700 px-3 py-2 rounded-xl flex items-center gap-1.5 font-bold transition"
                  title="طباعة لصاقة باركود للعلبة أو الشريط الفرط"
                >
                  <Barcode className="w-4 h-4 text-emerald-400" />
                  لصاقة باركود
                </button>

                <div className="flex flex-col items-end gap-1.5">
                  <div className="font-bold text-white bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                    الرصيد: {p.stockPacks} علبة{" "}
                    {p.stockLooseStrips > 0
                      ? `و ${p.stockLooseStrips} شريط`
                      : ""}
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {p.batches.map((b) => (
                      <span
                        key={b.id}
                        className="text-[10px] bg-slate-950 border border-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono"
                      >
                        {b.batchNumber}: {b.expiryDate} ({b.qtyPacks}ع)
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* نافذة طباعة لصاقة الباركود */}
      <BarcodeLabelModal
        product={barcodeProduct}
        onClose={() => setBarcodeProduct(null)}
      />

      {/* نافذة إضافة صنف دوائي جديد */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={(e) => void handleCreateProduct(e)}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-5 space-y-3 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="font-bold text-sm text-white">
                إضافة صنف دوائي جديد للمخزون
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">
                  الاسم التجاري للدواء *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">
                  المادة الفعالة (الاسم العلمي) *
                </label>
                <input
                  type="text"
                  required
                  value={newScientific}
                  onChange={(e) => setNewScientific(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">الباركود</label>
                <input
                  type="text"
                  value={newBarcode}
                  onChange={(e) => setNewBarcode(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono outline-none"
                  placeholder="اتركه فارغاً للتوليد التلقائي"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">التصنيف</label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">
                  سعر بيع العلبة
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={newPackPrice}
                  onChange={(e) => setNewPackPrice(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">
                  تكلفة الشراء للعلبة
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={newCostPrice}
                  onChange={(e) => setNewCostPrice(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">
                  عدد الأشرطة بالعلبة
                </label>
                <input
                  type="number"
                  min={1}
                  value={newStripsPerPack}
                  onChange={(e) => setNewStripsPerPack(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">
                  الرصيد الافتتاحي (علبة)
                </label>
                <input
                  type="number"
                  min={0}
                  value={newStockPacks}
                  onChange={(e) => setNewStockPacks(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">
                  رقم الدفعة (Batch)
                </label>
                <input
                  type="text"
                  value={newBatchNumber}
                  onChange={(e) => setNewBatchNumber(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">
                  تاريخ الصلاحية
                </label>
                <input
                  type="date"
                  value={newExpiryDate}
                  onChange={(e) => setNewExpiryDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono outline-none"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 cursor-pointer text-rose-300 font-bold">
              <input
                type="checkbox"
                checked={newIsControlled}
                onChange={(e) => setNewIsControlled(e.target.checked)}
              />
              هذا الصنف دواء مراقب / نفسي (يتطلب توثيق وصفة طبية عند البيع)
            </label>

            <div className="flex gap-2 pt-3">
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg"
              >
                حفظ الصنف في قاعدة البيانات
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
