import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  ProductEntity,
  CartItemEntity,
  HeldInvoiceEntity,
  ControlledDrugMeta,
  DrugInteractionAlert,
  PurchaseInvoiceEntity,
  ControlledDrugLogEntity,
  CashExpenseEntity,
  ShiftSummaryEntity,
  SyncQueueItemEntity,
  LedgerPaymentEntity,
} from "../../domain/entities";
import { InvoiceEntity } from "../../domain/entities/Invoice";
import { CompleteCheckoutUseCase } from "../use-cases/CompleteCheckoutUseCase";
import {
  AddPurchaseWithBonusUseCase,
  PurchaseLineInput,
} from "../use-cases/AddPurchaseWithBonus";
import { ClinicalDecisionUseCase } from "../use-cases/ClinicalDecisionUseCase";
import { SQLiteProductRepository } from "../../infrastructure/persistence/SQLiteProductRepository";
import { SQLiteBatchRepository } from "../../infrastructure/persistence/SQLiteBatchRepository";
import { SQLiteInvoiceRepository } from "../../infrastructure/persistence/SQLiteInvoiceRepository";
import { printThermalReceipt } from "../../infrastructure/tauri/printer";
import { pushBatchToCloudServer } from "../../infrastructure/tauri/system";
import {
  CURRENT_BRANCH_ID,
  sqliteEngine,
} from "../../infrastructure/db/database";
import { v4 as uuidv4 } from "uuid";

const productRepo = new SQLiteProductRepository();
const batchRepo = new SQLiteBatchRepository();
const invoiceRepo = new SQLiteInvoiceRepository();

export interface PosState {
  // البيانات المتزامنة مع SQLite المحلي
  products: ProductEntity[];
  invoices: InvoiceEntity[];
  purchaseInvoices: PurchaseInvoiceEntity[];
  controlledLogs: ControlledDrugLogEntity[];
  expenses: CashExpenseEntity[];
  shifts: ShiftSummaryEntity[];
  syncQueue: SyncQueueItemEntity[];

  // حالة نقطة البيع (POS State)
  cart: CartItemEntity[];
  heldInvoices: HeldInvoiceEntity[];
  interactionAlerts: DrugInteractionAlert[];
  invoiceMode: "SALE" | "RETURN";
  paymentMode: "CASH" | "CREDIT";
  discountPercent: number;
  customerName: string;
  selectedProductForAlternatives: ProductEntity | null;
  pendingControlledItem: {
    product: ProductEntity;
    unit: "pack" | "strip";
  } | null;
  lastPrintedInvoice: InvoiceEntity | null;
  notification: {
    type: "success" | "error" | "warning" | "info";
    message: string;
  } | null;
  ledgerPayments: LedgerPaymentEntity[];
  // الإجراءات الأساسية (Actions)
  loadInitialData: () => Promise<void>;
  setNotification: (
    notification: {
      type: "success" | "error" | "warning" | "info";
      message: string;
    } | null,
  ) => void;
  setInvoiceMode: (mode: "SALE" | "RETURN") => void;
  toggleReturnMode: () => void;
  setPaymentMode: (mode: "CASH" | "CREDIT") => void;
  setDiscountPercent: (percent: number) => void;
  setCustomerName: (name: string) => void;
  setSelectedProductForAlternatives: (product: ProductEntity | null) => void;
  setPendingControlledItem: (
    pending: { product: ProductEntity; unit: "pack" | "strip" } | null,
  ) => void;
  setLastPrintedInvoice: (invoice: InvoiceEntity | null) => void;

  // إجراءات السلة والبيع
  requestAddToCart: (product: ProductEntity, unit: "pack" | "strip") => void;
  addToCart: (
    product: ProductEntity,
    unit: "pack" | "strip",
    meta?: ControlledDrugMeta,
  ) => void;
  updateCartQty: (cartKey: string, delta: number) => void;
  removeFromCart: (cartKey: string) => void;
  clearCart: () => void;
  holdCurrentInvoice: (customerName?: string) => void;
  resumeInvoice: (invoiceId: string) => void;
  completeCheckout: () => Promise<InvoiceEntity | null>;

  // إجراءات المشتريات والبونص
  createPurchaseWithBonus: (
    supplierName: string,
    supplierInvoiceNumber: string,
    paymentMode: "CASH" | "CREDIT",
    lines: PurchaseLineInput[],
  ) => Promise<PurchaseInvoiceEntity>;

