import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { PosState } from "./storeTypes";
import { createPosCartSlice } from "./slices/posCartSlice";
import { createInventoryPurchaseSlice } from "./slices/inventoryPurchaseSlice";
import { createFinanceShiftSlice } from "./slices/financeShiftSlice";
import { createSystemSyncSlice } from "./slices/systemSyncSlice";

export type { PosState } from "./storeTypes";

/** عدد العمليات المتراكمة في طابور المزامنة (Pending Batch Count) */
export const selectPendingSyncCount = (state: PosState): number =>
  state.syncQueue.filter((i) => i.status === "PENDING").length;

/**
 * المتجر المركزي الموحّد (Modular Zustand Store)
 * يدمج الشرائح الأربع وفق معمارية Clean Architecture & SRP
 */
export const usePosStore = create<PosState>()(
  persist(
    (...a) => ({
      ...createSystemSyncSlice(...a),
      ...createPosCartSlice(...a),
      ...createInventoryPurchaseSlice(...a),
      ...createFinanceShiftSlice(...a),
    }),
    {
      name: "pharmacare-pro-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        heldInvoices: state.heldInvoices,
      }),
    },
  ),
);
