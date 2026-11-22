import React, { useEffect, useMemo, useState } from "react";
import { POSView } from "./presentation/views/POSView";
import {
  PurchasesView,
  PurchasesSubTab,
} from "./presentation/views/PurchasesView";
import {
  InventoryView,
  InventorySubTab,
} from "./presentation/views/InventoryView";
import { FinanceView } from "./presentation/views/FinanceView";
import { ControlledRegistryView } from "./presentation/views/ControlledRegistryView";
import { SettingsView } from "./presentation/views/SettingsView";
import { UserSwitchModal } from "./presentation/components/auth/UserSwitchModal";
import { StatusBar } from "./presentation/components/StatusBar";
import {
  TopNavBar,
  NavTabId,
} from "./presentation/components/layout/TopNavBar";
import {
  ClinicalThemeMode,
  ClinicalThemeService,
} from "./infrastructure/config/ClinicalThemeService";
import { SoundFeedbackService } from "./infrastructure/audio/SoundFeedbackService";
import { X } from "lucide-react";
import {
  usePosStore,
  selectPendingSyncCount,
} from "./application/store/usePosStore";

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTabId>("pos");
  const [purchasesSubTab, setPurchasesSubTab] =
    useState<PurchasesSubTab>("entry");
  const [inventorySubTab, setInventorySubTab] =
    useState<InventorySubTab>("stock");
  const [openSuppliersSignal, setOpenSuppliersSignal] = useState(0);

  const [showUserModal, setShowUserModal] = useState(false);
  const [clinicalMode, setClinicalMode] = useState<ClinicalThemeMode>(() =>
    ClinicalThemeService.getMode(),
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() =>
    SoundFeedbackService.isEnabled(),
  );

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
    settings,
    products,
    purchaseInvoices,
    expenses,
    suppliers,
  } = usePosStore();

  const shortageCount = useMemo(
    () => products.filter((p) => p.stockPacks <= p.minLimit).length,
    [products],
  );
  const activeSuppliersCount = useMemo(
    () => suppliers.filter((s) => s.isActive).length,
    [suppliers],
  );
  const inventoryLossCount = useMemo(
    () => expenses.filter((e) => e.shiftId === "INVENTORY-LOSS").length,
    [expenses],
  );

  useEffect(() => {
    setClinicalMode(ClinicalThemeService.init());
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

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

  useEffect(() => {
    if (
      activeTab === "purchases" &&
      !currentUser?.permissions.canManagePurchases
    ) {
      setActiveTab("pos");
    }
  }, [activeTab, currentUser]);

  const handleToggleClinicalMode = () => {
    const nextMode = ClinicalThemeService.toggle();
    setClinicalMode(nextMode);
    setNotification({
      type: "info",
      message:
        nextMode === "clinical-night"
          ? "تم تفعيل الوضع الليلي السريري (تخفيف الوهج والضوء الأزرق للمناوبة الليلية)."
          : "تمت العودة إلى الوضع القياسي للشاشة.",
    });
  };

  const handleToggleSound = () => {
    const nextEnabled = SoundFeedbackService.toggle();
    setSoundEnabled(nextEnabled);
    setNotification({
      type: "info",
      message: nextEnabled
        ? "تم تفعيل النغمات الصوتية لنقطة البيع."
        : "تم كتم النغمات الصوتية لنقطة البيع.",
    });
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 select-none overflow-hidden">
      <TopNavBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentUser={currentUser}
        onOpenUserModal={() => setShowUserModal(true)}
        purchasesSubTab={purchasesSubTab}
        onSelectPurchasesSubTab={setPurchasesSubTab}
        onTriggerOpenSuppliersModal={() =>
          setOpenSuppliersSignal((prev) => prev + 1)
        }
        inventorySubTab={inventorySubTab}
        onSelectInventorySubTab={setInventorySubTab}
        shortageCount={shortageCount}
        purchaseInvoicesCount={purchaseInvoices.length}
        activeSuppliersCount={activeSuppliersCount}
        productsCount={products.length}
        inventoryLossCount={inventoryLossCount}
      />

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
          <button type="button" onClick={() => setNotification(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden">
        {activeTab === "pos" && <POSView />}
        {activeTab === "purchases" && (
          <PurchasesView
            activeSubTab={purchasesSubTab}
            onChangeSubTab={setPurchasesSubTab}
            openSuppliersSignal={openSuppliersSignal}
          />
        )}
        {activeTab === "inventory" && (
          <InventoryView
            activeSubTab={inventorySubTab}
            onChangeSubTab={setInventorySubTab}
          />
        )}
        {activeTab === "finance" && <FinanceView />}
        {activeTab === "controlled" && <ControlledRegistryView />}
        {activeTab === "settings" && <SettingsView />}
      </main>

      <StatusBar
        isOffline={isOffline}
        pendingSyncCount={pendingSyncCount}
        onSyncNow={() => void syncPendingBatchToCloud()}
        printerName={settings.thermalPrinterName}
        pharmacyName={settings.pharmacyName}
        clinicalMode={clinicalMode}
        onToggleClinicalMode={handleToggleClinicalMode}
        onOpenSettings={() => setActiveTab("settings")}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
      />

      {showUserModal && (
        <UserSwitchModal onClose={() => setShowUserModal(false)} />
      )}
    </div>
  );
}