  // إجراءات المخزون والتسعير الجماعي
  addNewProduct: (product: Omit<ProductEntity, "id">) => Promise<void>;
  importProductsBatch: (products: ProductEntity[]) => Promise<number>;
  applyBulkPricing: (
    percentChange: number,
    categoryFilter?: string,
  ) => Promise<void>;

  // إجراءات الصندوق والوردية (Cash Drawer & Shift)
  addCashExpense: (
    title: string,
    category: CashExpenseEntity["category"],
    amount: number,
    notes?: string,
  ) => Promise<void>;
  closeCurrentShift: (actualDrawerCash: number) => Promise<void>;
  openNewShift: (
    pharmacistName: string,
    openingBalance: number,
  ) => Promise<void>;

  // إجراءات المزامنة السحابية (Batch Syncing)
  syncPendingBatchToCloud: () => Promise<{
    syncedCount: number;
    batchId: string;
  }>;
  resetDemoDatabase: () => Promise<void>;

  recordLedgerPayment: (
    partyType: "CUSTOMER" | "SUPPLIER",
    partyName: string,
    amount: number,
    notes?: string,
  ) => Promise<void>;
}

/** عدد العمليات المتراكمة في طابور المزامنة (Pending Batch Count) */
export const selectPendingSyncCount = (state: PosState): number =>
  state.syncQueue.filter((i) => i.status === "PENDING").length;

const calculateUnitPrice = (
  product: ProductEntity,
  unit: "pack" | "strip",
): number => {
  if (unit === "pack") return Number(product.packPrice.toFixed(2));
  const strips = Math.max(1, product.stripsPerPack);
  return Number((product.packPrice / strips).toFixed(2));
};

const generateCartKey = (productId: string, unit: "pack" | "strip"): string => {
  return `${productId}-${unit}`;
};

