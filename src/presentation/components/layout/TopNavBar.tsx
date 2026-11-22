import React, { useEffect, useMemo, useRef, useState } from "react";
import { UserEntity } from "../../../domain/entities/User";
import {
  ShoppingCart,
  PackagePlus,
  Clock,
  Wallet,
  ShieldAlert,
  Settings,
  User,
  ChevronDown,
  ClipboardList,
  FileText,
  Building2,
  Package,
  ClipboardCheck,
} from "lucide-react";

export type NavTabId =
  | "pos"
  | "purchases"
  | "inventory"
  | "finance"
  | "controlled"
  | "settings";

export type NavPurchasesSubTab = "entry" | "shortages" | "reports";
export type NavInventorySubTab = "stock" | "losses";

interface SubMenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  badgeCls?: string;
  isActive?: boolean;
  dividerBefore?: boolean;
  onSelect: () => void;
}

interface TopNavBarProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  currentUser: UserEntity | null;
  onOpenUserModal: () => void;
  purchasesSubTab: NavPurchasesSubTab;
  onSelectPurchasesSubTab: (subTab: NavPurchasesSubTab) => void;
  onTriggerOpenSuppliersModal: () => void;
  inventorySubTab: NavInventorySubTab;
  onSelectInventorySubTab: (subTab: NavInventorySubTab) => void;
  shortageCount: number;
  purchaseInvoicesCount: number;
  activeSuppliersCount: number;
  productsCount: number;
  inventoryLossCount: number;
}

