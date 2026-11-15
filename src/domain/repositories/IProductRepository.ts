import { ProductEntity } from "../entities";

export interface IProductRepository {
  /**
   * جلب جميع الأدوية من قاعدة البيانات
   */
  getAllProducts(): Promise<ProductEntity[]>;

  /**
   * البحث عن دواء بواسطة الباركود
   */
  getProductByBarcode(barcode: string): Promise<ProductEntity | null>;

  /**
   * إضافة أو تحديث دواء كامل
   */
  upsertProduct(product: ProductEntity): Promise<void>;

  upsertProductsBulk(products: ProductEntity[]): Promise<void>;
  /**
   * تحديث رصيد الدواء بعد عملية البيع أو الشراء
   */
  updateStock(
    productId: string,
    newPacks: number,
    newLooseStrips: number,
  ): Promise<void>;

  /**
   * تحديث التكلفة المرجحة وسعر البيع والرصيد عند توريد مشتريات مع بونص
   */
  updatePurchaseStockAndPricing(
    productId: string,
    newPacks: number,
    newWeightedCostPrice: number,
    newPackPrice: number,
  ): Promise<void>;

  /**
   * التسعير الجماعي بنسبة مئوية لجميع الأدوية أو فئة معينة
   */
  applyBulkPriceAdjustment(
    percentChange: number,
    categoryFilter?: string,
  ): Promise<ProductEntity[]>;
}
