import React, { useEffect, useState } from "react";
import { usePosStore } from "../../../application/store/usePosStore";
import { Building2, Save } from "lucide-react";

export const PharmacyIdentitySection: React.FC = () => {
  const { settings, updatePharmacySettings, currentUser } = usePosStore();

  const [pharmacyName, setPharmacyName] = useState(settings.pharmacyName);
  const [phone, setPhone] = useState(settings.phone);
  const [address, setAddress] = useState(settings.address);
  const [taxNumber, setTaxNumber] = useState(settings.taxNumber);
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter);

  const canManageSettings =
    currentUser?.permissions.canManageSettingsAndBackup ?? true;

  useEffect(() => {
    setPharmacyName(settings.pharmacyName);
    setPhone(settings.phone);
    setAddress(settings.address);
    setTaxNumber(settings.taxNumber);
    setReceiptFooter(settings.receiptFooter);
  }, [settings]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageSettings) return;
    updatePharmacySettings({
      ...settings,
      pharmacyName,
      phone,
      address,
      taxNumber,
      receiptFooter,
    });
  };

  return (
    <form onSubmit={handleSave} className="w-full space-y-5">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-lg">
        <div className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
          <Building2 className="w-4 h-4 text-emerald-400" /> بيانات هوية
          الصيدلية (تظهر في الإيصال الحراري ولصاقات الباركود)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 mb-1.5">
              اسم الصيدلية الرسمي *
            </label>
            <input
              type="text"
              required
              disabled={!canManageSettings}
              value={pharmacyName}
              onChange={(e) => setPharmacyName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-emerald-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5">
              رقم هاتف الصيدلية
            </label>
            <input
              type="text"
              disabled={!canManageSettings}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono outline-none focus:border-emerald-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5">
              العنوان التفصيلي
            </label>
            <input
              type="text"
              disabled={!canManageSettings}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-emerald-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5">
              الرقم الضريبي / رقم الترخيص
            </label>
            <input
              type="text"
              disabled={!canManageSettings}
              value={taxNumber}
              onChange={(e) => setTaxNumber(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono outline-none focus:border-emerald-500 disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-400 mb-1.5">
            الترويسة السفلية للإيصال الحراري (Receipt Footer)
          </label>
          <input
            type="text"
            disabled={!canManageSettings}
            value={receiptFooter}
            onChange={(e) => setReceiptFooter(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-emerald-500 disabled:opacity-50"
          />
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={!canManageSettings}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold px-8 py-3 rounded-xl flex items-center gap-2 shadow-lg transition text-sm"
          >
            <Save className="w-4 h-4" /> حفظ وتطبيق إعدادات الهوية
          </button>
        </div>
      </div>
    </form>
  );
};