const TABS: {
  id: NavTabId;
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

export const TopNavBar: React.FC<TopNavBarProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  onOpenUserModal,
  purchasesSubTab,
  onSelectPurchasesSubTab,
  onTriggerOpenSuppliersModal,
  inventorySubTab,
  onSelectInventorySubTab,
  shortageCount,
  purchaseInvoicesCount,
  activeSuppliersCount,
  productsCount,
  inventoryLossCount,
}) => {
  const [openDropdownTab, setOpenDropdownTab] = useState<NavTabId | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);

  const canViewCost = currentUser?.permissions.canViewCostAndProfit ?? false;

  const visibleTabs = useMemo(
    () =>
      TABS.filter((tab) => {
        if (
          tab.id === "purchases" &&
          !currentUser?.permissions.canManagePurchases
        ) {
          return false;
        }
        return true;
      }),
    [currentUser],
  );

  useEffect(() => {
    if (!openDropdownTab) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdownTab(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenDropdownTab(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [openDropdownTab]);

  useEffect(() => {
    return () => {
      if (hoverCloseTimerRef.current !== null) {
        window.clearTimeout(hoverCloseTimerRef.current);
      }
    };
  }, []);

  const clearHoverCloseTimer = () => {
    if (hoverCloseTimerRef.current !== null) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const handleDropdownMouseEnter = (tabId: NavTabId) => {
    clearHoverCloseTimer();
    setOpenDropdownTab(tabId);
  };

  const handleDropdownMouseLeave = () => {
    clearHoverCloseTimer();
    hoverCloseTimerRef.current = window.setTimeout(() => {
      setOpenDropdownTab(null);
    }, 140);
  };

  const getSubMenuItems = (tabId: NavTabId): SubMenuItem[] | null => {
    if (tabId === "purchases") {
      return [
        {
          id: "purchases-entry",
          label: "إدخال فاتورة شراء وبونص",
          icon: PackagePlus,
          isActive: activeTab === "purchases" && purchasesSubTab === "entry",
          onSelect: () => {
            onSelectPurchasesSubTab("entry");
            onSelectTab("purchases");
            setOpenDropdownTab(null);
          },
        },
        {
          id: "purchases-shortages",
          label: "دفتر النواقص والطلبيات",
          icon: ClipboardList,
          badge: shortageCount,
          badgeCls:
            shortageCount > 0
              ? "bg-rose-600 text-white"
              : "bg-slate-800 text-slate-400",
          isActive:
            activeTab === "purchases" && purchasesSubTab === "shortages",
          onSelect: () => {
            onSelectPurchasesSubTab("shortages");
            onSelectTab("purchases");
            setOpenDropdownTab(null);
          },
        },
        {
          id: "purchases-reports",
          label: "تقارير وسجل فواتير الشراء",
          icon: FileText,
          badge: purchaseInvoicesCount,
          badgeCls: "bg-slate-800 text-slate-300",
          isActive: activeTab === "purchases" && purchasesSubTab === "reports",
          onSelect: () => {
            onSelectPurchasesSubTab("reports");
            onSelectTab("purchases");
            setOpenDropdownTab(null);
          },
        },
        {
          id: "purchases-suppliers",
          label: "إدارة دليل المستودعات",
          icon: Building2,
          badge: activeSuppliersCount,
          badgeCls: "bg-indigo-950 border border-indigo-800 text-indigo-200",
          dividerBefore: true,
          onSelect: () => {
            onSelectTab("purchases");
            onTriggerOpenSuppliersModal();
            setOpenDropdownTab(null);
          },
        },
      ];
    }

    if (tabId === "inventory") {
      const items: SubMenuItem[] = [
        {
          id: "inventory-stock",
          label: "المخزون ورادار الصلاحيات",
          icon: Package,
          badge: productsCount,
          badgeCls: "bg-slate-800 text-slate-300",
          isActive: activeTab === "inventory" && inventorySubTab === "stock",
          onSelect: () => {
            onSelectInventorySubTab("stock");
            onSelectTab("inventory");
            setOpenDropdownTab(null);
          },
        },
      ];

      if (canViewCost) {
        items.push({
          id: "inventory-losses",
          label: "سجل التوالف والفروقات الجردية",
          icon: ClipboardCheck,
          badge: inventoryLossCount,
          badgeCls:
            inventoryLossCount > 0
              ? "bg-rose-950 text-rose-300 border border-rose-800/70"
              : "bg-slate-800 text-slate-400",
          isActive: activeTab === "inventory" && inventorySubTab === "losses",
          onSelect: () => {
            onSelectInventorySubTab("losses");
            onSelectTab("inventory");
            setOpenDropdownTab(null);
          },
        });
      }

      return items;
    }

    return null;
  };

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
    <header className="bg-slate-900 border-b border-slate-800 px-5 py-3 flex items-center justify-between gap-4 relative z-30">
      <div className="flex items-center gap-3 shrink-0">
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

      <nav
        ref={navRef}
        className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shadow-inner"
      >
        {visibleTabs.map(({ id, label, activeCls, icon: Icon }) => {
          const subItems = getSubMenuItems(id);
          const isActive = activeTab === id;
          const isDropdownOpen = openDropdownTab === id;

          if (!subItems) {
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onSelectTab(id);
                  setOpenDropdownTab(null);
                }}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-bold transition text-xs ${
                  isActive
                    ? `${activeCls} text-white shadow-md`
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            );
          }

          return (
            <div
              key={id}
              className="relative"
              onMouseEnter={() => handleDropdownMouseEnter(id)}
              onMouseLeave={handleDropdownMouseLeave}
            >
              <div
                className={`flex items-center rounded-lg font-bold transition text-xs ${
                  isActive
                    ? `${activeCls} text-white shadow-md`
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectTab(id);
                    setOpenDropdownTab(null);
                  }}
                  className="flex items-center gap-1.5 pr-3.5 pl-2 py-1.5"
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>

                <button
                  type="button"
                  aria-label={`فتح قائمة ${label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenDropdownTab((prev) => (prev === id ? null : id));
                  }}
                  className={`pl-2 pr-1 py-1.5 rounded-l-lg transition ${
                    isActive
                      ? "hover:bg-black/15 text-white/90"
                      : "hover:bg-slate-700/70 text-slate-400 hover:text-white"
                  }`}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      isDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>

              {isDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 z-50">
                  {subItems.map((item) => {
                    const SubIcon = item.icon;
                    return (
                      <React.Fragment key={item.id}>
                        {item.dividerBefore && (
                          <div className="my-1 border-t border-slate-800" />
                        )}
                        <button
                          type="button"
                          onClick={item.onSelect}
                          className={`w-full px-3.5 py-2 text-right text-xs font-bold flex items-center justify-between gap-2 transition ${
                            item.isActive
                              ? "bg-slate-800 text-white"
                              : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <SubIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {typeof item.badge === "number" && (
                            <span
                              className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                                item.badgeCls || "bg-slate-800 text-slate-300"
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onOpenUserModal}
        title="اضغط لتبديل المستخدم السريع عبر الرمز السري (PIN)"
        className="shrink-0 flex items-center gap-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 px-3 py-1.5 rounded-lg transition text-xs"
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
    </header>
  );
};
