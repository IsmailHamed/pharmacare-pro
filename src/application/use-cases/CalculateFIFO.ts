import {
  BatchEntity,
  BatchAllocationEntity,
  ProductEntity,
} from "../../domain/entities";

export interface FIFODeductionResult {
  newStockPacks: number;
  newStockLooseStrips: number;
  packsDeductedFromBatches: number;
  updatedBatches: BatchEntity[];
  allocations: BatchAllocationEntity[];
}

export class CalculateFIFOUseCase {
  /**
   * حساب خصم المخزون وتوزيع الدفعات بنظام الوارد أولاً يصرف أولاً (FIFO)
   * يدعم البيع بالعلبة وبالشريط مع فتح علبة تلقائياً من أقدم دفعة عند الحاجة.
   */
  public execute(
    product: ProductEntity,
    unit: "pack" | "strip",
    qty: number,
  ): FIFODeductionResult {
    const stripsPerPack = Math.max(1, product.stripsPerPack);
    const totalAvailableStrips =
      product.stockPacks * stripsPerPack + product.stockLooseStrips;

    const requestedStrips = unit === "pack" ? qty * stripsPerPack : qty;

    if (requestedStrips > totalAvailableStrips) {
      throw new Error(
        `الرصيد غير كافٍ للصنف (${product.name}). المتوفر: ${product.stockPacks} علبة و ${product.stockLooseStrips} شريط.`,
      );
    }

    const remainingTotalStrips = Math.max(
      0,
      totalAvailableStrips - requestedStrips,
    );
    const newStockPacks = Math.floor(remainingTotalStrips / stripsPerPack);
    const newStockLooseStrips = remainingTotalStrips % stripsPerPack;

    // عدد العلب الكاملة التي يجب خصمها من الدفعات (بما فيها العلبة التي فُتحت للبيع بالشريط)
    const packsDeductedFromBatches = Math.max(
      0,
      product.stockPacks - newStockPacks,
    );

    // ترتيب الدفعات تصاعدياً حسب تاريخ الصلاحية (الأقرب انتهاءً أولاً - FIFO)
    const sortedBatches: BatchEntity[] = [...product.batches]
      .map((b) => ({ ...b }))
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

    let remainingPacksToDeduct = packsDeductedFromBatches;
    const allocations: BatchAllocationEntity[] = [];

    for (const batch of sortedBatches) {
      if (remainingPacksToDeduct <= 0) break;
      if (batch.qtyPacks <= 0) continue;

      const deduct = Math.min(batch.qtyPacks, remainingPacksToDeduct);
      batch.qtyPacks -= deduct;
      remainingPacksToDeduct -= deduct;

      allocations.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        deductedPacks: deduct,
        remainingPacks: batch.qtyPacks,
      });
    }

    return {
      newStockPacks,
      newStockLooseStrips,
      packsDeductedFromBatches,
      updatedBatches: sortedBatches.filter((b) => b.qtyPacks > 0),
      allocations,
    };
  }
}