export const usePosStore = create<PosState>()(
  persist(
    (set, get) => ({
      products: sqliteEngine.getSnapshot().products,
      invoices: sqliteEngine.getSnapshot().invoices,
      purchaseInvoices: sqliteEngine.getSnapshot().purchaseInvoices,
      controlledLogs: sqliteEngine.getSnapshot().controlledLogs,
      expenses: sqliteEngine.getSnapshot().expenses,
      shifts: sqliteEngine.getSnapshot().shifts,
      syncQueue: sqliteEngine.getSnapshot().syncQueue,
      ledgerPayments: sqliteEngine.getSnapshot().ledgerPayments,
      cart: [],
      heldInvoices: [],
      interactionAlerts: [],
      invoiceMode: "SALE",
      paymentMode: "CASH",
      discountPercent: 0,
      customerName: "",
      selectedProductForAlternatives: null,
      pendingControlledItem: null,
      lastPrintedInvoice: null,
      notification: null,

      loadInitialData: async () => {
        const [
          products,
          invoices,
          purchaseInvoices,
          controlledLogs,
          expenses,
          shifts,
          syncQueue,
          ledgerPayments,
        ] = await Promise.all([
          productRepo.getAllProducts(),
          invoiceRepo.getAllInvoices(),
          invoiceRepo.getAllPurchaseInvoices(),
          invoiceRepo.getControlledDrugLogs(),
          invoiceRepo.getAllExpenses(),
          invoiceRepo.getShifts(),
          invoiceRepo.getSyncQueue(),
          invoiceRepo.getLedgerPayments(),
        ]);
        set({
          products,
          invoices,
          purchaseInvoices,
          controlledLogs,
          expenses,
          shifts,
          syncQueue,
          ledgerPayments,
        });
      },

      setNotification: (notification) => {
        set({ notification });
      },

      setInvoiceMode: (invoiceMode) => {
        set({ invoiceMode });
      },

      toggleReturnMode: () => {
        const nextMode = get().invoiceMode === "SALE" ? "RETURN" : "SALE";
        set({
          invoiceMode: nextMode,
          notification: {
            type: nextMode === "RETURN" ? "warning" : "info",
            message:
              nextMode === "RETURN"
                ? "تم تفعيل وضع مرتجع المبيعات (F6)"
                : "تمت العودة لوضع البيع المباشر (SALE)",
          },
        });
      },

      setPaymentMode: (paymentMode) => set({ paymentMode }),
      setDiscountPercent: (discountPercent) =>
        set({ discountPercent: Math.min(100, Math.max(0, discountPercent)) }),
      setCustomerName: (customerName) => set({ customerName }),
      setSelectedProductForAlternatives: (selectedProductForAlternatives) =>
        set({ selectedProductForAlternatives }),
      setPendingControlledItem: (pendingControlledItem) =>
        set({ pendingControlledItem }),
      setLastPrintedInvoice: (lastPrintedInvoice) =>
        set({ lastPrintedInvoice }),

      requestAddToCart: (product, unit) => {
        const { invoiceMode, addToCart } = get();

        // التحقق من توفر الرصيد قبل الإضافة في حالة البيع
        if (invoiceMode === "SALE") {
          const totalAvailableStrips =
            product.stockPacks * product.stripsPerPack +
            product.stockLooseStrips;
          const neededStrips = unit === "pack" ? product.stripsPerPack : 1;

          if (totalAvailableStrips < neededStrips) {
            set({
              notification: {
                type: "error",
                message: `عفواً، رصيد (${product.name}) غير كافٍ! المتاح: ${product.stockPacks} علبة و ${product.stockLooseStrips} شريط.`,
              },
            });
            return;
          }

          // إذا كان الدواء مراقباً، يجب فتح نافذة توثيق الوصفة الطبية إجبارياً
          if (product.isControlled) {
            set({ pendingControlledItem: { product, unit } });
            return;
          }
        }

        addToCart(product, unit);
      },

      addToCart: (product, unit, meta) => {
        set((state) => {
          const cartKey = generateCartKey(product.id, unit);
          const existingItem = state.cart.find(
            (item) => item.cartKey === cartKey,
          );

          let updatedCart: CartItemEntity[];
          if (existingItem) {
            updatedCart = state.cart.map((item) =>
              item.cartKey === cartKey
                ? {
                    ...item,
                    qty: item.qty + 1,
                    controlledMeta: meta || item.controlledMeta,
                  }
                : item,
            );
          } else {
            const newItem: CartItemEntity = {
              cartKey,
              product,
              unit,
              qty: 1,
              unitPrice: calculateUnitPrice(product, unit),
              isControlled: product.isControlled,
              controlledMeta: meta,
            };
            updatedCart = [newItem, ...state.cart];
          }

          const interactionAlerts =
            ClinicalDecisionUseCase.detectDrugInteractions(updatedCart);

          return {
            cart: updatedCart,
            interactionAlerts,
            pendingControlledItem: null,
          };
        });
      },

      updateCartQty: (cartKey, delta) => {
        set((state) => {
          const updatedCart = state.cart
            .map((item) => {
              if (item.cartKey === cartKey) {
                const newQty = item.qty + delta;
                if (newQty <= 0) return null;

                // التحقق من سقف الرصيد عند الزيادة في وضع البيع
                if (delta > 0 && state.invoiceMode === "SALE") {
                  const maxStrips =
                    item.product.stockPacks * item.product.stripsPerPack +
                    item.product.stockLooseStrips;
                  const requestedStrips =
                    item.unit === "pack"
                      ? newQty * item.product.stripsPerPack
                      : newQty;
                  if (requestedStrips > maxStrips) {
                    return item;
                  }
                }

                return { ...item, qty: newQty };
              }
              return item;
            })
            .filter((item): item is CartItemEntity => item !== null);

          return {
            cart: updatedCart,
            interactionAlerts:
              ClinicalDecisionUseCase.detectDrugInteractions(updatedCart),
          };
        });
      },

      removeFromCart: (cartKey) => {
        set((state) => {
          const updatedCart = state.cart.filter(
            (item) => item.cartKey !== cartKey,
          );
          return {
            cart: updatedCart,
            interactionAlerts:
              ClinicalDecisionUseCase.detectDrugInteractions(updatedCart),
          };
        });
      },

      clearCart: () => {
        set({
          cart: [],
          interactionAlerts: [],
          discountPercent: 0,
          customerName: "",
          invoiceMode: "SALE",
          paymentMode: "CASH",
        });
      },

      holdCurrentInvoice: (customName) => {
        const { cart, customerName, heldInvoices, clearCart } = get();
        if (cart.length === 0) {
          // إذا كانت السلة فارغة وهناك فواتير معلقة، نستأنف أحدث فاتورة معلقة فوراً (F5 Toggle)
          if (heldInvoices.length > 0) {
            get().resumeInvoice(heldInvoices[0].id);
          }
          return;
        }

        const newHeldInvoice: HeldInvoiceEntity = {
          id: `HLD-${Date.now().toString().slice(-5)}`,
          customerName:
            customName?.trim() ||
            customerName.trim() ||
            `فاتورة معلقة #${heldInvoices.length + 1}`,
          items: [...cart],
          heldAt: new Date().toISOString(),
        };

        set((state) => ({
          heldInvoices: [newHeldInvoice, ...state.heldInvoices],
          notification: {
            type: "info",
            message: `تم تعليق الفاتورة (${newHeldInvoice.customerName}) بنجاح — اضغط F5 لاستئنافها.`,
          },
        }));

        clearCart();
      },

      resumeInvoice: (invoiceId) => {
        const { heldInvoices } = get();
        const invoiceToResume = heldInvoices.find(
          (inv) => inv.id === invoiceId,
        );
        if (!invoiceToResume) return;

        const interactionAlerts =
          ClinicalDecisionUseCase.detectDrugInteractions(invoiceToResume.items);

        set((state) => ({
          cart: invoiceToResume.items,
          customerName: invoiceToResume.customerName,
          interactionAlerts,
          heldInvoices: state.heldInvoices.filter(
            (inv) => inv.id !== invoiceId,
          ),
          notification: {
            type: "success",
            message: `تم استئناف الفاتورة المعلقة (${invoiceToResume.customerName})`,
          },
        }));
      },

      completeCheckout: async () => {
        const {
          cart,
          discountPercent,
          customerName,
          invoiceMode,
          paymentMode,
          clearCart,
          loadInitialData,
        } = get();

        if (cart.length === 0) {
          set({
            notification: {
              type: "warning",
              message: "السلة فارغة! أضف دواءً أولاً لإتمام الفاتورة.",
            },
          });
          return null;
        }

        try {
          const useCase = new CompleteCheckoutUseCase(
            productRepo,
            invoiceRepo,
            batchRepo,
          );

          const savedInvoice = await useCase.execute(
            cart,
            discountPercent,
            customerName,
            invoiceMode,
            paymentMode,
          );

          await printThermalReceipt(savedInvoice);
          clearCart();
          await loadInitialData();

          set({
            lastPrintedInvoice: savedInvoice,
            notification: {
              type: "success",
              message: `تم حفظ الفاتورة رقم ${savedInvoice.id} وخصم الدفعات (FIFO) بنجاح — الصافي: ${savedInvoice.totalAmount.toFixed(2)} ر.س`,
            },
          });

          return savedInvoice;
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "خطأ غير متوقع أثناء البيع";
          set({
            notification: {
              type: "error",
              message,
            },
          });
          return null;
        }
      },

      createPurchaseWithBonus: async (
        supplierName,
        supplierInvoiceNumber,
        paymentMode,
        lines,
      ) => {
        const useCase = new AddPurchaseWithBonusUseCase(
          productRepo,
          batchRepo,
          invoiceRepo,
        );

        const savedPurchase = await useCase.execute(
          supplierName,
          supplierInvoiceNumber,
          paymentMode,
          lines,
        );

        await get().loadInitialData();
        set({
          notification: {
            type: "success",
            message: `تم توريد فاتورة المشتريات (${savedPurchase.id}) وحساب التكلفة المرجحة مع البونص بنجاح!`,
          },
        });

        return savedPurchase;
      },

      addNewProduct: async (newProductData) => {
        const product: ProductEntity = {
          ...newProductData,
          id: `prod-${uuidv4().slice(0, 8)}`,
          branchId: CURRENT_BRANCH_ID,
          updatedAt: new Date().toISOString(),
        };
        await productRepo.upsertProduct(product);
        await get().loadInitialData();
        set({
          notification: {
            type: "success",
            message: `تمت إضافة الصنف الدوائي (${product.name}) إلى قاعدة البيانات.`,
          },
        });
      },
      importProductsBatch: async (importedProducts) => {
        for (const prod of importedProducts) {
          await productRepo.upsertProduct(prod);
        }
        await get().loadInitialData();
        set({
          notification: {
            type: "success",
            message: `تم استيراد وتحديث (${importedProducts.length}) صنف دوائي من ملف Excel بنجاح!`,
          },
        });
        return importedProducts.length;
      },
      applyBulkPricing: async (percentChange, categoryFilter) => {
        await productRepo.applyBulkPriceAdjustment(
          percentChange,
          categoryFilter,
        );
        await get().loadInitialData();
        set({
          notification: {
            type: "success",
            message: `تم تطبيق تعديل الأسعار الجماعي (${percentChange > 0 ? `+${percentChange}%` : `${percentChange}%`}) بنجاح.`,
          },
        });
      },

      addCashExpense: async (title, category, amount, notes) => {
        const openShift = get().shifts.find((s) => s.status === "OPEN");
        const expense: CashExpenseEntity = {
          id: `EXP-${Date.now().toString().slice(-6)}`,
          title: title.trim(),
          category,
          amount: Number(amount.toFixed(2)),
          notes: notes?.trim(),
          createdAt: new Date().toISOString(),
          shiftId: openShift?.id || "shift-default-01",
          branchId: CURRENT_BRANCH_ID,
        };

        await invoiceRepo.saveExpense(expense);
        await get().loadInitialData();
        set({
          notification: {
            type: "success",
            message: `تم تسجيل مصروف (${expense.title}) بقيمة ${expense.amount.toFixed(2)}.`,
          },
        });
      },

      closeCurrentShift: async (actualDrawerCash) => {
        const openShift = get().shifts.find((s) => s.status === "OPEN");
        if (!openShift) return;

        const closedShift: ShiftSummaryEntity = {
          ...openShift,
          status: "CLOSED",
          closedAt: new Date().toISOString(),
          actualDrawerCash: Number(actualDrawerCash.toFixed(2)),
          variance: Number(
            (actualDrawerCash - openShift.expectedDrawerCash).toFixed(2),
          ),
        };

        await invoiceRepo.saveShift(closedShift);
        await get().loadInitialData();
        set({
          notification: {
            type: "warning",
            message: `تم إغلاق الوردية (${closedShift.id}). الفارق النقدي: ${closedShift.variance}`,
          },
        });
      },
      openNewShift: async (pharmacistName, openingBalance) => {
        const newShift: ShiftSummaryEntity = {
          id: `SHIFT-${Date.now().toString().slice(-4)}`,
          pharmacistName: pharmacistName.trim() || "د. صيدلي مناوب",
          openedAt: new Date().toISOString(),
          status: "OPEN",
          openingBalance: Number(openingBalance.toFixed(2)),
          cashSalesTotal: 0,
          creditSalesTotal: 0,
          returnsTotal: 0,
          pettyCashTotal: 0,
          expectedDrawerCash: Number(openingBalance.toFixed(2)),
          branchId: CURRENT_BRANCH_ID,
        };
        await invoiceRepo.saveShift(newShift);
        await get().loadInitialData();
        set({
          notification: {
            type: "success",
            message: `تم فتح وردية جديدة للصيدلي (${newShift.pharmacistName}).`,
          },
        });
      },

      recordLedgerPayment: async (partyType, partyName, amount, notes) => {
        if (!partyName.trim() || amount <= 0) return;
        const payment: LedgerPaymentEntity = {
          id: `PAY-${Date.now().toString().slice(-6)}`,
          partyType,
          partyName: partyName.trim(),
          amount: Number(amount.toFixed(2)),
          notes: notes?.trim(),
          createdAt: new Date().toISOString(),
          branchId: CURRENT_BRANCH_ID,
        };
        await invoiceRepo.saveLedgerPayment(payment);
        await get().loadInitialData();
        set({
          notification: {
            type: "success",
            message:
              partyType === "CUSTOMER"
                ? `تم تسجيل سند قبض بقيمة ${amount.toFixed(2)} من العميل (${partyName}).`
                : `تم تسجيل سند صرف بقيمة ${amount.toFixed(2)} للمستودع (${partyName}).`,
          },
        });
      },
      syncPendingBatchToCloud: async () => {
        const pending = get().syncQueue.filter((i) => i.status === "PENDING");
        const result = await pushBatchToCloudServer(pending);
        if (result.syncedIds.length > 0) {
          await invoiceRepo.markSyncItemsCompleted(result.syncedIds);
          await get().loadInitialData();
        }
        set({
          notification: {
            type: "success",
            message:
              result.syncedCount > 0
                ? `تمت مزامنة حزمة العمليات (${result.syncedCount} حركة) بنجاح إلى السيرفر السحابي [${result.batchId}]`
                : "جميع السجلات المحلية متزامنة بالفعل مع السحابة المركزية.",
          },
        });
        return { syncedCount: result.syncedCount, batchId: result.batchId };
      },
      resetDemoDatabase: async () => {
        sqliteEngine.resetToFactory();
        get().clearCart();
        await get().loadInitialData();
        set({
          heldInvoices: [],
          notification: {
            type: "info",
            message:
              "تمت إعادة ضبط قاعدة البيانات المحلية للبيانات الافتراضية.",
          },
        });
      },
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
