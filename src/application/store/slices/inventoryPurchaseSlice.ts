import { v4 as uuidv4 } from "uuid";
import {
  ProductEntity,
  CashExpenseEntity,
  PurchaseOrderEntity,
  PurchaseOrderItemEntity,
  PurchaseOrderStatus,
} from "../../../domain/entities";
import { AddPurchaseWithBonusUseCase } from "../../use-cases/AddPurchaseWithBonus";
import { CURRENT_BRANCH_ID } from "../../../infrastructure/db/database";
import {
  PosState,
  PosSlice,
  productRepo,
  batchRepo,
  invoiceRepo,
  purchaseOrderRepo,
} from "../storeTypes";

export type InventoryPurchaseSlice = Pick<
  PosState,
  | "pendingOrderForInvoice"
  | "setPendingOrderForInvoice"
  | "createPurchaseWithBonus"
  | "loadPurchaseOrders"
  | "createPurchaseOrdersBatch"
  | "updatePurchaseOrderItems"
  | "markPurchaseOrderSent"
  | "cancelPurchaseOrder"
  | "deleteDraftPurchaseOrder"
  | "addNewProduct"
  | "importProductsBatch"
  | "applyBulkPricing"
  | "adjustProductStock"
>;

export const createInventoryPurchaseSlice: PosSlice<InventoryPurchaseSlice> = (
  set,
  get,
) => ({
  pendingOrderForInvoice: null,

  setPendingOrderForInvoice: (order) => {
    set({ pendingOrderForInvoice: order });
  },

  createPurchaseWithBonus: async (
    supplierName,
    supplierInvoiceNumber,
    paymentMode,
    lines,
    purchaseOrderId,
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
      purchaseOrderId,
    );

    // في حال تم توريد الفاتورة من أمر شراء (PO)، نحدّث الكميات المستلمة وحالة الأمر تلقائياً
    let linkedOrderStatusNote = "";
    if (purchaseOrderId) {
      const targetOrder =
        await purchaseOrderRepo.getPurchaseOrderById(purchaseOrderId);

      if (targetOrder && targetOrder.status !== "CANCELLED") {
        // احتساب الكميات المشتراة المستلمة لكل صنف (أو البونص فقط في حال سطر بونص خالص)
        const receivedByProduct = new Map<string, number>();
        for (const invItem of savedPurchase.items) {
          const countedPacks =
            invItem.purchasedPacks > 0
              ? invItem.purchasedPacks
              : invItem.bonusPacks;
          receivedByProduct.set(
            invItem.productId,
            (receivedByProduct.get(invItem.productId) || 0) + countedPacks,
          );
        }

        const updatedItems: PurchaseOrderItemEntity[] = targetOrder.items.map(
          (item) => {
            const newlyReceived = receivedByProduct.get(item.productId) || 0;
            return {
              ...item,
              receivedPacks: item.receivedPacks + newlyReceived,
            };
          },
        );

        const totalReceivedPacks = updatedItems.reduce(
          (sum, it) => sum + it.receivedPacks,
          0,
        );
        const isFullyReceived =
          updatedItems.length > 0 &&
          updatedItems.every((it) => it.receivedPacks >= it.orderedPacks);
        const hasAnyReceived = updatedItems.some((it) => it.receivedPacks > 0);

        const nowIso = new Date().toISOString();
        const nextStatus: PurchaseOrderStatus = isFullyReceived
          ? "RECEIVED"
          : hasAnyReceived
            ? "PARTIAL"
            : targetOrder.status;

        const linkedIds = targetOrder.linkedPurchaseInvoiceIds.includes(
          savedPurchase.id,
        )
          ? targetOrder.linkedPurchaseInvoiceIds
          : [...targetOrder.linkedPurchaseInvoiceIds, savedPurchase.id];

        const updatedOrder: PurchaseOrderEntity = {
          ...targetOrder,
          status: nextStatus,
          items: updatedItems,
          totalReceivedPacks,
          linkedPurchaseInvoiceIds: linkedIds,
          completedAt: isFullyReceived ? nowIso : targetOrder.completedAt,
          updatedAt: nowIso,
        };

        await purchaseOrderRepo.upsertPurchaseOrder(updatedOrder);
        linkedOrderStatusNote = isFullyReceived
          ? ` — وتم إغلاق أمر الشراء (${updatedOrder.id}) كمستلم بالكامل.`
          : ` — وتم تحديث أمر الشراء (${updatedOrder.id}) كاستلام جزئي.`;
      }

      if (get().pendingOrderForInvoice?.id === purchaseOrderId) {
        set({ pendingOrderForInvoice: null });
      }
    }

    await get().loadInitialData();
    set({
      notification: {
        type: "success",
        message: `تم توريد فاتورة المشتريات (${savedPurchase.id}) وحساب التكلفة المرجحة مع البونص بنجاح!${linkedOrderStatusNote}`,
      },
    });

    return savedPurchase;
  },

  loadPurchaseOrders: async () => {
    const [purchaseOrders, syncQueue] = await Promise.all([
      purchaseOrderRepo.getAllPurchaseOrders(),
      invoiceRepo.getSyncQueue(),
    ]);
    set({ purchaseOrders, syncQueue });
  },

  createPurchaseOrdersBatch: async (ordersInput) => {
    const validDrafts = ordersInput
      .map((draft) => ({
        ...draft,
        supplierName: draft.supplierName.trim() || "مستودع غير محدد",
        items: draft.items.filter((it) => it.orderedPacks > 0),
      }))
      .filter((draft) => draft.items.length > 0);

    if (validDrafts.length === 0) {
      set({
        notification: {
          type: "warning",
          message: "لا توجد أصناف بكميات مطلوبة صالحة لاعتماد أمر شراء.",
        },
      });
      return [];
    }

    const nowIso = new Date().toISOString();
    const baseStamp = Date.now().toString().slice(-6);
    const currentUser = get().currentUser;
    const createdOrders: PurchaseOrderEntity[] = [];

    for (let idx = 0; idx < validDrafts.length; idx++) {
      const draft = validDrafts[idx];
      const orderItems: PurchaseOrderItemEntity[] = draft.items.map(
        ({ product, orderedPacks }) => {
          const safeQty = Math.max(1, Math.round(orderedPacks));
          const unitCost = Number(product.weightedCostPrice || 0);
          return {
            id: `poi-${uuidv4().slice(0, 8)}`,
            productId: product.id,
            productName: product.name,
            scientificName: product.scientificName,
            barcode: product.barcode,
            orderedPacks: safeQty,
            receivedPacks: 0,
            estimatedUnitCost: unitCost,
            lineEstimatedTotal: Number((safeQty * unitCost).toFixed(2)),
          };
        },
      );

      const totalOrderedPacks = orderItems.reduce(
        (sum, it) => sum + it.orderedPacks,
        0,
      );
      const estimatedTotalAmount = Number(
        orderItems
          .reduce((sum, it) => sum + it.lineEstimatedTotal, 0)
          .toFixed(2),
      );

      const orderId =
        validDrafts.length === 1
          ? `PO-${baseStamp}`
          : `PO-${baseStamp}-${idx + 1}`;

      const newOrder: PurchaseOrderEntity = {
        id: orderId,
        supplierId: draft.supplierId,
        supplierName: draft.supplierName,
        supplierPhone: draft.supplierPhone,
        salesRepName: draft.salesRepName,
        status: "DRAFT",
        items: orderItems,
        totalOrderedPacks,
        totalReceivedPacks: 0,
        estimatedTotalAmount,
        notes: draft.notes?.trim() || undefined,
        linkedPurchaseInvoiceIds: [],
        createdByUserId: currentUser?.id,
        createdByName: currentUser?.name,
        createdAt: nowIso,
        updatedAt: nowIso,
        branchId: CURRENT_BRANCH_ID,
      };

      await purchaseOrderRepo.upsertPurchaseOrder(newOrder);
      createdOrders.push(newOrder);
    }

    await get().loadPurchaseOrders();
    set({
      notification: {
        type: "success",
        message:
          createdOrders.length === 1
            ? `تم اعتماد أمر الشراء (${createdOrders[0].id}) للمستودع (${createdOrders[0].supplierName}) كمسودة بنجاح.`
            : `تم إنشاء (${createdOrders.length}) أوامر شراء مستقلة للمستودعات كمسودات بنجاح.`,
      },
    });

    return createdOrders;
  },

  updatePurchaseOrderItems: async (
    orderId,
    updatedItems,
    notes,
    addedItems = [],
  ) => {
    const existing = get().purchaseOrders.find((o) => o.id === orderId);
    if (!existing) return;

    if (existing.status !== "DRAFT") {
      set({
        notification: {
          type: "warning",
          message: "لا يمكن تعديل بنود أمر الشراء إلا وهو في حالة مسودة.",
        },
      });
      return;
    }

    const qtyByItemId = new Map<string, number>();
    updatedItems.forEach((u) => {
      qtyByItemId.set(u.itemId, Math.max(0, Math.round(u.orderedPacks)));
    });

    const nextItems: PurchaseOrderItemEntity[] = existing.items
      .map((item) => {
        const nextQty = qtyByItemId.has(item.id)
          ? (qtyByItemId.get(item.id) ?? item.orderedPacks)
          : item.orderedPacks;
        return {
          ...item,
          orderedPacks: nextQty,
          lineEstimatedTotal: Number(
            (nextQty * item.estimatedUnitCost).toFixed(2),
          ),
        };
      })
      .filter((item) => item.orderedPacks > 0);

    // إضافة الأصناف الحرة الجديدة إلى المسودة أو دمج كميتها إذا كانت مضافة مسبقاً
    for (const draftItem of addedItems) {
      const safeQty = Math.max(0, Math.round(draftItem.orderedPacks));
      if (safeQty <= 0) continue;

      const existingIdx = nextItems.findIndex(
        (it) => it.productId === draftItem.product.id,
      );
      if (existingIdx !== -1) {
        const mergedQty = nextItems[existingIdx].orderedPacks + safeQty;
        nextItems[existingIdx] = {
          ...nextItems[existingIdx],
          orderedPacks: mergedQty,
          lineEstimatedTotal: Number(
            (mergedQty * nextItems[existingIdx].estimatedUnitCost).toFixed(2),
          ),
        };
      } else {
        const unitCost = Number(draftItem.product.weightedCostPrice || 0);
        nextItems.push({
          id: `poi-${uuidv4().slice(0, 8)}`,
          productId: draftItem.product.id,
          productName: draftItem.product.name,
          scientificName: draftItem.product.scientificName,
          barcode: draftItem.product.barcode,
          orderedPacks: safeQty,
          receivedPacks: 0,
          estimatedUnitCost: unitCost,
          lineEstimatedTotal: Number((safeQty * unitCost).toFixed(2)),
        });
      }
    }

    if (nextItems.length === 0) {
      set({
        notification: {
          type: "error",
          message:
            "يجب أن يحتوي أمر الشراء على صنف واحد على الأقل بكمية أكبر من الصفر.",
        },
      });
      return;
    }

    const updatedOrder: PurchaseOrderEntity = {
      ...existing,
      items: nextItems,
      totalOrderedPacks: nextItems.reduce(
        (sum, it) => sum + it.orderedPacks,
        0,
      ),
      estimatedTotalAmount: Number(
        nextItems
          .reduce((sum, it) => sum + it.lineEstimatedTotal, 0)
          .toFixed(2),
      ),
      notes: notes !== undefined ? notes.trim() || undefined : existing.notes,
      updatedAt: new Date().toISOString(),
    };

    await purchaseOrderRepo.upsertPurchaseOrder(updatedOrder);
    await get().loadPurchaseOrders();
    set({
      notification: {
        type: "success",
        message: `تم حفظ تعديلات أمر الشراء (${updatedOrder.id}) بنجاح (${updatedOrder.items.length} صنف).`,
      },
    });
  },

  markPurchaseOrderSent: async (orderId, channel = "MANUAL") => {
    const existing = get().purchaseOrders.find((o) => o.id === orderId);
    if (!existing) return;

    if (existing.status === "CANCELLED" || existing.status === "RECEIVED") {
      return;
    }

    const nowIso = new Date().toISOString();
    const isResend = existing.status !== "DRAFT";
    // إذا كان الأمر في حالة استلام جزئي نحافظ على حالته ولا نعيده إلى SENT عند إعادة إرسال المتبقي
    const nextStatus: PurchaseOrderStatus =
      existing.status === "DRAFT" ? "SENT" : existing.status;

    const updatedOrder: PurchaseOrderEntity = {
      ...existing,
      status: nextStatus,
      dispatchChannel: channel,
      sentAt: nowIso,
      updatedAt: nowIso,
    };

    await purchaseOrderRepo.upsertPurchaseOrder(updatedOrder);
    await get().loadPurchaseOrders();
    set({
      notification: {
        type: "success",
        message: isResend
          ? `تمت إعادة إرسال أمر الشراء (${updatedOrder.id}) إلى (${updatedOrder.supplierName}).`
          : `تم إرسال أمر الشراء (${updatedOrder.id}) إلى (${updatedOrder.supplierName}) وتحديث حالته إلى مُرسل.`,
      },
    });
  },

  cancelPurchaseOrder: async (orderId) => {
    const existing = get().purchaseOrders.find((o) => o.id === orderId);
    if (!existing) return;

    if (existing.status === "RECEIVED" || existing.status === "CANCELLED") {
      set({
        notification: {
          type: "warning",
          message: "لا يمكن إلغاء أمر شراء مستلم بالكامل أو ملغي مسبقاً.",
        },
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const updatedOrder: PurchaseOrderEntity = {
      ...existing,
      status: "CANCELLED",
      cancelledAt: nowIso,
      updatedAt: nowIso,
    };

    await purchaseOrderRepo.upsertPurchaseOrder(updatedOrder);
    if (get().pendingOrderForInvoice?.id === orderId) {
      set({ pendingOrderForInvoice: null });
    }

    await get().loadPurchaseOrders();
    set({
      notification: {
        type: "info",
        message: `تم إلغاء أمر الشراء (${updatedOrder.id}) وحفظه في الأرشيف.`,
      },
    });
  },

  deleteDraftPurchaseOrder: async (orderId) => {
    const existing = get().purchaseOrders.find((o) => o.id === orderId);
    if (!existing) return;

    if (existing.status !== "DRAFT") {
      set({
        notification: {
          type: "warning",
          message:
            "يمكن حذف المسودات فقط — للأوامر المرسلة استخدم خيار الإلغاء للحفاظ على سجل التدقيق.",
        },
      });
      return;
    }

    await purchaseOrderRepo.deletePurchaseOrder(orderId);
    if (get().pendingOrderForInvoice?.id === orderId) {
      set({ pendingOrderForInvoice: null });
    }

    await get().loadPurchaseOrders();
    set({
      notification: {
        type: "info",
        message: `تم حذف مسودة أمر الشراء (${orderId}).`,
      },
    });
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
    await productRepo.upsertProductsBulk(importedProducts);
    await get().loadInitialData();
    set({
      notification: {
        type: "success",
        message: `تم استيراد وتحديث (${importedProducts.length}) صنف دوائي دفعة واحدة بنجاح!`,
      },
    });
    return importedProducts.length;
  },

  applyBulkPricing: async (percentChange, categoryFilter) => {
    await productRepo.applyBulkPriceAdjustment(percentChange, categoryFilter);
    await get().loadInitialData();
    set({
      notification: {
        type: "success",
        message: `تم تطبيق تعديل الأسعار الجماعي (${
          percentChange > 0 ? `+${percentChange}%` : `${percentChange}%`
        }) بنجاح.`,
      },
    });
  },

  adjustProductStock: async ({
    productId,
    actualPacks,
    actualLooseStrips,
    targetBatchId,
    reason,
    notes,
    recordLossInFinance,
  }) => {
    const product = get().products.find((p) => p.id === productId);
    if (!product) return;

    const stripsPerPack = Math.max(1, product.stripsPerPack);
    const oldTotalStrips =
      product.stockPacks * stripsPerPack + product.stockLooseStrips;
    const newTotalStrips = actualPacks * stripsPerPack + actualLooseStrips;
    const diffStrips = newTotalStrips - oldTotalStrips;
    const diffPacks = actualPacks - product.stockPacks;

    const updatedBatches = product.batches.map((b) => ({ ...b }));

    if (updatedBatches.length === 0 && actualPacks > 0) {
      updatedBatches.push({
        id: `batch-${uuidv4().slice(0, 8)}`,
        productId: product.id,
        batchNumber: "ADJ-BATCH",
        expiryDate: "2028-12-31",
        qtyPacks: actualPacks,
        branchId: CURRENT_BRANCH_ID,
      });
    } else if (diffPacks > 0) {
      // زيادة جردية: تضاف للدفعة المحددة أو الأحدث
      const target =
        updatedBatches.find((b) => b.id === targetBatchId) || updatedBatches[0];
      if (target) {
        target.qtyPacks += diffPacks;
      }
    } else if (diffPacks < 0) {
      // نقص جردي أو إتلاف: يخصم من الدفعة المحددة ثم بالـ FIFO
      let toDeduct = Math.abs(diffPacks);
      if (targetBatchId !== "AUTO_FIFO") {
        const target = updatedBatches.find((b) => b.id === targetBatchId);
        if (target) {
          const taken = Math.min(target.qtyPacks, toDeduct);
          target.qtyPacks -= taken;
          toDeduct -= taken;
        }
      }
      updatedBatches.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
      for (const b of updatedBatches) {
        if (toDeduct <= 0) break;
        const taken = Math.min(b.qtyPacks, toDeduct);
        b.qtyPacks -= taken;
        toDeduct -= taken;
      }
    }

    const updatedProduct: ProductEntity = {
      ...product,
      stockPacks: actualPacks,
      stockLooseStrips: actualLooseStrips,
      batches: updatedBatches,
      updatedAt: new Date().toISOString(),
    };

    await productRepo.upsertProduct(updatedProduct);

    // تقييد الخسارة بالتكلفة المرجحة في قائمة الدخل دون خصمها من النقد الفعلي لدرج الوردية
    if (diffStrips < 0 && recordLossInFinance) {
      const lossAmount = Number(
        (
          Math.abs(diffStrips) *
          (product.weightedCostPrice / stripsPerPack)
        ).toFixed(2),
      );

      const reasonLabels: Record<typeof reason, string> = {
        STOCKTAKING: "فارق جرد فعلي",
        DAMAGED: "تالف وكسر مخزني",
        EXPIRED: "إعدام صلاحية منتهية",
        SHORTAGE: "عجز مخزني",
      };

      if (lossAmount > 0) {
        const lossExpense: CashExpenseEntity = {
          id: `ADJ-${Date.now().toString().slice(-6)}`,
          title: `${reasonLabels[reason]}: ${product.name}`,
          category: "OTHER",
          amount: lossAmount,
          notes:
            notes.trim() ||
            `تسوية مخزنية من (${product.stockPacks}ع/${product.stockLooseStrips}ش) إلى (${actualPacks}ع/${actualLooseStrips}ش)`,
          createdAt: new Date().toISOString(),
          shiftId: "INVENTORY-LOSS",
          branchId: CURRENT_BRANCH_ID,
        };
        await invoiceRepo.saveExpense(lossExpense);
      }
    }

    await get().loadInitialData();

    set({
      notification: {
        type: diffStrips < 0 ? "warning" : "success",
        message: `تمت تسوية جرد (${product.name}) بنجاح — الرصيد الفعلي الجديد: ${actualPacks} علبة و ${actualLooseStrips} شريط.`,
      },
    });
  },
});
