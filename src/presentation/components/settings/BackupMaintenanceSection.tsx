import React, { useRef } from "react";
import {
  usePosStore,
  selectPendingSyncCount,
} from "../../../application/store/usePosStore";
import {
  DatabaseBackup,
  Download,
  Upload,
  CloudUpload,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";

export const BackupMaintenanceSection: React.FC = () => {
  const {
    products,
    invoices,
    purchaseInvoices,
    ledgerPayments,
    shifts,
    exportDatabaseBackup,
    restoreDatabaseBackup,
    resetDemoDatabase,
    syncPendingBatchToCloud,
    importProductsBatch,
    currentUser,
  } = usePosStore();

  const pendingSyncCount = usePosStore(selectPendingSyncCount);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const canManageSettings =
    currentUser?.permissions.canManageSettingsAndBackup ?? true;

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

  const handleGenerateBulkTestData = async (count: number) => {
    const confirmed = window.confirm(
      `هل تريد توليد وإدخال (${count}) دواء تجريبي لاختبار سرعة النظام مع البيانات الضخمة؟`,
    );
    if (!confirmed) return;

    const sampleNames = [
      "Panadol Extra",
      "Augmentin 1g",
      "Brufen 600mg",
      "Nexium 40mg",
      "Concor 5mg",
      "Lipitor 20mg",
      "Glucophage 1000mg",
      "Zyrtec 10mg",
      "Voltaren 50mg",
      "Amoxil 500mg",
      "Cataflam 50mg",
      "Claritine 10mg",
    ];
    const sampleScientific = [
      "Paracetamol",
      "Amoxicillin + Clavulanic Acid",
      "Ibuprofen",
      "Esomeprazole",
      "Bisoprolol",
      "Atorvastatin",
      "Metformin",
      "Cetirizine",
      "Diclofenac Sodium",
      "Amoxicillin",
      "Diclofenac Potassium",
      "Loratadine",
    ];
    const sampleCategories = [
      "مسكنات",
      "مضادات حيوية",
      "أدوية المعدة",
      "القلب والضغط",
      "السكري",
      "الحساسية",
    ];
    const expirySamples = [
      "2026-12-05",
      "2027-01-25",
      "2027-04-15",
      "2028-10-30",
      "2029-06-15",
    ];

    const generated = Array.from({ length: count }, (_, idx) => {
      const i = idx + 1;
      const baseIdx = idx % sampleNames.length;
      const packPrice = Number((12 + (idx % 90)).toFixed(2));
      const costPrice = Number((packPrice * 0.72).toFixed(2));
      const stockPacks = idx % 7 === 0 ? 2 : 15 + (idx % 40);
      const expiryDate = expirySamples[idx % expirySamples.length];

      return {
        id: `stress-prod-${i}`,
        barcode: `628999${String(i).padStart(6, "0")}`,
        name: `${sampleNames[baseIdx]} #${i}`,
        scientificName: sampleScientific[baseIdx],
        category: sampleCategories[idx % sampleCategories.length],
        packPrice,
        weightedCostPrice: costPrice,
        stripsPerPack: (idx % 3) + 1,
        stockPacks,
        stockLooseStrips: 0,
        minLimit: 5,
        isControlled: false,
        branchId: "branch-main-01",
        updatedAt: new Date().toISOString(),
        batches: [
          {
            id: `stress-batch-${i}`,
            productId: `stress-prod-${i}`,
            batchNumber: `B-${2026}-${(idx % 99) + 1}`,
            expiryDate,
            qtyPacks: stockPacks,
            branchId: "branch-main-01",
          },
        ],
      };
    });

    await importProductsBatch(generated);
  };

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* القسم الأيمن (7 أعمدة): النسخ الاحتياطي والاستعادة المحلية */}
      <div className="lg:col-span-7 bg-slate-900 border border-emerald-800/60 rounded-2xl p-6 space-y-5 shadow-lg flex flex-col justify-between">
        <div className="space-y-4">
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
            الموظفين، والإعدادات) لحفظها على فلاشة خارجية أو نقلها لجهاز آخر.
          </p>

          {/* إحصائيات السجلات المحفوظة حالياً */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800/80">
              <div className="text-slate-400 text-[11px]">الأدوية المسجلة</div>
              <b className="font-mono text-white text-base mt-1 block">
                {products.length}
              </b>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800/80">
              <div className="text-slate-400 text-[11px]">
                فواتير البيع/المرتجع
              </div>
              <b className="font-mono text-emerald-400 text-base mt-1 block">
                {invoices.length}
              </b>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800/80">
              <div className="text-slate-400 text-[11px]">فواتير المشتريات</div>
              <b className="font-mono text-sky-400 text-base mt-1 block">
                {purchaseInvoices.length}
              </b>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800/80">
              <div className="text-slate-400 text-[11px]">الديون والورديات</div>
              <b className="font-mono text-amber-400 text-base mt-1 block">
                {ledgerPayments.length + shifts.length}
              </b>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            disabled={!canManageSettings}
            onClick={exportDatabaseBackup}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
          >
            <Download className="w-4 h-4" /> تصدير نسخة احتياطية (.json)
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
            disabled={!canManageSettings}
            onClick={() => backupFileInputRef.current?.click()}
            className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
          >
            <Upload className="w-4 h-4" /> استعادة من ملف نسخة احتياطية
          </button>
        </div>
      </div>

      {/* القسم الأيسر (5 أعمدة): المزامنة السحابية + الصيانة وضبط المصنع */}
      <div className="lg:col-span-5 space-y-6">
        {/* بطاقة المزامنة السحابية اليدوية */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <CloudUpload className="w-4 h-4 text-purple-400" /> طابور المزامنة
              السحابية
            </h3>
            <span className="font-mono text-xs text-purple-300 font-bold">
              بانتظار الرفع: {pendingSyncCount} حركة
            </span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            يتم تخزين جميع الحركات محلياً أولاً، ويمكنك دفع الحزمة المتراكمة إلى
            خادم PostgreSQL المركزي في أي وقت.
          </p>
          <button
            type="button"
            onClick={() => void syncPendingBatchToCloud()}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-md"
          >
            <CloudUpload className="w-4 h-4" /> مزامنة الحركات المعلقة مع
            السحابة الآن
          </button>
        </div>

        {/* منطقة الصيانة: اختبار الأداء وإعادة ضبط المصنع */}
        <div className="bg-rose-950/20 border border-rose-900/60 rounded-2xl p-6 space-y-3">
          <div className="font-bold text-rose-300 text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-rose-400" /> منطقة الصيانة
            وإعادة ضبط المصنع
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            إعادة تهيئة قاعدة البيانات للبيانات الدوائية الافتراضية (Seed Data).
            احرص دائماً على تصدير نسخة احتياطية قبل استخدام هذا الخيار.
          </p>
          <button
            type="button"
            disabled={!canManageSettings}
            onClick={() => void handleGenerateBulkTestData(5000)}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-md"
          >
            ⚡ توليد 5,000 دواء تجريبي (اختبار الأداء والـ Pagination)
          </button>
          <button
            type="button"
            disabled={!canManageSettings}
            onClick={() => void handleFactoryReset()}
            className="w-full bg-rose-950 hover:bg-rose-900 disabled:opacity-40 border border-rose-800 text-rose-200 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition"
          >
            <RotateCcw className="w-4 h-4" /> إعادة ضبط المصنع (Reset Demo
            Database)
          </button>
        </div>
      </div>
    </div>
  );
};
