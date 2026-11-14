import React, { useRef, useState } from "react";
import { usePosStore } from "../../application/store/usePosStore";
import {
  Settings,
  X,
  Building2,
  Printer,
  Cloud,
  Barcode,
  Save,
  DatabaseBackup,
  Download,
  Upload,
  RotateCcw,
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    settings,
    products,
    invoices,
    purchaseInvoices,
    ledgerPayments,
    updatePharmacySettings,
    exportDatabaseBackup,
    restoreDatabaseBackup,
    resetDemoDatabase,
  } = usePosStore();

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

  const backupFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
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
    onClose();
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
      onClose();
    }
    e.target.value = "";
  };

  const handleFactoryReset = async () => {
    const confirmed = window.confirm(
      "تحذير: هل أنت متأكد من إعادة ضبط قاعدة البيانات للبيانات الافتراضية؟ يُنصح بتصدير نسخة احتياطية أولاً.",
    );
    if (confirmed) {
      await resetDemoDatabase();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-xs">
      <form
        onSubmit={handleSave}
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
      >
        {/* رأس النافذة */}
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-400" />
            إعدادات الصيدلية، الطابعة، والنسخ الاحتياطي لقاعدة البيانات
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-900 p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* 1. قسم النسخ الاحتياطي والاستعادة المحلي (Local Backup & Restore) */}
          <div className="bg-slate-950 p-4 rounded-xl border border-emerald-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                <DatabaseBackup className="w-4 h-4" /> النسخ الاحتياطي
                والاستعادة المحلية (SQLite Snapshot)
              </div>
              <span className="text-[10px] font-mono bg-emerald-950 border border-emerald-800 text-emerald-300 px-2 py-0.5 rounded-full">
                {products.length} دواء | {invoices.length} فاتورة بيع |{" "}
                {purchaseInvoices.length} فاتورة شراء | {ledgerPayments.length}{" "}
                سند
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              احفظ نسخة احتياطية كاملة لجميع الجداول العشرة (الأدوية، الدفعات،
              الفواتير، الديون، الورديات، والإعدادات) على فلاشة خارجية أو
              استعدها بضغطة زر.
            </p>

            <div className="flex items-center gap-2.5 flex-wrap pt-1">
              <button
                type="button"
                onClick={exportDatabaseBackup}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow"
              >
                <Download className="w-4 h-4" /> تصدير نسخة احتياطية كاملة
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
                className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow"
              >
                <Upload className="w-4 h-4" /> استعادة نسخة احتياطية سابقة
              </button>

              <button
                type="button"
                onClick={() => void handleFactoryReset()}
                className="bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200 font-bold py-2.5 px-3 rounded-xl flex items-center gap-1.5"
                title="إعادة ضبط قاعدة البيانات للبيانات الافتراضية"
              >
                <RotateCcw className="w-3.5 h-3.5" /> ضبط المصنع
              </button>
            </div>
          </div>

          {/* 2. بيانات هوية الصيدلية على الفواتير ولصاقات الباركود */}
          <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="font-bold text-slate-200 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-400" /> بيانات هوية
              الصيدلية (تظهر في الإيصال الحراري ولصاقات الباركود)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">
                  اسم الصيدلية *
                </label>
                <input
                  type="text"
                  required
                  value={pharmacyName}
                  onChange={(e) => setPharmacyName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">رقم الهاتف</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">
                  العنوان التفصيلي
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">
                  الرقم الضريبي / الترخيص
                </label>
                <input
                  type="text"
                  value={taxNumber}
                  onChange={(e) => setTaxNumber(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">
                الترويسة السفلية للإيصال الحراري (Footer)
              </label>
              <input
                type="text"
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* 3. إعدادات الطابعة الحرارية وقارئ الباركود */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="font-bold text-sky-400 flex items-center gap-1.5">
                <Printer className="w-4 h-4" /> الطابعة الحرارية (80mm)
              </div>
              <label className="block text-slate-400">
                اسم الطابعة في نظام ويندوز
              </label>
              <input
                type="text"
                value={thermalPrinterName}
                onChange={(e) => setThermalPrinterName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono outline-none"
                placeholder="POS-80-Series"
              />
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="font-bold text-amber-400 flex items-center gap-1.5">
                <Barcode className="w-4 h-4" /> حساسية قارئ الباركود الليزري
              </div>
              <label className="block text-slate-400">
                الفاصل الزمني الأقصى للنبضة (مللي ثانية)
              </label>
              <input
                type="number"
                min={20}
                max={120}
                value={scannerMaxIntervalMs}
                onChange={(e) => setScannerMaxIntervalMs(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono outline-none"
              />
            </div>
          </div>

          {/* 4. إعدادات سيرفر المزامنة السحابي */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="font-bold text-purple-400 flex items-center gap-1.5">
              <Cloud className="w-4 h-4" /> عنوان سيرفر المزامنة المركزي
              (PostgreSQL Cloud Sync URL)
            </div>
            <input
              type="url"
              required
              value={cloudSyncUrl}
              onChange={(e) => setCloudSyncUrl(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono outline-none focus:border-purple-500"
              placeholder="http://localhost:4000"
            />
          </div>
        </div>

        {/* أزرار الحفظ */}
        <div className="p-4 bg-slate-800 border-t border-slate-700 flex gap-2">
          <button
            type="submit"
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg"
          >
            <Save className="w-4 h-4" /> حفظ وتطبيق الإعدادات فوراً
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl"
          >
            إغلاق
          </button>
        </div>
      </form>
    </div>
  );
};
