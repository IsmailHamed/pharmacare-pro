import {
  BatchEntity,
  ControlledDrugMeta,
  ProductEntity,
} from "../../../domain/entities";
import { CompleteCheckoutUseCase } from "../../use-cases/CompleteCheckoutUseCase";
import { ClinicalDecisionUseCase } from "../../use-cases/ClinicalDecisionUseCase";
import {
  applyCartQtyDelta,
  applyCartUnitToggle,
  buildHeldInvoiceEntry,
  buildRestoredReturnItems,
  computeResumedInvoiceTransition,
  findSaleInvoiceByQuery,
  getTotalAvailableStrips,
  inspectProductExpiry,
  parseScannedBarcode,
  upsertCartItem,
} from "../../helpers/posCartHelpers";
import { printThermalReceipt } from "../../../infrastructure/tauri/printer";
import { SoundFeedbackService } from "../../../infrastructure/audio/SoundFeedbackService";
import {
  PosState,
  PosSlice,
  productRepo,
  invoiceRepo,
  batchRepo,
} from "../storeTypes";

export type PosCartSlice = Pick<
  PosState,
  | "cart"
  | "heldInvoices"
  | "interactionAlerts"
  | "invoiceMode"
  | "returnSourceInvoiceId"
  | "paymentMode"
  | "discountPercent"
  | "customerName"
  | "selectedProductForAlternatives"
  | "pendingControlledItem"
  | "lastPrintedInvoice"
  | "setInvoiceMode"
  | "toggleReturnMode"
  | "setPaymentMode"
  | "setDiscountPercent"
  | "setCustomerName"
  | "setSelectedProductForAlternatives"
  | "setPendingControlledItem"
  | "setLastPrintedInvoice"
  | "requestAddToCart"
  | "addToCart"
  | "updateCartQty"
  | "toggleCartItemUnit"
  | "removeFromCart"
  | "clearCart"
  | "handleBarcodeScan"
  | "loadInvoiceForReturn"
  | "holdCurrentInvoice"
  | "resumeInvoice"
  | "completeCheckout"
>;

