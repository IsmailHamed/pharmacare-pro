import { v4 as uuidv4 } from "uuid";
import { ProductEntity, CashExpenseEntity } from "../../../domain/entities";
import { AddPurchaseWithBonusUseCase } from "../../use-cases/AddPurchaseWithBonus";
import { CURRENT_BRANCH_ID } from "../../../infrastructure/db/database";
import {
  PosState,
  PosSlice,
  productRepo,
  batchRepo,
  invoiceRepo,
} from "../storeTypes";

export type InventoryPurchaseSlice = Pick<
  PosState,
  | "createPurchaseWithBonus"
  | "addNewProduct"
  | "importProductsBatch"
  | "applyBulkPricing"
  | "adjustProductStock"
>;

export const createInventoryPurchaseSlice: PosSlice<InventoryPurchaseSlice> = (
  set,
  get,
) => ({
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
