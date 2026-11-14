import { BatchEntity } from "../entities";

export interface IBatchRepository {
  /**
   * جلب جميع دفعات دواء معين مرتبة تصاعدياً حسب تاريخ الصلاحية (FIFO)
   */
  getBatchesByProductId(productId: string): Promise<BatchEntity[]>;

  /**
   * إضافة أو تحديث دفعة دواء
   */
  saveBatch(productId: string, batch: BatchEntity): Promise<void>;

  /**
   * تحديث أرصدة الدفعات بعد خصم FIFO
   */
  updateBatchesAfterFIFO(
    productId: string,
    updatedBatches: BatchEntity[],
  ): Promise<void>;
}
