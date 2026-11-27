import {
  BatchEntity,
  CartItemEntity,
  ControlledDrugMeta,
  HeldInvoiceEntity,
  InvoiceEntity,
  ProductEntity,
} from "../../domain/entities";

export type CartUnit = "pack" | "strip";
export type CartInvoiceMode = "SALE" | "RETURN";

export interface ProductExpiryInspection {
  allExpired: boolean;
  earliestExpiredBatch: BatchEntity | null;
}

export interface CartQtyDeltaResult {
  updatedCart: CartItemEntity[];
  stockExceeded: boolean;
}

export type CartUnitToggleResult =
  | { status: "NOT_FOUND" }
  | { status: "NOT_SPLITTABLE"; productName: string }
  | {
      status: "INSUFFICIENT_STOCK";
      product: ProductEntity;
      nextUnit: CartUnit;
    }
  | {
      status: "UPDATED";
      updatedCart: CartItemEntity[];
      productName: string;
      nextUnit: CartUnit;
      nextUnitPrice: number;
    };

export type ParsedBarcodeScanResult =
  | { kind: "EMPTY" }
  | { kind: "INVOICE"; code: string }
  | { kind: "PRODUCT"; product: ProductEntity; unit: CartUnit }
  | { kind: "NOT_FOUND"; code: string };

export interface ResumedInvoiceTransition {
  invoiceToResume: HeldInvoiceEntity;
  nextHeldInvoices: HeldInvoiceEntity[];
  swappedLabel: string | null;
  targetIndex: number;
}

export const calculateUnitPrice = (
  product: ProductEntity,
  unit: CartUnit,
): number => {
  if (unit === "pack") return Number(product.packPrice.toFixed(2));
  const strips = Math.max(1, product.stripsPerPack);
  return Number((product.packPrice / strips).toFixed(2));
};

export const generateCartKey = (productId: string, unit: CartUnit): string =>
  `${productId}-${unit}`;