export const createPosCartSlice: PosSlice<PosCartSlice> = (set, get) => {
  /**
   * دالة داخلية موحدة لإدراج صنف بالسلة وإطلاق النغمة الصوتية المناسبة دون تداخل
   */
  const insertCartItem = (
    product: ProductEntity,
    unit: "pack" | "strip",
    meta?: ControlledDrugMeta,
    forceWarningSound = false,
  ): void => {
    const prevState = get();
    const updatedCart = upsertCartItem(prevState.cart, product, unit, meta);

    const interactionAlerts =
      ClinicalDecisionUseCase.detectDrugInteractions(updatedCart);
    const hasNewInteraction =
      interactionAlerts.length > prevState.interactionAlerts.length;

    set({
      cart: updatedCart,
      interactionAlerts,
      pendingControlledItem: null,
    });

    if (forceWarningSound || hasNewInteraction) {
      SoundFeedbackService.playWarningBuzzer();
    } else if (unit === "strip") {
      SoundFeedbackService.playStripAdd();
    } else {
      SoundFeedbackService.playPackAdd();
    }
  };

  return {
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

    setInvoiceMode: (invoiceMode) => {
      // منع التحويل إلى وضع المرتجع إذا لم يمتلك المستخدم الحالي صلاحية إجراء المرتجعات
      if (
        invoiceMode === "RETURN" &&
        !get().currentUser?.permissions.canProcessReturn
      ) {
        SoundFeedbackService.playWarningBuzzer();
        set({
          notification: {
            type: "error",
            message:
              "عذراً، حسابك الحالي لا يمتلك صلاحية إجراء مرتجعات المبيعات!",
          },
        });
        return;
      }

      set({
        invoiceMode,
        returnSourceInvoiceId:
          invoiceMode === "SALE" ? null : get().returnSourceInvoiceId,
      });
    },

    toggleReturnMode: () => {
      const nextMode = get().invoiceMode === "SALE" ? "RETURN" : "SALE";

      // التحقق من صلاحية المرتجع قبل السماح بالتبديل من البيع إلى المرتجع (زر الواجهة أو اختصار F6)
      if (
        nextMode === "RETURN" &&
        !get().currentUser?.permissions.canProcessReturn
      ) {
        SoundFeedbackService.playWarningBuzzer();
        set({
          notification: {
            type: "error",
            message:
              "عذراً، لا تملك صلاحية تفعيل وضع مرتجع المبيعات (يتطلب صلاحية صيدلي أو مدير).",
          },
        });
        return;
      }

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
    setLastPrintedInvoice: (lastPrintedInvoice) => set({ lastPrintedInvoice }),

    requestAddToCart: (product, unit) => {
      const { invoiceMode } = get();
      let expiredWarningBatch: BatchEntity | null = null;

      // التحقق من توفر الرصيد وصلاحية التشغيلات قبل الإضافة في حالة البيع
      if (invoiceMode === "SALE") {
        const totalAvailableStrips = getTotalAvailableStrips(product);
        const neededStrips = unit === "pack" ? product.stripsPerPack : 1;

        if (totalAvailableStrips < neededStrips) {
          SoundFeedbackService.playWarningBuzzer();
          set({
            notification: {
              type: "error",
              message: `عفواً، رصيد (${product.name}) غير كافٍ! المتاح: ${product.stockPacks} علبة و ${product.stockLooseStrips} شريط.`,
            },
          });
          return;
        }

        // فحص الصلاحية المنتهية وإطلاق نغمة التحذير (Buzzer)
        const expiryStatus = inspectProductExpiry(product);
        if (expiryStatus.allExpired && expiryStatus.earliestExpiredBatch) {
          SoundFeedbackService.playWarningBuzzer();
          set({
            notification: {
              type: "error",
              message: `⛔ تحذير صلاحية: جميع تشغيلات (${product.name}) منتهية الصلاحية (تشغيلة ${expiryStatus.earliestExpiredBatch.batchNumber} — انتهت في ${expiryStatus.earliestExpiredBatch.expiryDate})!`,
            },
          });
          return;
        }

        if (expiryStatus.earliestExpiredBatch) {
          expiredWarningBatch = expiryStatus.earliestExpiredBatch;
        }

        // إذا كان الدواء مراقباً، يجب فتح نافذة توثيق الوصفة الطبية إجبارياً
        if (product.isControlled) {
          set({ pendingControlledItem: { product, unit } });
          return;
        }
      }

      insertCartItem(product, unit, undefined, Boolean(expiredWarningBatch));

      if (expiredWarningBatch) {
        set({
          notification: {
            type: "warning",
            message: `⚠️ تنبيه: التشغيلة الأقدم من (${product.name}) رقم (${expiredWarningBatch.batchNumber}) منتهية الصلاحية (${expiredWarningBatch.expiryDate}) — اسحب من التشغيلة الصالحة فقط.`,
          },
        });
      }
    },

    addToCart: (product, unit, meta) => {
      insertCartItem(product, unit, meta, false);
    },

    updateCartQty: (cartKey, delta) => {
      const state = get();
      const { updatedCart, stockExceeded } = applyCartQtyDelta(
        state.cart,
        cartKey,
        delta,
        state.invoiceMode,
      );

      if (stockExceeded) {
        SoundFeedbackService.playWarningBuzzer();
        set({
          notification: {
            type: "warning",
            message: "تم الوصول للحد الأقصى من الرصيد المتاح لهذا الصنف.",
          },
        });
        return;
      }

      set({
        cart: updatedCart,
        interactionAlerts:
          ClinicalDecisionUseCase.detectDrugInteractions(updatedCart),
      });
    },

    toggleCartItemUnit: (cartKey) => {
      const state = get();
      const result = applyCartUnitToggle(
        state.cart,
        cartKey,
        state.invoiceMode,
      );

      if (result.status === "NOT_FOUND") return;

      if (result.status === "NOT_SPLITTABLE") {
        SoundFeedbackService.playWarningBuzzer();
        set({
          notification: {
            type: "info",
            message: `الصنف (${result.productName}) يُباع كعلبة كاملة فقط ولا يحتوي على أشرطة مجزأة.`,
          },
        });
        return;
      }

      if (result.status === "INSUFFICIENT_STOCK") {
        SoundFeedbackService.playWarningBuzzer();
        set({
          notification: {
            type: "error",
            message: `الرصيد المتاح (${result.product.stockPacks} علبة و ${result.product.stockLooseStrips} شريط) لا يكفي للتحويل إلى (${
              result.nextUnit === "pack" ? "علبة" : "شريط"
            }).`,
          },
        });
        return;
      }

      set({
        cart: result.updatedCart,
        interactionAlerts: ClinicalDecisionUseCase.detectDrugInteractions(
          result.updatedCart,
        ),
        notification: {
          type: "info",
          message: `تم تبديل وحدة (${result.productName}) إلى: ${
            result.nextUnit === "pack" ? "علبة كاملة" : "شريط فرط"
          } (${result.nextUnitPrice.toFixed(2)} ر.س)`,
        },
      });

      if (result.nextUnit === "strip") {
        SoundFeedbackService.playStripAdd();
      } else {
        SoundFeedbackService.playPackAdd();
      }
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

    handleBarcodeScan: (rawBarcode) => {
      const parsed = parseScannedBarcode(rawBarcode, get().products);

      if (parsed.kind === "EMPTY") return false;

      // إذا كان الباركود الممسوح يعود لفاتورة سابقة (INV-)، يتم تمريره لدالة الاسترداد المحمية بصلاحية المرتجع
      if (parsed.kind === "INVOICE") {
        return get().loadInvoiceForReturn(parsed.code);
      }

      if (parsed.kind === "NOT_FOUND") {
        SoundFeedbackService.playWarningBuzzer();
        set({
          notification: {
            type: "warning",
            message: `لم يتم العثور على صنف مسجل بالباركود (${parsed.code})`,
          },
        });
        return false;
      }

      const prevCart = get().cart;
      const prevPending = get().pendingControlledItem;
      const prevNotification = get().notification;

      get().requestAddToCart(parsed.product, parsed.unit);

      const accepted =
        get().cart !== prevCart || get().pendingControlledItem !== prevPending;
      const notificationChanged = get().notification !== prevNotification;

      // لا نُغطّي رسائل الخطأ أو تحذيرات الصلاحية الصادرة من requestAddToCart
      if (accepted && !notificationChanged) {
        set({
          notification: {
            type: "success",
            message: `تم لقط الباركود: ${parsed.product.name} (${
              parsed.unit === "pack" ? "علبة" : "شريط فرط"
            })`,
          },
        });
      }
      return accepted;
    },

    loadInvoiceForReturn: (invoiceQuery) => {
      // التحقق من صلاحية المرتجع قبل السماح باسترداد أي فاتورة بالرقم أو الباركود
      if (!get().currentUser?.permissions.canProcessReturn) {
        SoundFeedbackService.playWarningBuzzer();
        set({
          notification: {
            type: "error",
            message:
              "عذراً، لا تملك صلاحية استرداد الفواتير وإجراء مرتجعات المبيعات!",
          },
        });
        return false;
      }

      if (!invoiceQuery.trim()) return false;

      const targetInvoice = findSaleInvoiceByQuery(
        get().invoices,
        invoiceQuery,
      );

      if (!targetInvoice) {
        SoundFeedbackService.playWarningBuzzer();
        set({
          notification: {
            type: "error",
            message: `لم يتم العثور على فاتورة مبيعات بالرقم (${invoiceQuery}).`,
          },
        });
        return false;
      }

      const restoredItems = buildRestoredReturnItems(
        targetInvoice,
        get().products,
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
      SoundFeedbackService.playPackAdd();
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

      // الحفاظ على ترتيب التبويبات المرقّمة (زبون 1، زبون 2...) بإضافة التبويب الجديد في النهاية
      const nextTabNumber = heldInvoices.length + 1;
      const newHeldInvoice = buildHeldInvoiceEntry(
        cart,
        customerName,
        nextTabNumber,
        customName,
      );

      set((state) => ({
        heldInvoices: [...state.heldInvoices, newHeldInvoice],
        notification: {
          type: "info",
          message: `تم تعليق فاتورة (${newHeldInvoice.customerName}) في التبويب [Alt+${nextTabNumber}] — يمكنك خدمة زبون جديد الآن.`,
        },
      }));

      clearCart();
    },

    resumeInvoice: (invoiceId) => {
      const { heldInvoices, cart, customerName } = get();
      const transition = computeResumedInvoiceTransition(
        heldInvoices,
        invoiceId,
        cart,
        customerName,
      );
      if (!transition) return;

      const { invoiceToResume, nextHeldInvoices, swappedLabel, targetIndex } =
        transition;
      const interactionAlerts = ClinicalDecisionUseCase.detectDrugInteractions(
        invoiceToResume.items,
      );

      set({
        cart: invoiceToResume.items,
        customerName: invoiceToResume.customerName,
        invoiceMode: "SALE",
        returnSourceInvoiceId: null,
        discountPercent: 0,
        interactionAlerts,
        heldInvoices: nextHeldInvoices,
        notification: {
          type: "success",
          message: swappedLabel
            ? `تم التبديل إلى (${invoiceToResume.customerName}) وتعليق (${swappedLabel}) تلقائياً في [Alt+${targetIndex + 1}].`
            : `تم استئناف فاتورة (${invoiceToResume.customerName}).`,
        },
      });
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
        currentUser,
        shifts,
      } = get();

      // قفل محاسبي: منع إتمام أي فاتورة بيع أو مرتجع والوردية مغلقة
      const openShift = shifts.find((s) => s.status === "OPEN");
      if (!openShift) {
        SoundFeedbackService.playWarningBuzzer();
        set({
          notification: {
            type: "error",
            message:
              "لا يمكن إتمام البيع أو المرتجع والوردية مغلقة! يرجى فتح وردية أولاً لاستلام العهدة.",
          },
        });
        return null;
      }

      // طبقة حماية أخيرة: منع إتمام المرتجع إذا تم تبديل المستخدم لحساب لا يملك الصلاحية قبل الضغط على F1
      if (
        invoiceMode === "RETURN" &&
        !currentUser?.permissions.canProcessReturn
      ) {
        SoundFeedbackService.playWarningBuzzer();
        set({
          notification: {
            type: "error",
            message:
              "لا يمكن اعتماد فاتورة المرتجع: المستخدم الحالي لا يمتلك صلاحية المرتجعات!",
          },
        });
        return null;
      }

      if (cart.length === 0) {
        SoundFeedbackService.playWarningBuzzer();
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
          {
            shiftId: openShift.id,
            performedByUserId: currentUser?.id,
            performedByName: currentUser?.name,
          },
        );

        await printThermalReceipt(savedInvoice);
        SoundFeedbackService.playCheckoutSuccess();
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
        SoundFeedbackService.playWarningBuzzer();
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
  };
};
