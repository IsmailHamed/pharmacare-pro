import React, { useEffect, useRef, useState } from "react";
import {
  usePosStore,
  selectPendingSyncCount,
} from "../../application/store/usePosStore";
import { getSystemRuntimeInfo } from "../../infrastructure/tauri/system";
import { getSystemPrinters } from "../../infrastructure/tauri/printer";
import {
  Settings,
  Building2,
  Printer,
  Cloud,
  Barcode,
  Save,
  DatabaseBackup,
  Download,
  Upload,
  RotateCcw,
  HardDrive,
  ShieldCheck,
  CloudUpload,
  RefreshCw,
} from "lucide-react";

export const SettingsView: React.FC = () => {
  const {
    settings,
    products,
    invoices,
    purchaseInvoices,
    ledgerPayments,
    shifts,
    updatePharmacySettings,
    exportDatabaseBackup,
    restoreDatabaseBackup,
    resetDemoDatabase,
    syncPendingBatchToCloud,
  } = usePosStore();

  const pendingSyncCount = usePosStore(selectPendingSyncCount);
  const runtimeInfo = getSystemRuntimeInfo();

  const [pharmacyName, setPharmacyName] = useState(settings.pharmacyName);
  const [phone, setPhone] = useState(settings.phone);
  const [address, setAddress] = useState(settings.address);
  const [taxNumber, setTaxNumber] = useState(settings.taxNumber);
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter);
  const [thermalPrinterName, setThermalPrinterName] = useState(
    settings.thermalPrinterName,
  );
  const [cloudSyncUrl, setCloudSyncUrl] = useState(settings.cloudSyncUrl);
  const [scannerMaxIntervalMs, setScannerMaxIntervalMs] = useState(
    String(settings.scannerMaxIntervalMs),
  );
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);

  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const loadPrinters = async () => {
    setIsLoadingPrinters(true);
    try {
      const list = await getSystemPrinters();
      setAvailablePrinters(list);
    } finally {
      setIsLoadingPrinters(false);
    }
  };

  useEffect(() => {
    void loadPrinters();
  }, []);

  // تحديث الحقول تلقائياً إذا تم استيراد نسخة احتياطية تحتوي على إعدادات مختلفة
  useEffect(() => {
    setPharmacyName(settings.pharmacyName);
    setPhone(settings.phone);
    setAddress(settings.address);
    setTaxNumber(settings.taxNumber);
    setReceiptFooter(settings.receiptFooter);
    setThermalPrinterName(settings.thermalPrinterName);
    setCloudSyncUrl(settings.cloudSyncUrl);
    setScannerMaxIntervalMs(String(settings.scannerMaxIntervalMs));
  }, [settings]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updatePharmacySettings({
      pharmacyName,
      phone,
      address,
      taxNumber,
      receiptFooter,
      thermalPrinterName,
      cloudSyncUrl,
      scannerMaxIntervalMs: Number(scannerMaxIntervalMs) || 45,
    });
  };

  const handleBackupFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(
      `هل أنت متأكد من استعادة النسخة الاحتياطية من الملف (${file.name})؟ سيتم استبدال البيانات الحالية بالبيانات الموجودة في النسخة الاحتياطية.`,
    );

    if (confirmed) {
      await restoreDatabaseBackup(file);
    }
    e.target.value = "";
  };

  const handleFactoryReset = async () => {
    const confirmed = window.confirm(
      "تحذير: هل أنت متأكد من إعادة ضبط قاعدة البيانات للبيانات الافتراضية؟ يُنصح بتصدير نسخة احتياطية أولاً.",
    );
    if (confirmed) {
      await resetDemoDatabase();
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-950 text-slate-200 text-xs">
      {/* ترويسة الصفحة */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" /> إعدادات النظام،
            الأجهزة الطرفية، والنسخ الاحتياطي
          </h2>
          <p className="text-slate-400 mt-1">
            تخصيص بيانات هوية الصيدلية والفواتير، ضبط الطابعة الحرارية الصامتة
            وقارئ الباركود، وإدارة النسخ الاحتياطي لقاعدة البيانات المحلية.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl">
          <HardDrive className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-400">بيئة التشغيل:</span>
          <b className="font-mono text-emerald-300">{runtimeInfo.runtime}</b>
          <span className="text-slate-600">|</span>
          <span className="font-mono text-sky-400">
            SQLite ({runtimeInfo.sqliteJournalMode})
          </span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* العمود الأيمن (7 أعمدة): نموذج إعدادات الصيدلية والطابعة والسيرفر */}
        <form
          onSubmit={handleSaveSettings}
          className="col-span-12 lg:col-span-7 space-y-6"
        >
          {/* 1. بطاقة هوية الصيدلية */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <Building2 className="w-4 h-4 text-emerald-400" /> بيانات هوية
              الصيدلية (تظهر في الإيصال الحراري ولصاقات الباركود)
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1.5">
                  اسم الصيدلية الرسمي *
                </label>
                <input
                  type="text"
                  required
                  value={pharmacyName}
                  onChange={(e) => setPharmacyName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5">
                  رقم هاتف الصيدلية
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5">
                  العنوان التفصيلي
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5">
                  الرقم الضريبي / رقم الترخيص
                </label>
                <input
                  type="text"
                  value={taxNumber}
                  onChange={(e) => setTaxNumber(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1.5">
                الترويسة السفلية للإيصال الحراري (Receipt Footer)
              </label>
              <input
                type="text"
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* 2. بطاقة الأجهزة الطرفية (الطابعة الحرارية الصامتة وقارئ الباركود) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <Printer className="w-4 h-4 text-sky-400" /> إعدادات الأجهزة
              الطرفية (طابعة الكاشير الصامتة وقارئ الباركود الليزري)
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sky-400 flex items-center gap-1.5">
                    <Printer className="w-4 h-4" /> الطابعة الحرارية (80mm)
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadPrinters()}
                    className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-800 transition"
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
                  value={thermalPrinterName}
                  onChange={(e) => setThermalPrinterName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono outline-none focus:border-sky-500"
                  placeholder="POS-80-Series"
                />

                {availablePrinters.length > 0 && (
                  <div className="pt-1">
                    <label className="block text-[10px] text-slate-400 mb-1">
                      أو اختر مباشرة من طابعات الويندوز المتصلة (
                      {availablePrinters.length}):
                    </label>
                    <select
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
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono text-[11px] outline-none focus:border-sky-500"
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
                  value={scannerMaxIntervalMs}
                  onChange={(e) => setScannerMaxIntervalMs(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
                  القيمة الافتراضية الموصى بها لأغلب قارئات الليزر USB
                  واللاسلكية هي <b className="font-mono text-slate-300">45ms</b>
                  .
                </p>
              </div>
            </div>
          </div>

          {/* 3. بطاقة سيرفر المزامنة السحابي */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg">
            <div className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <Cloud className="w-4 h-4 text-purple-400" /> الربط مع السيرفر
              المركزي السحابي (PostgreSQL Sync Server)
            </div>
            <div>
              <label className="block text-slate-400 mb-1.5">
                عنوان خادم المزامنة (Cloud Sync Endpoint URL)
              </label>
              <input
                type="url"
                required
                value={cloudSyncUrl}
                onChange={(e) => setCloudSyncUrl(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono outline-none focus:border-purple-500"
                placeholder="http://localhost:4000"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition text-sm"
          >
            <Save className="w-4 h-4" /> حفظ وتطبيق كافة الإعدادات
          </button>
        </form>

        {/* العمود الأيسر (5 أعمدة): النسخ الاحتياطي والاستعادة وحالة قاعدة البيانات */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          {/* 1. بطاقة النسخ الاحتياطي والاستعادة المحلية */}
          <div className="bg-slate-900 border border-emerald-800/60 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <DatabaseBackup className="w-5 h-5 text-emerald-400" /> النسخ
                الاحتياطي والاستعادة (Local Backup)
              </h3>
              <span className="bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                SQLite Snapshot
              </span>
            </div>

            <p className="text-slate-400 leading-relaxed">
              قم بتصدير نسخة احتياطية كاملة بصيغة{" "}
              <b className="font-mono text-white">.json</b> تشمل كافة الجداول
              المحلية (الأدوية، الدفعات، الفواتير، المشتريات، الديون، الورديات،
              والإعدادات) لحفظها على فلاشة خارجية أو نقلها لجهاز آخر.
            </p>

            {/* إحصائيات السجلات المحفوظة حالياً */}
            <div className="grid grid-cols-2 gap-2.5 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">الأدوية المسجلة:</span>
                <b className="font-mono text-white">{products.length}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">فواتير البيع/المرتجع:</span>
                <b className="font-mono text-emerald-400">{invoices.length}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">فواتير المشتريات:</span>
                <b className="font-mono text-sky-400">
                  {purchaseInvoices.length}
                </b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">سندات الديون والورديات:</span>
                <b className="font-mono text-amber-400">
                  {ledgerPayments.length + shifts.length}
                </b>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={exportDatabaseBackup}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
              >
                <Download className="w-4 h-4" /> تصدير نسخة احتياطية كاملة الآن
                (.json)
              </button>

              <input
                ref={backupFileInputRef}
                type="file"
                accept=".json"
                onChange={(e) => void handleBackupFileChange(e)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => backupFileInputRef.current?.click()}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
              >
                <Upload className="w-4 h-4" /> استعادة قاعدة البيانات من ملف
                نسخة احتياطية
              </button>
            </div>
          </div>

          {/* 2. بطاقة المزامنة السحابية اليدوية */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <CloudUpload className="w-4 h-4 text-purple-400" /> طابور
                المزامنة السحابية (Offline Sync Queue)
              </h3>
              <span className="font-mono text-xs text-purple-300 font-bold">
                بانتظار الرفع: {pendingSyncCount} حركة
              </span>
            </div>
            <p className="text-slate-400">
              يتم تخزين جميع الحركات محلياً أولاً، ويمكنك دفع الحزمة المتراكمة
              إلى خادم PostgreSQL المركزي في أي وقت.
            </p>
            <button
              type="button"
              onClick={() => void syncPendingBatchToCloud()}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition"
            >
              <CloudUpload className="w-4 h-4" /> مزامنة الحركات المعلقة مع
              السحابة الآن
            </button>
          </div>

          {/* 3. منطقة الصيانة: إعادة ضبط المصنع */}
          <div className="bg-rose-950/20 border border-rose-900/60 rounded-2xl p-5 space-y-3">
            <div className="font-bold text-rose-300 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-400" /> منطقة الصيانة
              وإعادة ضبط المصنع
            </div>
            <p className="text-slate-400 text-[11px]">
              إعادة تهيئة قاعدة البيانات للبيانات الدوائية الافتراضية (Seed
              Data). احرص دائماً على تصدير نسخة احتياطية قبل استخدام هذا الخيار.
            </p>
            <button
              type="button"
              onClick={() => void handleFactoryReset()}
              className="w-full bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-200 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition"
            >
              <RotateCcw className="w-4 h-4" /> إعادة ضبط المصنع (Reset Demo
              Database)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