export const generateHeldInvoiceId = (): string =>
  `HLD-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;

export const getTotalAvailableStrips = (product: ProductEntity): number =>
  product.stockPacks * product.stripsPerPack + product.stockLooseStrips;

/**
 * فحص صلاحية التشغيلات النشطة (التي تحتوي رصيداً موجباً) قبل صرف الدواء
 */
export const inspectProductExpiry = (
  product: ProductEntity,
): ProductExpiryInspection => {
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

/**
 * إدراج صنف جديد في أعلى السلة أو زيادة كميته إذا كان موجوداً بنفس الوحدة
 */
export const upsertCartItem = (
  cart: CartItemEntity[],
  product: ProductEntity,
  unit: CartUnit,
  meta?: ControlledDrugMeta,
): CartItemEntity[] => {
  const cartKey = generateCartKey(product.id, unit);
  const existingItem = cart.find((item) => item.cartKey === cartKey);

  if (existingItem) {
    return cart.map((item) =>
      item.cartKey === cartKey
        ? {
            ...item,
            qty: item.qty + 1,
            controlledMeta: meta || item.controlledMeta,
          }
        : item,
    );
  }

  const newItem: CartItemEntity = {
    cartKey,
    product,
    unit,
    qty: 1,
    unitPrice: calculateUnitPrice(product, unit),
    isControlled: product.isControlled,
    controlledMeta: meta,
  };

  return [newItem, ...cart];
};

/**
 * تعديل كمية بند في السلة مع التحقق من سقف الرصيد المتاح في وضع البيع
 */
export const applyCartQtyDelta = (
  cart: CartItemEntity[],
  cartKey: string,
  delta: number,
  invoiceMode: CartInvoiceMode,
): CartQtyDeltaResult => {
  let stockExceeded = false;

  const updatedCart = cart
    .map((item) => {
      if (item.cartKey !== cartKey) return item;

      const newQty = item.qty + delta;
      if (newQty <= 0) return null;

      if (delta > 0 && invoiceMode === "SALE") {
        const maxStrips = getTotalAvailableStrips(item.product);
        const requestedStrips =
          item.unit === "pack" ? newQty * item.product.stripsPerPack : newQty;
        if (requestedStrips > maxStrips) {
          stockExceeded = true;
          return item;
        }
      }

      return { ...item, qty: newQty };
    })
    .filter((item): item is CartItemEntity => item !== null);

  return { updatedCart, stockExceeded };
};

/**
 * تبديل وحدة الصنف بين علبة وشريط فرط مع دمج البنود المتطابقة والتحقق من الرصيد في وضع البيع
 */
export const applyCartUnitToggle = (
  cart: CartItemEntity[],
  cartKey: string,
  invoiceMode: CartInvoiceMode,
): CartUnitToggleResult => {
  const targetItem = cart.find((item) => item.cartKey === cartKey);
  if (!targetItem) return { status: "NOT_FOUND" };

  const stripsPerPack = Math.max(1, targetItem.product.stripsPerPack);
  if (stripsPerPack <= 1) {
    return { status: "NOT_SPLITTABLE", productName: targetItem.product.name };
  }

  const nextUnit: CartUnit = targetItem.unit === "pack" ? "strip" : "pack";
  const nextUnitPrice = calculateUnitPrice(targetItem.product, nextUnit);
  const nextCartKey = generateCartKey(targetItem.product.id, nextUnit);

  if (invoiceMode === "SALE") {
    const maxStrips =
      targetItem.product.stockPacks * stripsPerPack +
      targetItem.product.stockLooseStrips;

    const existingSameTargetUnit = cart.find(
      (item) => item.cartKey === nextCartKey && item.cartKey !== cartKey,
    );
    const mergedQty =
      targetItem.qty +
      (existingSameTargetUnit ? existingSameTargetUnit.qty : 0);

    const neededStrips =
      nextUnit === "pack" ? mergedQty * stripsPerPack : mergedQty;

    if (neededStrips > maxStrips) {
      return {
        status: "INSUFFICIENT_STOCK",
        product: targetItem.product,
        nextUnit,
      };
    }
  }

  const updatedCart: CartItemEntity[] = [];
  for (const item of cart) {
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
            updatedCart[alreadyMergedIdx].controlledMeta || item.controlledMeta,
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

  return {
    status: "UPDATED",
    updatedCart,
    productName: targetItem.product.name,
    nextUnit,
    nextUnitPrice,
  };
};

/**
 * تحليل الباركود الممسوح بالليزر وتمييز فواتير المرتجع (INV-) وملصقات الأشرطة (-S)
 */
export const parseScannedBarcode = (
  rawBarcode: string,
  products: ProductEntity[],
): ParsedBarcodeScanResult => {
  const code = rawBarcode.trim();
  if (!code) return { kind: "EMPTY" };

  if (code.toUpperCase().startsWith("INV-")) {
    return { kind: "INVOICE", code };
  }

  const isStripLabel = code.toUpperCase().endsWith("-S");
  const baseBarcode = isStripLabel ? code.slice(0, -2) : code;

  const matchedProduct = products.find(
    (p) => p.barcode.toLowerCase() === baseBarcode.toLowerCase(),
  );

  if (!matchedProduct) {
    return { kind: "NOT_FOUND", code };
  }

  const unit: CartUnit =
    isStripLabel && matchedProduct.stripsPerPack > 1 ? "strip" : "pack";

  return { kind: "PRODUCT", product: matchedProduct, unit };
};

/**
 * البحث عن فاتورة مبيعات مطابقة للاسترداد بالرقم الكامل أو اللاحقة
 */
export const findSaleInvoiceByQuery = (
  invoices: InvoiceEntity[],
  invoiceQuery: string,
): InvoiceEntity | undefined => {
  const cleanQuery = invoiceQuery.trim().toUpperCase();
  if (!cleanQuery) return undefined;

  return invoices.find(
    (inv) =>
      inv.type === "SALE" &&
      (inv.id.toUpperCase() === cleanQuery ||
        inv.id.toUpperCase().endsWith(cleanQuery)),
  );
};

/**
 * بناء بنود سلة المرتجع مع ربط كل صنف بأحدث بياناته في المخزون والإبقاء على سعر البيع الأصلي
 */
export const buildRestoredReturnItems = (
  targetInvoice: InvoiceEntity,
  currentProducts: ProductEntity[],
): CartItemEntity[] =>
  targetInvoice.items.map((item) => {
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

/**
 * إنشاء كيان فاتورة معلّقة جديدة مع تسمية افتراضية مرقّمة
 */
export const buildHeldInvoiceEntry = (
  cart: CartItemEntity[],
  customerName: string,
  nextTabNumber: number,
  customName?: string,
): HeldInvoiceEntity => ({
  id: generateHeldInvoiceId(),
  customerName:
    customName?.trim() || customerName.trim() || `زبون ${nextTabNumber}`,
  items: [...cart],
  heldAt: new Date().toISOString(),
});

/**
 * حساب انتقال التبديل التلقائي الآمن (Auto-Swap) عند استئناف فاتورة معلّقة
 */
export const computeResumedInvoiceTransition = (
  heldInvoices: HeldInvoiceEntity[],
  invoiceId: string,
  currentCart: CartItemEntity[],
  currentCustomerName: string,
): ResumedInvoiceTransition | null => {
  const targetIndex = heldInvoices.findIndex((inv) => inv.id === invoiceId);
  if (targetIndex === -1) return null;

  const invoiceToResume = heldInvoices[targetIndex];
  let nextHeldInvoices: HeldInvoiceEntity[];
  let swappedLabel: string | null = null;

  if (currentCart.length > 0) {
    const parkedInvoice: HeldInvoiceEntity = {
      id: generateHeldInvoiceId(),
      customerName: currentCustomerName.trim() || `زبون ${targetIndex + 1}`,
      items: [...currentCart],
      heldAt: new Date().toISOString(),
    };
    swappedLabel = parkedInvoice.customerName;
    nextHeldInvoices = heldInvoices.map((inv, idx) =>
      idx === targetIndex ? parkedInvoice : inv,
    );
  } else {
    nextHeldInvoices = heldInvoices.filter((inv) => inv.id !== invoiceId);
  }

  return {
    invoiceToResume,
    nextHeldInvoices,
    swappedLabel,
    targetIndex,
  };
};
