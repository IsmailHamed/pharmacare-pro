/**
 * كيان بند فاتورة المشتريات مع البونص (Purchase Item with Bonus)
 */
export interface PurchaseItemEntity {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  batchNumber: string;
  expiryDate: string;
  purchasedPacks: number;
  bonusPacks: number; // كمية البونص المجانية
  purchasePricePerPack: number; // سعر شراء العلبة الواحدة قبل البونص
  previousStockPacks: number;
  previousWeightedCost: number;
  newWeightedCost: number; // التكلفة المرجحة الجديدة للعلبة بعد البونص
  newPackSalePrice: number;
  lineTotal: number;
}

/**
 * كيان فاتورة المشتريات (Purchase Invoice)
 */
export interface PurchaseInvoiceEntity {
  id: string;
  supplierName: string;
  supplierInvoiceNumber: string;
  paymentMode: "CASH" | "CREDIT";
  totalAmount: number;
  totalBonusValue: number;
  items: PurchaseItemEntity[];
  createdAt: string;
  branchId: string;
}
