import {
  ProductEntity,
  CartItemEntity,
  HeldInvoiceEntity,
} from "../../../domain/entities";
import { CompleteCheckoutUseCase } from "../../use-cases/CompleteCheckoutUseCase";
import { ClinicalDecisionUseCase } from "../../use-cases/ClinicalDecisionUseCase";
import { printThermalReceipt } from "../../../infrastructure/tauri/printer";
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

export const createPosCartSlice: PosSlice<PosCartSlice> = (set, get) => ({
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
    const { invoiceMode, addToCart } = get();

    // التحقق من توفر الرصيد قبل الإضافة في حالة البيع
    if (invoiceMode === "SALE") {
      const totalAvailableStrips =
        product.stockPacks * product.stripsPerPack + product.stockLooseStrips;
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
      const existingItem = state.cart.find((item) => item.cartKey === cartKey);

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
      const updatedCart = state.cart.filter((item) => item.cartKey !== cartKey);
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

  loadInvoiceForReturn: (invoiceQuery) => {
    // التحقق من صلاحية المرتجع قبل السماح باسترداد أي فاتورة بالرقم أو الباركود
    if (!get().currentUser?.permissions.canProcessReturn) {
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
      set({
        notification: {
          type: "error",
          message: `لم يتم العثور على فاتورة مبيعات بالرقم (${invoiceQuery}).`,
        },
      });
      return false;
    }

    const currentProducts = get().products;
    const restoredItems: CartItemEntity[] = targetInvoice.items.map((item) => {
      const latestProduct =
        currentProducts.find((p) => p.id === item.product.id) || item.product;
      return {
        cartKey: generateCartKey(latestProduct.id, item.unit),
        product: latestProduct,
        unit: item.unit,
        qty: item.qty,
        unitPrice: item.unitPrice,
        isControlled: latestProduct.isControlled,
        controlledMeta: item.controlledMeta,
      };
    });

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
    const invoiceToResume = heldInvoices.find((inv) => inv.id === invoiceId);
    if (!invoiceToResume) return;

    const interactionAlerts = ClinicalDecisionUseCase.detectDrugInteractions(
      invoiceToResume.items,
    );

    set((state) => ({
      cart: invoiceToResume.items,
      customerName: invoiceToResume.customerName,
      interactionAlerts,
      heldInvoices: state.heldInvoices.filter((inv) => inv.id !== invoiceId),
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
      currentUser,
    } = get();

    // طبقة حماية أخيرة: منع إتمام المرتجع إذا تم تبديل المستخدم لحساب لا يملك الصلاحية قبل الضغط على F1
    if (
      invoiceMode === "RETURN" &&
      !currentUser?.permissions.canProcessReturn
    ) {
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
});
