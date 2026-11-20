import React, { useEffect, useState } from "react";
import { usePosStore } from "../../../application/store/usePosStore";
import { getSystemPrinters } from "../../../infrastructure/tauri/printer";
import { Printer, Barcode, Cloud, RefreshCw, Save } from "lucide-react";

export const HardwareCloudSection: React.FC = () => {
  const { settings, updatePharmacySettings, currentUser } = usePosStore();

  // حالات محلية لإعدادات الطابعة الحرارية وسيرفر المزامنة وحساسية قارئ الباركود
  const [thermalPrinterName, setThermalPrinterName] = useState(
    settings.thermalPrinterName,
  );
  const [cloudSyncUrl, setCloudSyncUrl] = useState(settings.cloudSyncUrl);
  const [scannerMaxIntervalMs, setScannerMaxIntervalMs] = useState(
    String(settings.scannerMaxIntervalMs),
  );
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);

  // تشديد الصلاحية بمبدأ الإغلاق الآمن (Fail-Closed): عند غياب المستخدم الحالي تكون الصلاحية false
  const canManageSettings =
    currentUser?.permissions.canManageSettingsAndBackup ?? false;

  // جلب قائمة طابعات الويندوز المتصلة عبر جسر Tauri (أو القائمة المحاكاة في وضع المتصفح)
  const loadPrinters = async () => {
    setIsLoadingPrinters(true);
    try {
      const list = await getSystemPrinters();
      setAvailablePrinters(list);
    } finally {
      setIsLoadingPrinters(false);
    }
  };

  // تحميل الطابعات المتاحة تلقائياً عند فتح قسم الأجهزة الطرفية
  useEffect(() => {
    void loadPrinters();
  }, []);

  // إعادة مزامنة الحقول عند تغيّر الإعدادات من SQLite أو بعد استعادة نسخة احتياطية
  useEffect(() => {
    setThermalPrinterName(settings.thermalPrinterName);
    setCloudSyncUrl(settings.cloudSyncUrl);
    setScannerMaxIntervalMs(String(settings.scannerMaxIntervalMs));
  }, [settings]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // طبقة حماية إضافية لمنع حفظ التعديلات عند غياب صلاحية إدارة الإعدادات
    if (!canManageSettings) return;

    updatePharmacySettings({
      ...settings,
      thermalPrinterName,
      cloudSyncUrl,
      scannerMaxIntervalMs: Number(scannerMaxIntervalMs) || 45,
    });
  };

  return (
    <form onSubmit={handleSave} className="w-full space-y-6">
      {/* بطاقة الأجهزة الطرفية */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg">
        <div className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
          <Printer className="w-4 h-4 text-sky-400" /> إعدادات الأجهزة الطرفية
          (طابعة الكاشير الصامتة وقارئ الباركود الليزري)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* قسم ضبط الطابعة الحرارية واكتشاف طابعات الويندوز */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-sky-400 flex items-center gap-1.5">
                <Printer className="w-4 h-4" /> الطابعة الحرارية (80mm)
              </div>
              <button
                type="button"
                disabled={!canManageSettings || isLoadingPrinters}
                onClick={() => void loadPrinters()}
                className="text-[10px] text-slate-400 hover:text-white disabled:opacity-40 flex items-center gap-1 bg-slate-900 px-2.5 py-1 rounded border border-slate-800 transition"
                title="تحديث قائمة طابعات الويندوز المتصلة"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isLoadingPrinters ? "animate-spin text-sky-400" : ""}`}
                />
                تحديث الطابعات
              </button>
            </div>

            <label className="block text-slate-400 text-[11px]">
              اسم الطابعة المعرّف في نظام ويندوز
            </label>
            <input
              type="text"
              disabled={!canManageSettings}
              value={thermalPrinterName}
              onChange={(e) => setThermalPrinterName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:border-sky-500 disabled:opacity-50"
              placeholder="POS-80-Series"
            />

            {availablePrinters.length > 0 && (
              <div className="pt-1">
                <label className="block text-[10px] text-slate-400 mb-1">
                  أو اختر مباشرة من طابعات الويندوز المتصلة (
                  {availablePrinters.length}):
                </label>
                <select
                  disabled={!canManageSettings}
                  value={
                    availablePrinters.includes(thermalPrinterName)
                      ? thermalPrinterName
                      : ""
                  }
                  onChange={(e) => {
                    if (e.target.value) {
                      setThermalPrinterName(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono text-[11px] outline-none focus:border-sky-500 disabled:opacity-50"
                >
                  <option value="">-- اختر طابعة من النظام --</option>
                  {availablePrinters.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* قسم ضبط حساسية قارئ الباركود الليزري */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
            <div className="font-bold text-amber-400 flex items-center gap-1.5">
              <Barcode className="w-4 h-4" /> حساسية قارئ الباركود الليزري
            </div>
            <label className="block text-slate-400 text-[11px]">
              الفاصل الزمني الأقصى للنبضة (20 - 120 مللي ثانية)
            </label>
            <input
              type="number"
              min={20}
              max={120}
              disabled={!canManageSettings}
              value={scannerMaxIntervalMs}
              onChange={(e) => setScannerMaxIntervalMs(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white font-mono outline-none focus:border-amber-500 disabled:opacity-50"
            />
            <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
              القيمة الافتراضية الموصى بها لأغلب قارئات الليزر USB واللاسلكية هي{" "}
              <b className="font-mono text-slate-300">45ms</b>.
            </p>
          </div>
        </div>
      </div>

      {/* بطاقة سيرفر المزامنة السحابي */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg">
        <div className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
          <Cloud className="w-4 h-4 text-purple-400" /> الربط مع السيرفر المركزي
          السحابي (PostgreSQL Sync Server)
        </div>
        <div>
          <label className="block text-slate-400 mb-1.5">
            عنوان خادم المزامنة (Cloud Sync Endpoint URL)
          </label>
          <input
            type="url"
            required
            disabled={!canManageSettings}
            value={cloudSyncUrl}
            onChange={(e) => setCloudSyncUrl(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono outline-none focus:border-purple-500 disabled:opacity-50"
            placeholder="http://localhost:4000"
          />
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={!canManageSettings}
            className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold px-8 py-3 rounded-xl flex items-center gap-2 shadow-lg transition text-sm"
          >
            <Save className="w-4 h-4" /> حفظ إعدادات الأجهزة والسحابة
          </button>
        </div>
      </div>
    </form>
  );
};
