import React, { useEffect, useMemo, useState } from "react";
import { usePosStore } from "../../application/store/usePosStore";
import { PackagePlus, ClipboardList, FileText, Building2 } from "lucide-react";
import { SuppliersManagerModal } from "../components/purchases/SuppliersManagerModal";
import { PurchaseEntryTab } from "../components/purchases/PurchaseEntryTab";
import { PurchaseShortagesTab } from "../components/purchases/PurchaseShortagesTab";
import { PurchaseReportsTab } from "../components/purchases/PurchaseReportsTab";

export type PurchasesSubTab = "entry" | "shortages" | "reports";

interface PurchasesViewProps {
  activeSubTab?: PurchasesSubTab;
  onChangeSubTab?: (tab: PurchasesSubTab) => void;
  openSuppliersSignal?: number;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  activeSubTab: controlledSubTab,
  onChangeSubTab,
  openSuppliersSignal = 0,
}) => {
  const canManagePurchases = usePosStore(
    (s) => s.currentUser?.permissions.canManagePurchases ?? false,
  );
  const canViewCost = usePosStore(
    (s) => s.currentUser?.permissions.canViewCostAndProfit ?? false,
  );
  const { products, purchaseInvoices, suppliers, createPurchaseWithBonus } =
    usePosStore();

  const [internalSubTab, setInternalSubTab] =
    useState<PurchasesSubTab>("entry");
  const activeSubTab = controlledSubTab ?? internalSubTab;
  const setActiveSubTab = (tab: PurchasesSubTab) => {
    setInternalSubTab(tab);
    onChangeSubTab?.(tab);
  };

  const [showSuppliersModal, setShowSuppliersModal] = useState(false);
  const [draftLinesCount, setDraftLinesCount] = useState(0);

  useEffect(() => {
    if (openSuppliersSignal > 0) {
      setShowSuppliersModal(true);
    }
  }, [openSuppliersSignal]);

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.isActive),
    [suppliers],
  );

  const shortageProducts = useMemo(
    () =>
      products
        .filter((p) => p.stockPacks <= p.minLimit)
        .sort((a, b) => a.stockPacks - b.stockPacks),
    [products],
  );

  if (!canManagePurchases) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 p-6">
        <div className="p-8 bg-rose-950/20 border border-rose-900/60 rounded-2xl text-rose-300 text-center max-w-md">
          <h3 className="font-bold text-sm">
            غير مصرح لك بالوصول لقسم المشتريات
          </h3>
          <p className="text-xs text-rose-400/80 mt-1">
            يرجى التبديل إلى حساب صيدلي أو مدير نظام يمتلك صلاحية إدارة
            المشتريات.
          </p>
        </div>
      </div>
    );
  }

  const isEntryScannerActive = activeSubTab === "entry" && !showSuppliersModal;

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-950 text-slate-200 text-xs">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-indigo-400" /> المشتريات،
            البونص، وطلبيات المستودعات
          </h2>
          <p className="text-slate-400 mt-0.5">
            إدخال فواتير الشراء بالباركود والتكلفة المرجحة، توزيع طلبيات النواقص
            على المستودعات، وتقارير المشتريات التفصيلية.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowSuppliersModal(true)}
          className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-indigo-300 hover:text-white font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow transition"
        >
          <Building2 className="w-4 h-4 text-indigo-400" />
          <span>إدارة دليل المستودعات</span>
          <span className="font-mono text-[10px] bg-indigo-950 border border-indigo-800 text-indigo-200 px-2 py-0.5 rounded-full">
            {activeSuppliers.length}
          </span>
        </button>
      </div>

      <div className="mb-5 flex items-center gap-2 flex-wrap bg-slate-900 p-1.5 rounded-xl border border-slate-800 w-fit">
        <button
          type="button"
          onClick={() => setActiveSubTab("entry")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition ${
            activeSubTab === "entry"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <PackagePlus className="w-4 h-4" />
          إدخال فاتورة شراء وبونص
          {draftLinesCount > 0 && (
            <span
              className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                activeSubTab === "entry"
                  ? "bg-indigo-950/60 text-indigo-100"
                  : "bg-indigo-950 text-indigo-300"
              }`}
            >
              {draftLinesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("shortages")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition ${
            activeSubTab === "shortages"
              ? "bg-sky-600 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          دفتر النواقص والطلبيات
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
              activeSubTab === "shortages"
                ? "bg-sky-950/60 text-sky-100"
                : shortageProducts.length > 0
                  ? "bg-rose-600 text-white"
                  : "bg-slate-800 text-slate-400"
            }`}
          >
            {shortageProducts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("reports")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition ${
            activeSubTab === "reports"
              ? "bg-emerald-700 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          تقارير وسجل فواتير الشراء
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
              activeSubTab === "reports"
                ? "bg-emerald-950/60 text-emerald-100"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            {purchaseInvoices.length}
          </span>
        </button>
      </div>

      {activeSubTab === "entry" && (
        <PurchaseEntryTab
          products={products}
          activeSuppliers={activeSuppliers}
          canViewCost={canViewCost}
          isScannerActive={isEntryScannerActive}
          onOpenSuppliersModal={() => setShowSuppliersModal(true)}
          onLinesCountChange={setDraftLinesCount}
          onSubmitPurchase={createPurchaseWithBonus}
        />
      )}

      {activeSubTab === "shortages" && (
        <PurchaseShortagesTab
          shortageProducts={shortageProducts}
          canViewCost={canViewCost}
          onOpenSuppliersModal={() => setShowSuppliersModal(true)}
        />
      )}

      {activeSubTab === "reports" && (
        <PurchaseReportsTab purchaseInvoices={purchaseInvoices} />
      )}

      <SuppliersManagerModal
        isOpen={showSuppliersModal}
        onClose={() => setShowSuppliersModal(false)}
      />
    </div>
  );
};
