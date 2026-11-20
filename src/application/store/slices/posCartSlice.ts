import {
  ProductEntity,
  CartItemEntity,
  HeldInvoiceEntity,
  BatchEntity,
  ControlledDrugMeta,
} from "../../../domain/entities";
import { CompleteCheckoutUseCase } from "../../use-cases/CompleteCheckoutUseCase";
import { ClinicalDecisionUseCase } from "../../use-cases/ClinicalDecisionUseCase";
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

const generateHeldInvoiceId = (): string => {
  return `HLD-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
};

/**
 * فحص صلاحية التشغيلات النشطة (التي تحتوي رصيداً موجباً) قبل صرف الدواء
 */
const inspectProductExpiry = (
  product: ProductEntity,
): { allExpired: boolean; earliestExpiredBatch: BatchEntity | null } => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const activeBatches = (product.batches || [])
    .filter((b) => b.qtyPacks > 0 && Boolean(b.expiryDate))
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  if (activeBatches.length === 0) {
    return { allExpired: false, earliestExpiredBatch: null };
  }

  const validBatches = activeBatches.filter((b) => b.expiryDate >= todayIso);
  const earliest = activeBatches[0];

  return {
    allExpired: validBatches.length === 0,
    earliestExpiredBatch: earliest.expiryDate < todayIso ? earliest : null,
  };
};

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
    const cartKey = generateCartKey(product.id, unit);
    const existingItem = prevState.cart.find(
      (item) => item.cartKey === cartKey,
    );

    let updatedCart: CartItemEntity[];
    if (existingItem) {
      updatedCart = prevState.cart.map((item) =>
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
      updatedCart = [newItem, ...prevState.cart];
    }

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
        const totalAvailableStrips =
          product.stockPacks * product.stripsPerPack + product.stockLooseStrips;
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
      let stockExceeded = false;

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
                stockExceeded = true;
                return item;
              }
            }

            return { ...item, qty: newQty };
          }
          return item;
        })
        .filter((item): item is CartItemEntity => item !== null);

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
      const targetItem = state.cart.find((item) => item.cartKey === cartKey);
      if (!targetItem) return;

      const stripsPerPack = Math.max(1, targetItem.product.stripsPerPack);
      if (stripsPerPack <= 1) {
        SoundFeedbackService.playWarningBuzzer();
        set({
          notification: {
            type: "info",
            message: `الصنف (${targetItem.product.name}) يُباع كعلبة كاملة فقط ولا يحتوي على أشرطة مجزأة.`,
          },
        });
        return;
      }

      const nextUnit: "pack" | "strip" =
        targetItem.unit === "pack" ? "strip" : "pack";
      const nextUnitPrice = calculateUnitPrice(targetItem.product, nextUnit);
      const nextCartKey = generateCartKey(targetItem.product.id, nextUnit);

      // التحقق من توفر الرصيد عند التحويل في وضع البيع
      if (state.invoiceMode === "SALE") {
        const maxStrips =
          targetItem.product.stockPacks * stripsPerPack +
          targetItem.product.stockLooseStrips;

        const existingSameTargetUnit = state.cart.find(
          (item) => item.cartKey === nextCartKey && item.cartKey !== cartKey,
        );
        const mergedQty =
          targetItem.qty +
          (existingSameTargetUnit ? existingSameTargetUnit.qty : 0);

        const neededStrips =
          nextUnit === "pack" ? mergedQty * stripsPerPack : mergedQty;

        if (neededStrips > maxStrips) {
          SoundFeedbackService.playWarningBuzzer();
          set({
            notification: {
              type: "error",
              message: `الرصيد المتاح (${targetItem.product.stockPacks} علبة و ${targetItem.product.stockLooseStrips} شريط) لا يكفي للتحويل إلى (${
                nextUnit === "pack" ? "علبة" : "شريط"
              }).`,
            },
          });
          return;
        }
      }

      const updatedCart: CartItemEntity[] = [];
      for (const item of state.cart) {
        if (item.cartKey === cartKey) {
          const duplicateIdx = updatedCart.findIndex(
            (existing) => existing.cartKey === nextCartKey,
          );
          if (duplicateIdx >= 0) {
            updatedCart[duplicateIdx] = {
              ...updatedCart[duplicateIdx],
              qty: updatedCart[duplicateIdx].qty + item.qty,
              controlledMeta:
                updatedCart[duplicateIdx].controlledMeta || item.controlledMeta,
            };
          } else {
            updatedCart.push({
              ...item,
              cartKey: nextCartKey,
              unit: nextUnit,
              unitPrice: nextUnitPrice,
            });
          }
        } else if (item.cartKey === nextCartKey) {
          const alreadyMergedIdx = updatedCart.findIndex(
            (existing) => existing.cartKey === nextCartKey,
          );
          if (alreadyMergedIdx >= 0) {
            updatedCart[alreadyMergedIdx] = {
              ...updatedCart[alreadyMergedIdx],
              qty: updatedCart[alreadyMergedIdx].qty + item.qty,
              unitPrice: nextUnitPrice,
              controlledMeta:
                updatedCart[alreadyMergedIdx].controlledMeta ||
                item.controlledMeta,
            };
          } else {
            updatedCart.push({
              ...item,
              unitPrice: nextUnitPrice,
            });
          }
        } else {
          updatedCart.push(item);
        }
      }

      set({
        cart: updatedCart,
        interactionAlerts:
          ClinicalDecisionUseCase.detectDrugInteractions(updatedCart),
        notification: {
          type: "info",
          message: `تم تبديل وحدة (${targetItem.product.name}) إلى: ${
            nextUnit === "pack" ? "علبة كاملة" : "شريط فرط"
          } (${nextUnitPrice.toFixed(2)} ر.س)`,
        },
      });

      if (nextUnit === "strip") {
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
      const code = rawBarcode.trim();
      if (!code) return false;

      // إذا كان الباركود الممسوح يعود لفاتورة سابقة (INV-)، يتم تمريره لدالة الاسترداد المحمية بصلاحية المرتجع
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
        const prevCart = get().cart;
        const prevPending = get().pendingControlledItem;
        const prevNotification = get().notification;

        get().requestAddToCart(matchedProduct, unitToAdd);

        const accepted =
          get().cart !== prevCart ||
          get().pendingControlledItem !== prevPending;
        const notificationChanged = get().notification !== prevNotification;

        // لا نُغطّي رسائل الخطأ أو تحذيرات الصلاحية الصادرة من requestAddToCart
        if (accepted && !notificationChanged) {
          set({
            notification: {
              type: "success",
              message: `تم لقط الباركود: ${matchedProduct.name} (${
                unitToAdd === "pack" ? "علبة" : "شريط فرط"
              })`,
            },
          });
        }
        return accepted;
      }

      SoundFeedbackService.playWarningBuzzer();
      set({
        notification: {
          type: "warning",
          message: `لم يتم العثور على صنف مسجل بالباركود (${code})`,
        },
      });
      return false;
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

      const cleanQuery = invoiceQuery.trim().toUpperCase();
      if (!cleanQuery) return false;

      const targetInvoice = get().invoices.find(
        (inv) =>
          inv.type === "SALE" &&
          (inv.id.toUpperCase() === cleanQuery ||
            inv.id.toUpperCase().endsWith(cleanQuery)),
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
      const newHeldInvoice: HeldInvoiceEntity = {
        id: generateHeldInvoiceId(),
        customerName:
          customName?.trim() || customerName.trim() || `زبون ${nextTabNumber}`,
        items: [...cart],
        heldAt: new Date().toISOString(),
      };

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
      const targetIndex = heldInvoices.findIndex((inv) => inv.id === invoiceId);
      if (targetIndex === -1) return;

      const invoiceToResume = heldInvoices[targetIndex];
      const interactionAlerts = ClinicalDecisionUseCase.detectDrugInteractions(
        invoiceToResume.items,
      );

      let nextHeldInvoices: HeldInvoiceEntity[];
      let swappedLabel: string | null = null;

      // التبديل التلقائي الآمن (Auto-Swap): إذا كانت السلة النشطة فيها أصناف، تُعلّق تلقائياً في نفس موضع التبويب
      if (cart.length > 0) {
        const parkedInvoice: HeldInvoiceEntity = {
          id: generateHeldInvoiceId(),
          customerName: customerName.trim() || `زبون ${targetIndex + 1}`,
          items: [...cart],
          heldAt: new Date().toISOString(),
        };
        swappedLabel = parkedInvoice.customerName;
        nextHeldInvoices = heldInvoices.map((inv, idx) =>
          idx === targetIndex ? parkedInvoice : inv,
        );
      } else {
        nextHeldInvoices = heldInvoices.filter((inv) => inv.id !== invoiceId);
      }

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
