import React, { useEffect, useState } from "react";
import { POSView } from "./presentation/views/POSView";
import { PurchasesView } from "./presentation/views/PurchasesView";
import { InventoryView } from "./presentation/views/InventoryView";
import { FinanceView } from "./presentation/views/FinanceView";
import { ControlledRegistryView } from "./presentation/views/ControlledRegistryView";
import { SettingsView } from "./presentation/views/SettingsView";
import { UserSwitchModal } from "./presentation/components/auth/UserSwitchModal";
import {
  ShoppingCart,
  PackagePlus,
  Clock,
  Wallet,
  Activity,
  ShieldAlert,
  RefreshCw,
  Settings,
  User,
  X,
} from "lucide-react";
import {
  usePosStore,
  selectPendingSyncCount,
} from "./application/store/usePosStore";

type TabType =
  | "pos"
  | "purchases"
  | "inventory"
  | "finance"
  | "controlled"
  | "settings";

const TABS: {
  id: TabType;
  label: string;
  activeCls: string;
  icon: React.ElementType;
}[] = [
  {
    id: "pos",
    label: "نقطة البيع (POS)",
    activeCls: "bg-blue-600",
    icon: ShoppingCart,
  },
  {
    id: "purchases",
    label: "المشتريات والبونص",
    activeCls: "bg-indigo-600",
    icon: PackagePlus,
  },
  {
    id: "inventory",
    label: "المخزون والصلاحيات",
    activeCls: "bg-amber-600",
    icon: Clock,
  },
  { id: "finance", label: "الصندوق", activeCls: "bg-purple-600", icon: Wallet },
  {
    id: "controlled",
    label: "دفتر المراقبة",
    activeCls: "bg-rose-700",
    icon: ShieldAlert,
  },
  {
    id: "settings",
    label: "الإعدادات والنسخ الاحتياطي",
    activeCls: "bg-emerald-600",
    icon: Settings,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("pos");
  const [showUserModal, setShowUserModal] = useState(false);

  // حالة ديناميكية لحالة الاتصال بالإنترنت تتحدث لحظياً عند انقطاع أو عودة الشبكة
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  const pendingSyncCount = usePosStore(selectPendingSyncCount);
  const {
    syncPendingBatchToCloud,
    notification,
    setNotification,
    loadInitialData,
    currentUser,
  } = usePosStore();

  // تحميل البيانات الأولية من SQLite / LocalStorage عند إقلاع التطبيق
  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  // الاستماع لأحداث الشبكة (online / offline) لتحديث شارة الاتصال في الشريط العلوي فوراً
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // فلترة التبويبات حسب صلاحيات المستخدم الحالي بمبدأ الإغلاق الآمن (إخفاء المشتريات لغير المخولين)
  const visibleTabs = TABS.filter((tab) => {
    if (
      tab.id === "purchases" &&
      !currentUser?.permissions.canManagePurchases
    ) {
      return false;
    }
    return true;
  });

  // إعادة التوجيه التلقائي إلى نقطة البيع (POS) إذا تم تبديل المستخدم إلى حساب لا يملك صلاحية التبويب المفتوح حالياً
  useEffect(() => {
    const isCurrentTabAllowed = visibleTabs.some((tab) => tab.id === activeTab);
    if (!isCurrentTabAllowed) {
      setActiveTab("pos");
    }
  }, [activeTab, visibleTabs]);

  // تسمية ولون شارة الدور الوظيفي للمستخدم الحالي
  const roleLabel = !currentUser
    ? "غير مسجل"
    : currentUser.role === "ADMIN"
      ? "مدير النظام"
      : currentUser.role === "PHARMACIST"
        ? "صيدلي"
        : "كاشير";

  const roleBadgeCls = !currentUser
    ? "text-slate-400"
    : currentUser.role === "ADMIN"
      ? "text-amber-400"
      : currentUser.role === "PHARMACIST"
        ? "text-emerald-400"
        : "text-sky-400";

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 select-none overflow-hidden">
      {/* الترويسة الرئيسية وشريط التنقل */}
      <header className="bg-slate-900 border-b border-slate-800 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-extrabold shadow-[0_0_10px_rgba(16,185,129,0.2)]">
            Rx
          </div>
          <div>
            <div className="font-bold text-white text-sm tracking-wide">
              PharmaCare Pro
            </div>
            <div className="text-[10px] text-slate-400">
              نظام صيدليات Offline-First — Clean Architecture
            </div>
          </div>
        </div>

        {/* التبويبات الموحدة المفلترة حسب الصلاحيات */}
        <nav className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shadow-inner">
          {visibleTabs.map(({ id, label, activeCls, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-bold transition text-xs ${
                activeTab === id
                  ? `${activeCls} text-white shadow-md`
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </nav>

        {/* أزرار المستخدم، الاتصال، والمزامنة */}
        <div className="flex items-center gap-2.5 text-xs">
          {/* زر المستخدم الحالي والتبديل السريع (Fast User Switching عبر PIN) */}
          <button
            onClick={() => setShowUserModal(true)}
            title="اضغط لتبديل المستخدم السريع عبر الرمز السري (PIN)"
            className="flex items-center gap-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 px-3 py-1.5 rounded-lg transition"
          >
            <div className="bg-amber-500/15 p-1.5 rounded-md border border-amber-500/30">
              <User className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-right leading-tight">
              <div className="font-bold text-white text-xs">
                {currentUser?.name || "تسجيل الدخول"}
              </div>
              <div className={`text-[10px] font-bold ${roleBadgeCls}`}>
                {roleLabel}
              </div>
            </div>
          </button>

          {/* شارة حالة الاتصال الحية (تتحدث تلقائياً مع أحداث الشبكة) */}
          <button
            type="button"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold border transition ${
              isOffline
                ? "bg-amber-950/40 text-amber-400 border-amber-800"
                : "bg-emerald-950/40 text-emerald-400 border-emerald-800"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            {isOffline ? "محلي (Offline)" : "متصل (Online)"}
          </button>

          {/* زر المزامنة السحابية اليدوية مع عدّاد الحركات المعلقة */}
          <button
            onClick={() => void syncPendingBatchToCloud()}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> مزامنة ({pendingSyncCount})
          </button>
        </div>
      </header>

      {/* شريط الإشعارات العالمي */}
      {notification && (
        <div
          className={`px-5 py-2 text-xs font-bold flex items-center justify-between ${
            notification.type === "success"
              ? "bg-emerald-900/70 text-emerald-200"
              : notification.type === "error"
                ? "bg-rose-900/70 text-rose-200"
                : notification.type === "warning"
                  ? "bg-amber-900/70 text-amber-200"
                  : "bg-sky-900/70 text-sky-200"
          }`}
        >
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* منطقة عرض الشاشات الديناميكية */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === "pos" && <POSView />}
        {activeTab === "purchases" && <PurchasesView />}
        {activeTab === "inventory" && <InventoryView />}
        {activeTab === "finance" && <FinanceView />}
        {activeTab === "controlled" && <ControlledRegistryView />}
        {activeTab === "settings" && <SettingsView />}
      </main>

      {/* نافذة التبديل السريع للمستخدمين (Numpad PIN) */}
      {showUserModal && (
        <UserSwitchModal onClose={() => setShowUserModal(false)} />
      )}
    </div>
  );
}
