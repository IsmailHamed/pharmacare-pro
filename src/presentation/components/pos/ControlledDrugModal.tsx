import React, { useState } from "react";
import { ProductEntity, ControlledDrugMeta } from "../../../domain/entities";
import { ShieldAlert } from "lucide-react";

interface Props {
  pendingItem: { product: ProductEntity; unit: "pack" | "strip" } | null;
  onClose: () => void;
  onConfirm: (
    product: ProductEntity,
    unit: "pack" | "strip",
    meta: ControlledDrugMeta,
  ) => void;
}

export const ControlledDrugModal: React.FC<Props> = ({
  pendingItem,
  onClose,
  onConfirm,
}) => {
  const [patientName, setPatientName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [prescriptionId, setPrescriptionId] = useState("");

  if (!pendingItem) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !patientName.trim() ||
      !nationalId.trim() ||
      !doctorName.trim() ||
      !prescriptionId.trim()
    ) {
      alert("جميع حقول توثيق الدواء المراقب إلزامية قانونياً!");
      return;
    }
    onConfirm(pendingItem.product, pendingItem.unit, {
      patientName: patientName.trim(),
      nationalId: nationalId.trim(),
      doctorName: doctorName.trim(),
      prescriptionId: prescriptionId.trim(),
    });
    setPatientName("");
    setNationalId("");
    setDoctorName("");
    setPrescriptionId("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 text-xs">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-rose-600 w-full max-w-md rounded-xl p-5 space-y-3 shadow-2xl"
      >
        <div className="flex items-center gap-2 text-rose-400 font-bold text-sm border-b border-slate-800 pb-2.5">
          <ShieldAlert className="w-5 h-5" />
          <span>توثيق صرف دواء مراقب: {pendingItem.product.name}</span>
        </div>

        <div>
          <label className="block text-slate-400 mb-1">
            اسم المريض الثلاثي *
          </label>
          <input
            type="text"
            required
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="الاسم الكامل كما في الهوية..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-rose-500"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-slate-400 mb-1">
            الرقم الوطني للمريض *
          </label>
          <input
            type="text"
            required
            value={nationalId}
            onChange={(e) => setNationalId(e.target.value)}
            placeholder="الرقم الوطني..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono outline-none focus:border-rose-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-slate-400 mb-1">
              اسم الطبيب المعالج *
            </label>
            <input
              type="text"
              required
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              placeholder="د. ..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">
              رقم الوصفة الطبية *
            </label>
            <input
              type="text"
              required
              value={prescriptionId}
              onChange={(e) => setPrescriptionId(e.target.value)}
              placeholder="RX-..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono outline-none focus:border-rose-500"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-lg shadow"
          >
            توثيق بالسجل وإدراج في الفاتورة
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-lg"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
};
