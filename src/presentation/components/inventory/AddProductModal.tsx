import React, { useState } from "react";
import { ProductEntity } from "../../../domain/entities";
import { X } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (product: Omit<ProductEntity, "id">) => Promise<void>;
}

export const AddProductModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onAddProduct,
}) => {
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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newScientific.trim()) return;

    const packs = Math.max(0, Number(newStockPacks) || 0);
    await onAddProduct({
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
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 text-xs">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-5 space-y-3 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <h3 className="font-bold text-sm text-white">
            إضافة صنف دوائي جديد للمخزون
          </h3>
          <button
            type="button"
            onClick={onClose}
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
            <label className="block text-slate-400 mb-1">سعر بيع العلبة</label>
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
              حد الطلب الأدنى (Min Limit)
            </label>
            <input
              type="number"
              min={1}
              value={newMinLimit}
              onChange={(e) => setNewMinLimit(e.target.value)}
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
          <div className="col-span-2">
            <label className="block text-slate-400 mb-1">تاريخ الصلاحية</label>
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
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
};
