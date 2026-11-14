import { v4 as uuidv4 } from "uuid";
import { ProductEntity } from "../../../domain/entities";
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
});
