import React, { useMemo, useRef, useState } from "react";
import { ProductEntity } from "../../../domain/entities";
import { ExcelService } from "../../../infrastructure/excel/ExcelService";
import { Clock, Tag, FileSpreadsheet, Upload, Plus } from "lucide-react";

type ImportedExcelProducts = Awaited<
  ReturnType<typeof ExcelService.importProductsFromExcel>
>;

interface Props {
  products: ProductEntity[];
  canBulkPricing: boolean;
  onOpenAddModal: () => void;
  onImportProductsBatch: (
    imported: ImportedExcelProducts,
  ) => Promise<void> | void;
  onApplyBulkPricing: (
    percent: number,
    category: string,
  ) => Promise<void> | void;
}

/**
 * الترويسة العليا لشاشة المخزون: إضافة دواء، استيراد/تصدير Excel، والتسعير الجماعي
 */
export const InventoryHeaderActions: React.FC<Props> = ({
  products,
  canBulkPricing,
  onOpenAddModal,
  onImportProductsBatch,
  onApplyBulkPricing,
}) => {
  const [percent, setPercent] = useState(5);
  const [category, setCategory] = useState("ALL");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(
    () => [
      "ALL",
      ...Array.from(new Set(products.map((p) => p.category || "عام"))),
    ],
    [products],
  );

  const handleBulkUpdate = () => {
    const scope = category === "ALL" ? "جميع الأدوية" : `فئة (${category})`;
    if (
      window.confirm(
        `هل أنت متأكد من ${percent >= 0 ? "زيادة" : "خفض"} أسعار ${scope} بنسبة ${percent}%؟`,
      )
    ) {
      void onApplyBulkPricing(percent, category);
    }
  };

  const handleExcelFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await ExcelService.importProductsFromExcel(file);
      await onImportProductsBatch(imported);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "فشل قراءة ملف الإكسل المرفوع",
      );
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="mb-5 flex justify-between items-end flex-wrap gap-3">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" /> المخزون، رادار الصلاحيات،
          وتسوية الجرد (FIFO)
        </h2>
        <p className="text-slate-400 mt-1">
          تنبيهات الصلاحية الاستباقية (30 / 90 / 180 يوماً)، تسوية الجرد
          والتوالف، وتوليد لصاقات الباركود.
        </p>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <button
          type="button"
          onClick={onOpenAddModal}
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
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg"
        >
          <Upload className="w-4 h-4" /> استيراد من Excel
        </button>

        <button
          type="button"
          onClick={() => ExcelService.exportInventoryReport(products)}
          className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg"
        >
          <FileSpreadsheet className="w-4 h-4" /> تصدير الجرد (Excel)
        </button>

        {canBulkPricing && (
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
              type="button"
              onClick={handleBulkUpdate}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg"
            >
              تطبيق
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
