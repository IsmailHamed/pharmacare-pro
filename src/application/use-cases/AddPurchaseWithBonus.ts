import {
  ProductEntity,
  PurchaseInvoiceEntity,
  PurchaseItemEntity,
  BatchEntity,
} from "../../domain/entities";
import { IProductRepository } from "../../domain/repositories/IProductRepository";
import { IBatchRepository } from "../../domain/repositories/IBatchRepository";
import { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository";
import { CURRENT_BRANCH_ID } from "../../infrastructure/db/database";
import { v4 as uuidv4 } from "uuid";

export interface PurchaseLineInput {
  product: ProductEntity;
  batchNumber: string;
  expiryDate: string;
  purchasedPacks: number;
  bonusPacks: number;
  purchasePricePerPack: number;
  newPackSalePrice: number;
}

export interface WeightedCostCalculation {
  effectiveNewBatchUnitCost: number;
  newWeightedCostPrice: number;
  newTotalStockPacks: number;
  lineTotalCost: number;
  bonusSavedValue: number;
}

export class AddPurchaseWithBonusUseCase {
  constructor(
    private productRepo: IProductRepository,
    private batchRepo: IBatchRepository,
    private invoiceRepo: IInvoiceRepository,
  ) {}

  /**
   * معادلة التكلفة المرجحة الدقيقة (Weighted Average Cost with Bonus)
   * تأخذ في الحسبان الرصيد السابق بتكلفته المرجحة + الكمية المشتراة الجديدة + البونص المجاني
   */
  public static calculateWeightedCost(
    currentStockPacks: number,
    currentWeightedCost: number,
    purchasedPacks: number,
    bonusPacks: number,
    purchasePricePerPack: number,
  ): WeightedCostCalculation {
    const safeCurrentStock = Math.max(0, currentStockPacks);
    const safePurchased = Math.max(0, purchasedPacks);
    const safeBonus = Math.max(0, bonusPacks);
    const incomingTotalPacks = safePurchased + safeBonus;

    const lineTotalCost = Number(
      (safePurchased * purchasePricePerPack).toFixed(2),
    );
    const bonusSavedValue = Number(
      (safeBonus * purchasePricePerPack).toFixed(2),
    );

    const effectiveNewBatchUnitCost =
      incomingTotalPacks > 0
        ? Number((lineTotalCost / incomingTotalPacks).toFixed(2))
        : purchasePricePerPack;

    const previousInventoryValuation = safeCurrentStock * currentWeightedCost;
    const newTotalStockPacks = safeCurrentStock + incomingTotalPacks;

    const newWeightedCostPrice =
      newTotalStockPacks > 0
        ? Number(
            (
              (previousInventoryValuation + lineTotalCost) /
              newTotalStockPacks
            ).toFixed(2),
          )
        : effectiveNewBatchUnitCost;

    return {
      effectiveNewBatchUnitCost,
      newWeightedCostPrice,
      newTotalStockPacks,
      lineTotalCost,
      bonusSavedValue,
    };
  }

  public async execute(
    supplierName: string,
    supplierInvoiceNumber: string,
    paymentMode: "CASH" | "CREDIT",
    lines: PurchaseLineInput[],
  ): Promise<PurchaseInvoiceEntity> {
    if (lines.length === 0) {
      throw new Error("لا يمكن حفظ فاتورة مشتريات فارغة.");
    }

    const purchaseItems: PurchaseItemEntity[] = [];
    let totalAmount = 0;
    let totalBonusValue = 0;

    for (const line of lines) {
      if (line.purchasedPacks <= 0 && line.bonusPacks <= 0) {
        throw new Error(`يجب إدخال كمية مشتراة أو بونص للصنف ${line.product.name}`);
      }
      if (!line.batchNumber.trim()) {
        throw new Error(`يرجى إدخال رقم التشغيلة (Batch Number) للصنف ${line.product.name}`);
      }
      if (!line.expiryDate.trim()) {
        throw new Error(`يرجى تحديد تاريخ الصلاحية للصنف ${line.product.name}`);
      }

      const calc = AddPurchaseWithBonusUseCase.calculateWeightedCost(
        line.product.stockPacks,
        line.product.weightedCostPrice,
        line.purchasedPacks,
        line.bonusPacks,
        line.purchasePricePerPack,
      );

      const totalIncomingPacks = line.purchasedPacks + line.bonusPacks;

      // 1. إضافة أو تحديث الدفعة الجديدة في مستودع الدفعات (FIFO)
      const newBatch: BatchEntity = {
        id: uuidv4(),
        productId: line.product.id,
        batchNumber: line.batchNumber.trim().toUpperCase(),
        expiryDate: line.expiryDate,
        qtyPacks: totalIncomingPacks,
        branchId: CURRENT_BRANCH_ID,
      };
      await this.batchRepo.saveBatch(line.product.id, newBatch);

      // 2. تحديث رصيد الدواء والتكلفة المرجحة وسعر البيع
      await this.productRepo.updatePurchaseStockAndPricing(
        line.product.id,
        calc.newTotalStockPacks,
        calc.newWeightedCostPrice,
        line.newPackSalePrice > 0 ? line.newPackSalePrice : line.product.packPrice,
      );

      totalAmount = Number((totalAmount + calc.lineTotalCost).toFixed(2));
      totalBonusValue = Number(
        (totalBonusValue + calc.bonusSavedValue).toFixed(2),
      );

      purchaseItems.push({
        id: uuidv4(),
        productId: line.product.id,
        productName: line.product.name,
        barcode: line.product.barcode,
        batchNumber: newBatch.batchNumber,
        expiryDate: newBatch.expiryDate,
        purchasedPacks: line.purchasedPacks,
        bonusPacks: line.bonusPacks,
        purchasePricePerPack: line.purchasePricePerPack,
        previousStockPacks: line.product.stockPacks,
        previousWeightedCost: line.product.weightedCostPrice,
        newWeightedCost: calc.newWeightedCostPrice,
        newPackSalePrice:
          line.newPackSalePrice > 0
            ? line.newPackSalePrice
            : line.product.packPrice,
        lineTotal: calc.lineTotalCost,
      });
    }

    const purchaseInvoice: PurchaseInvoiceEntity = {
      id: `PUR-${Date.now()}`,
      supplierName: supplierName.trim() || "مستودع الأدوية المركزي",
      supplierInvoiceNumber:
        supplierInvoiceNumber.trim() || `SUP-${Date.now().toString().slice(-5)}`,
      paymentMode,
      totalAmount,
      totalBonusValue,
      items: purchaseItems,
      createdAt: new Date().toISOString(),
      branchId: CURRENT_BRANCH_ID,
    };

    await this.invoiceRepo.savePurchaseInvoice(purchaseInvoice);
    return purchaseInvoice;
  }
}
