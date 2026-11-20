import React, { useEffect, useMemo, useRef, useState } from "react";
import { ProductEntity } from "../../../domain/entities";
import { ExcelService } from "../../../infrastructure/excel/ExcelService";
import {
  Clock,
  Tag,
  FileSpreadsheet,
  Upload,
  Plus,
  Wrench,
  ChevronDown,
  X,
} from "lucide-react";

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
 * الترويسة العليا المدمجة لشاشة المخزون:
 * زر رئيسي واحد (إضافة دواء جديد) + قائمة أدوات منسدلة (Excel والتسعير الجماعي داخل Modal)
 */
export const InventoryHeaderActions: React.FC<Props> = ({
  products,
  canBulkPricing,
  onOpenAddModal,
  onImportProductsBatch,
  onApplyBulkPricing,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [percent, setPercent] = useState(5);
  const [category, setCategory] = useState("ALL");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(
    () => [
      "ALL",
      ...Array.from(new Set(products.map((p) => p.category || "عام"))),
    ],
    [products],
  );

  const affectedProductsCount = useMemo(() => {
    if (category === "ALL") return products.length;
    return products.filter((p) => (p.category || "عام") === category).length;
  }, [products, category]);

  // إغلاق القائمة المنسدلة أو نافذة التسعير الجماعي عند النقر بالخارج أو الضغط على Escape
  useEffect(() => {
    if (!menuOpen && !bulkModalOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuOpen &&
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setBulkModalOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen, bulkModalOpen]);

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(percent) || percent === 0) return;
    const scope = category === "ALL" ? "جميع الأدوية" : `فئة (${category})`;
    if (
      window.confirm(
        `هل أنت متأكد من ${percent > 0 ? "زيادة" : "خفض"} أسعار ${scope} (${affectedProductsCount} صنف) بنسبة ${percent}%؟`,
      )
    ) {
      await onApplyBulkPricing(percent, category);
      setBulkModalOpen(false);
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
    <>
      <div className="mb-4 flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" /> المخزون، رادار
            الصلاحيات، وتسوية الجرد (FIFO)
          </h2>
          <p className="text-slate-400 mt-0.5">
            مراقبة الأرصدة والتشغيلات، دفتر النواقص، وتسوية التوالف من واجهة
            موحدة.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* إدخال مخفي لاستيراد ملفات الإكسل */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => void handleExcelFileChange(e)}
            className="hidden"
          />

          {/* الإجراء الرئيسي الوحيد */}
          <button
            type="button"
            onClick={onOpenAddModal}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md transition"
          >
            <Plus className="w-4 h-4" /> إضافة دواء جديد
          </button>

          {/* قائمة أدوات المخزون المنسدلة */}
          <div ref={menuContainerRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition"
            >
              <Wrench className="w-4 h-4 text-amber-400" />
              <span>أدوات المخزون</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  menuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {menuOpen && (
              <div className="absolute left-0 mt-2 w-60 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-30 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full text-right px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200 flex items-center gap-2.5 transition"
                >
                  <Upload className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div>
                    <div className="font-bold">استيراد أدوية من Excel</div>
                    <div className="text-[10px] text-slate-400">
                      ملفات .xlsx / .xls / .csv
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    ExcelService.exportInventoryReport(products);
                  }}
                  className="w-full text-right px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200 flex items-center gap-2.5 transition"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-bold">تصدير الجرد الكامل (Excel)</div>
                    <div className="text-[10px] text-slate-400">
                      كافة الأصناف ({products.length} صنف)
                    </div>
                  </div>
                </button>

                {canBulkPricing && (
                  <>
                    <div className="border-t border-slate-800 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setBulkModalOpen(true);
                      }}
                      className="w-full text-right px-3 py-2 rounded-lg hover:bg-amber-950/50 text-amber-200 flex items-center gap-2.5 transition"
                    >
                      <Tag className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="font-bold">التسعير الجماعي (%)</div>
                        <div className="text-[10px] text-amber-300/70">
                          رفع أو خفض الأسعار حسب التصنيف
                        </div>
                      </div>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* نافذة التسعير الجماعي المنبثقة (محمية بصلاحية canBulkPricing) */}
      {canBulkPricing && bulkModalOpen && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBulkModalOpen(false);
          }}
        >
          <form
            onSubmit={(e) => void handleBulkSubmit(e)}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-400" /> تعديل الأسعار الجماعي
                (%)
              </h3>
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">
                  نطاق التطبيق (التصنيف)
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 focus:border-amber-500 rounded-xl p-2.5 text-white outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c === "ALL" ? "جميع فئات الأدوية" : c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">
                  نسبة التعديل (%) — موجب للزيادة أو سالب للخصم
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    required
                    value={percent}
                    onChange={(e) => setPercent(Number(e.target.value))}
                    className="flex-1 bg-slate-800 border border-slate-700 focus:border-amber-500 rounded-xl p-2.5 text-center text-white font-mono font-bold text-sm outline-none"
                  />
                  <span className="text-slate-400 font-mono font-bold text-sm">
                    %
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
                <span>عدد الأصناف المتأثرة:</span>
                <b className="font-mono text-amber-400">
                  {affectedProductsCount} صنف
                </b>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={!Number.isFinite(percent) || percent === 0}
                className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition"
              >
                تطبيق التعديل ({percent > 0 ? `+${percent}%` : `${percent}%`})
              </button>
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
