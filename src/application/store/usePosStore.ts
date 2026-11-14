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
  PharmacySettingsEntity,
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
import { SettingsService } from "../../infrastructure/config/SettingsService";
import { BackupService } from "../../infrastructure/backup/BackupService";
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
  ledgerPayments: LedgerPaymentEntity[];
  settings: PharmacySettingsEntity;

  // حالة نقطة البيع (POS State)
  cart: CartItemEntity[];
  heldInvoices: HeldInvoiceEntity[];
  interactionAlerts: DrugInteractionAlert[];
  invoiceMode: "SALE" | "RETURN";
  returnSourceInvoiceId: string | null;
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

  // الإجراءات الأساسية (Actions)
  loadInitialData: () => Promise<void>;
  updatePharmacySettings: (newSettings: PharmacySettingsEntity) => void;
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

  // إجراءات السلة والبيع والباركود والمرتجع
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
  handleBarcodeScan: (rawBarcode: string) => boolean;
  loadInvoiceForReturn: (invoiceQuery: string) => boolean;

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
  closeCurrentShift: (
    actualDrawerCash: number,
    safeDropAmount?: number,
  ) => Promise<void>;
  openNewShift: (
    pharmacistName: string,
    openingBalance: number,
  ) => Promise<void>;

  // إجراءات المزامنة السحابية والنسخ الاحتياطي المحلي
  syncPendingBatchToCloud: () => Promise<{
    syncedCount: number;
    batchId: string;
  }>;
  exportDatabaseBackup: () => void;
  restoreDatabaseBackup: (file: File) => Promise<void>;
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
      settings: SettingsService.getSettings(),

      cart: [],
      heldInvoices: [],
      interactionAlerts: [],
      invoiceMode: "SALE",
      returnSourceInvoiceId: null,
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
          syncedSettings,
        ] = await Promise.all([
          productRepo.getAllProducts(),
          invoiceRepo.getAllInvoices(),
          invoiceRepo.getAllPurchaseInvoices(),
          invoiceRepo.getControlledDrugLogs(),
          invoiceRepo.getAllExpenses(),
          invoiceRepo.getShifts(),
          invoiceRepo.getSyncQueue(),
          invoiceRepo.getLedgerPayments(),
          SettingsService.syncFromSQLite(),
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
          settings: syncedSettings,
        });
      },

      updatePharmacySettings: (newSettings) => {
        const saved = SettingsService.saveSettings(newSettings);
        set({
          settings: saved,
          notification: {
            type: "success",
            message: "تم حفظ إعدادات الصيدلية والطابعة والمزامنة بنجاح.",
          },
        });
      },

      setNotification: (notification) => {
        set({ notification });
      },

      setInvoiceMode: (invoiceMode) => {
        set({
          invoiceMode,
          returnSourceInvoiceId:
            invoiceMode === "SALE" ? null : get().returnSourceInvoiceId,
        });
      },

      toggleReturnMode: () => {
        const nextMode = get().invoiceMode === "SALE" ? "RETURN" : "SALE";
        set({
          invoiceMode: nextMode,
          returnSourceInvoiceId: null,
          notification: {
            type: nextMode === "RETURN" ? "warning" : "info",
            message:
              nextMode === "RETURN"
                ? "تم تفعيل وضع مرتجع المبيعات (F6) — يمكنك مسح باركود الفاتورة لاستردادها"
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
          returnSourceInvoiceId: null,
          paymentMode: "CASH",
        });
      },

      /**
       * الخطوة 1: معالج قارئ الباركود الليزري العالمي
       * يدعم:
       * 1. باركود الفاتورة (INV-...) لتحميل الفاتورة في وضع المرتجع
       * 2. باركود الشريط الفرط المنتهي بـ (-S) لإضافة شريط مباشرة
       * 3. باركود العلبة القياسي لإضافة علبة مباشرة عبر requestAddToCart
       */
      handleBarcodeScan: (rawBarcode) => {
        const code = rawBarcode.trim();
        if (!code) return false;

        if (code.toUpperCase().startsWith("INV-")) {
          return get().loadInvoiceForReturn(code);
        }

        const isStripLabel = code.toUpperCase().endsWith("-S");
        const baseBarcode = isStripLabel ? code.slice(0, -2) : code;

        const matchedProduct = get().products.find(
          (p) => p.barcode.toLowerCase() === baseBarcode.toLowerCase(),
        );

        if (matchedProduct) {
          const unitToAdd: "pack" | "strip" =
            isStripLabel && matchedProduct.stripsPerPack > 1 ? "strip" : "pack";
          get().requestAddToCart(matchedProduct, unitToAdd);
          set({
            notification: {
              type: "success",
              message: `تم لقط الباركود: ${matchedProduct.name} (${
                unitToAdd === "pack" ? "علبة" : "شريط فرط"
              })`,
            },
          });
          return true;
        }

        set({
          notification: {
            type: "warning",
            message: `لم يتم العثور على صنف مسجل بالباركود (${code})`,
          },
        });
        return false;
      },

      /**
       * الخطوة 6: استرداد الفاتورة الأصلية بالرقم أو الباركود عند عمل مرتجع مبيعات
       */
      loadInvoiceForReturn: (invoiceQuery) => {
        const cleanQuery = invoiceQuery.trim().toUpperCase();
        if (!cleanQuery) return false;

        const targetInvoice = get().invoices.find(
          (inv) =>
            inv.type === "SALE" &&
            (inv.id.toUpperCase() === cleanQuery ||
              inv.id.toUpperCase().endsWith(cleanQuery)),
        );

        if (!targetInvoice) {
          set({
            notification: {
              type: "error",
              message: `لم يتم العثور على فاتورة مبيعات بالرقم (${invoiceQuery}).`,
            },
          });
          return false;
        }

        const currentProducts = get().products;
        const restoredItems: CartItemEntity[] = targetInvoice.items.map(
          (item) => {
            const latestProduct =
              currentProducts.find((p) => p.id === item.product.id) ||
              item.product;
            return {
              cartKey: generateCartKey(latestProduct.id, item.unit),
              product: latestProduct,
              unit: item.unit,
              qty: item.qty,
              unitPrice: item.unitPrice,
              isControlled: latestProduct.isControlled,
              controlledMeta: item.controlledMeta,
            };
          },
        );

        set({
          invoiceMode: "RETURN",
          returnSourceInvoiceId: targetInvoice.id,
          cart: restoredItems,
          customerName: targetInvoice.customerName,
          discountPercent: targetInvoice.discountPercent,
          paymentMode: targetInvoice.paymentMode,
          interactionAlerts: [],
          notification: {
            type: "warning",
            message: `تم استرداد الفاتورة (${targetInvoice.id}) للعميل (${targetInvoice.customerName}) بكامل أسعارها لإجراء المرتجع.`,
          },
        });
        return true;
      },

      holdCurrentInvoice: (customName) => {
        const { cart, customerName, heldInvoices, clearCart } = get();
        if (cart.length === 0) {
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

      closeCurrentShift: async (actualDrawerCash, safeDropAmount = 0) => {
        const openShift = get().shifts.find((s) => s.status === "OPEN");
        if (!openShift) return;

        const safeActual = Number(actualDrawerCash.toFixed(2));
        const safeDrop = Math.max(
          0,
          Math.min(safeActual, Number(safeDropAmount.toFixed(2))),
        );
        const nextFloat = Number((safeActual - safeDrop).toFixed(2));
        const variance = Number(
          (safeActual - openShift.expectedDrawerCash).toFixed(2),
        );

        const closedShift: ShiftSummaryEntity = {
          ...openShift,
          status: "CLOSED",
          closedAt: new Date().toISOString(),
          actualDrawerCash: safeActual,
          variance,
          safeDropAmount: safeDrop,
          nextShiftFloat: nextFloat,
        };

        await invoiceRepo.saveShift(closedShift);
        await get().loadInitialData();

        const statusText =
          variance === 0
            ? "الصندوق مطابق تماماً (0.00)"
            : variance > 0
              ? `فائض في الصندوق (+${variance.toFixed(2)})`
              : `عجز في الصندوق (${variance.toFixed(2)})`;

        set({
          notification: {
            type: variance < 0 ? "error" : "success",
            message: `تم إغلاق الوردية (${closedShift.id}) — ${statusText} | المورّد للخزنة: ${safeDrop.toFixed(2)} | العهدة المرحلة: ${nextFloat.toFixed(2)}`,
          },
        });
      },

      openNewShift: async (pharmacistName, openingBalance) => {
        const initial = Number(openingBalance.toFixed(2));
        const newShift: ShiftSummaryEntity = {
          id: `SHIFT-${Date.now().toString().slice(-4)}`,
          pharmacistName: pharmacistName.trim() || "د. صيدلي مناوب",
          openedAt: new Date().toISOString(),
          status: "OPEN",
          openingBalance: initial,
          cashSalesTotal: 0,
          creditSalesTotal: 0,
          returnsTotal: 0,
          creditReturnsTotal: 0,
          debtCollectionsTotal: 0,
          supplierPaymentsTotal: 0,
          cashPurchasesTotal: 0,
          pettyCashTotal: 0,
          expectedDrawerCash: initial,
          branchId: CURRENT_BRANCH_ID,
        };
        await invoiceRepo.saveShift(newShift);
        await get().loadInitialData();
        set({
          notification: {
            type: "success",
            message: `تم فتح وردية جديدة للصيدلي (${newShift.pharmacistName}) بعهدة افتتاحية ${initial.toFixed(2)}.`,
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

      /**
       * تصدير نسخة احتياطية كاملة بضغطة زر
       */
      exportDatabaseBackup: () => {
        const state = get();
        const fileName = BackupService.exportBackupFile(
          {
            products: state.products,
            invoices: state.invoices,
            purchaseInvoices: state.purchaseInvoices,
            controlledLogs: state.controlledLogs,
            expenses: state.expenses,
            shifts: state.shifts,
            syncQueue: state.syncQueue,
            ledgerPayments: state.ledgerPayments,
          },
          state.settings,
        );

        set({
          notification: {
            type: "success",
            message: `تم تصدير النسخة الاحتياطية الكاملة بنجاح (${fileName}).`,
          },
        });
      },

      /**
       * استعادة قاعدة البيانات بالكامل من ملف نسخة احتياطية
       */
      restoreDatabaseBackup: async (file) => {
        try {
          const summary = await BackupService.restoreFromBackupFile(file);
          get().clearCart();
          await get().loadInitialData();
          set({
            heldInvoices: [],
            notification: {
              type: "success",
              message: `تمت استعادة النسخة الاحتياطية بنجاح (${summary.productsCount} صنف دوائي، ${summary.invoicesCount} فاتورة).`,
            },
          });
        } catch (err) {
          set({
            notification: {
              type: "error",
              message:
                err instanceof Error
                  ? err.message
                  : "فشل استعادة النسخة الاحتياطية.",
            },
          });
        }
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
