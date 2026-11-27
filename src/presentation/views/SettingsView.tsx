import React, { useState } from "react";
import {
  usePosStore,
  selectPendingSyncCount,
} from "../../application/store/usePosStore";
import { getSystemRuntimeInfo } from "../../infrastructure/tauri/system";
import { PharmacyIdentitySection } from "../components/settings/PharmacyIdentitySection";
import { HardwareCloudSection } from "../components/settings/HardwareCloudSection";
import { PrintTemplatesSection } from "../components/settings/PrintTemplatesSection";
import { StaffManagementSection } from "../components/settings/StaffManagementSection";
import { BackupMaintenanceSection } from "../components/settings/BackupMaintenanceSection";
import {
  Settings,
  Building2,
  Printer,
  SlidersHorizontal,
  Users,
  DatabaseBackup,
  HardDrive,
  ShieldAlert,
} from "lucide-react";

type SettingsSubTab = "identity" | "hardware" | "print" | "staff" | "backup";

export const SettingsView: React.FC = () => {
  const { currentUser } = usePosStore();
  const pendingSyncCount = usePosStore(selectPendingSyncCount);
  const runtimeInfo = getSystemRuntimeInfo();

  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>("identity");

  // تشديد الصلاحية بمبدأ الإغلاق الآمن (Fail-Closed): عند غياب المستخدم الحالي تكون الصلاحية false
  const canManageSettings =
    currentUser?.permissions.canManageSettingsAndBackup ?? false;

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-950 text-slate-200 text-xs">
      {/* ترويسة الصفحة ومعلومات بيئة التشغيل */}
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" /> إعدادات النظام،
            صلاحيات الفريق، والأجهزة الطرفية
          </h2>
          <p className="text-slate-400 mt-1">
            تخصيص بيانات هوية الصيدلية، ضبط الطابعة الحرارية الصامتة وقوالب
            الطباعة، وإدارة الموظفين والنسخ الاحتياطي.
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

      {/* شريط التبويبات الفرعية لأقسام الإعدادات */}
      <div className="mb-6 flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-fit flex-wrap">
        <button
          type="button"
          onClick={() => setActiveSubTab("identity")}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition ${
            activeSubTab === "identity"
              ? "bg-emerald-600 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Building2 className="w-4 h-4" />
          هوية الصيدلية
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("hardware")}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition ${
            activeSubTab === "hardware"
              ? "bg-sky-600 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Printer className="w-4 h-4" />
          الأجهزة الطرفية والسحابة
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("print")}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition ${
            activeSubTab === "print"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          قوالب الطباعة والمعاينة
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("staff")}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition ${
            activeSubTab === "staff"
              ? "bg-amber-600 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          فريق العمل والصلاحيات (RBAC)
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("backup")}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition ${
            activeSubTab === "backup"
              ? "bg-purple-600 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <DatabaseBackup className="w-4 h-4" />
          النسخ الاحتياطي والصيانة
          {pendingSyncCount > 0 && (
            <span className="bg-purple-950 text-purple-300 border border-purple-700 px-1.5 py-0.2 rounded-full font-mono text-[10px]">
              {pendingSyncCount}
            </span>
          )}
        </button>
      </div>

      {/* تنبيه القراءة فقط يظهر عند غياب صلاحية إدارة الإعدادات والنسخ الاحتياطي */}
      {!canManageSettings && activeSubTab !== "staff" && (
        <div className="mb-5 p-4 bg-rose-950/30 border border-rose-800/80 rounded-2xl flex items-center gap-3 text-rose-200 w-full">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <div className="font-bold">وضع القراءة فقط</div>
            <div className="text-[11px] text-rose-300/80">
              المستخدم الحالي ({currentUser?.name || "غير مسجل"}) لا يملك صلاحية
              تعديل إعدادات النظام أو استعادة النسخ الاحتياطية.
            </div>
          </div>
        </div>
      )}

      {/* عرض المكون النشط على كامل المساحة */}
      <div className="w-full">
        {activeSubTab === "identity" && <PharmacyIdentitySection />}
        {activeSubTab === "hardware" && <HardwareCloudSection />}
        {activeSubTab === "print" && (
          <PrintTemplatesSection
            onGoToIdentity={() => setActiveSubTab("identity")}
          />
        )}
        {activeSubTab === "staff" && <StaffManagementSection />}
        {activeSubTab === "backup" && <BackupMaintenanceSection />}
      </div>
    </div>
  );
};
