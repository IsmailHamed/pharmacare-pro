import {
  CartItemEntity,
  ControlledDrugLogEntity,
  BatchEntity,
} from "../../domain/entities";
import { InvoiceEntity } from "../../domain/entities/Invoice";
import { IProductRepository } from "../../domain/repositories/IProductRepository";
import { IInvoiceRepository } from "../../domain/repositories/IInvoiceRepository";
import { IBatchRepository } from "../../domain/repositories/IBatchRepository";
import { CalculateFIFOUseCase } from "./CalculateFIFO";
import { CURRENT_BRANCH_ID } from "../../infrastructure/db/database";
import { v4 as uuidv4 } from "uuid";

export class CompleteCheckoutUseCase {
  private fifoCalculator = new CalculateFIFOUseCase();

  constructor(
    private productRepo: IProductRepository,
    private invoiceRepo: IInvoiceRepository,
    private batchRepo?: IBatchRepository,
  ) {}

  /**
   * تنفيذ عملية إتمام البيع أو المرتجع مع تطبيق FIFO صارم وتوثيق الأدوية المراقبة
   */
  async execute(
    cart: CartItemEntity[],
    discountPercent: number,
    customerName: string,
    invoiceType: "SALE" | "RETURN" = "SALE",
    paymentMode: "CASH" | "CREDIT" = "CASH",
  ): Promise<InvoiceEntity> {
    if (cart.length === 0) {
      throw new Error("لا يمكن إتمام العملية، السلة فارغة.");
    }

    // التحقق الصارم من وجود بيانات الوصفة والمريض لأي دواء مراقب
    for (const item of cart) {
      if (invoiceType === "SALE" && item.product.isControlled) {
        const meta = item.controlledMeta;
        if (
          !meta ||
          !meta.patientName.trim() ||
          !meta.nationalId.trim() ||
          !meta.doctorName.trim() ||
          !meta.prescriptionId.trim()
        ) {
          throw new Error(
            `لا يمكن صرف الدواء المراقب (${item.product.name}) دون استكمال بيانات المريض، الرقم الوطني، الطبيب، ورقم الوصفة.`,
          );
        }
      }
    }

    // 1. الحسابات المالية وحساب التكلفة المرجحة وصافي الربح
    const subtotal = Number(
      cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0).toFixed(2),
    );
    const safeDiscount = Math.min(100, Math.max(0, discountPercent));
    const discountAmount = (subtotal * safeDiscount) / 100;
    const totalAmount = Number((subtotal - discountAmount).toFixed(2));

    let totalCostAmount = 0;
    const enrichedItems: CartItemEntity[] = [];
    const invoiceId = `INV-${Date.now()}`;
    const createdAt = new Date().toISOString();

    // 2. معالجة المخزون بنظام التجزئة و FIFO
    for (const item of cart) {
      const product = item.product;
      const stripsPerPack = Math.max(1, product.stripsPerPack);
      const unitCost =
        item.unit === "pack"
          ? product.weightedCostPrice
          : Number((product.weightedCostPrice / stripsPerPack).toFixed(2));

      totalCostAmount = Number(
        (totalCostAmount + unitCost * item.qty).toFixed(2),
      );

      if (invoiceType === "SALE") {
        const fifoResult = this.fifoCalculator.execute(
          product,
          item.unit,
          item.qty,
        );

        await this.productRepo.updateStock(
          product.id,
          fifoResult.newStockPacks,
          fifoResult.newStockLooseStrips,
        );

        if (this.batchRepo) {
          await this.batchRepo.updateBatchesAfterFIFO(
            product.id,
            fifoResult.updatedBatches,
          );
        }

        const primaryBatchNumber =
          fifoResult.allocations[0]?.batchNumber ||
          product.batches[0]?.batchNumber ||
          "BATCH-GENERAL";

        // تسجيل الدواء المراقب في السجل الرسمي للجهات الصحية
        if (product.isControlled && item.controlledMeta) {
          const logEntry: ControlledDrugLogEntity = {
            id: uuidv4(),
            invoiceId,
            productId: product.id,
            productName: product.name,
            scientificName: product.scientificName,
            barcode: product.barcode,
            unit: item.unit,
            qty: item.qty,
            batchNumber: primaryBatchNumber,
            patientName: item.controlledMeta.patientName,
            nationalId: item.controlledMeta.nationalId,
            doctorName: item.controlledMeta.doctorName,
            prescriptionId: item.controlledMeta.prescriptionId,
            dispensedAt: createdAt,
            branchId: CURRENT_BRANCH_ID,
          };
          await this.invoiceRepo.saveControlledDrugLog(logEntry);
        }

        enrichedItems.push({
          ...item,
          fifoAllocations: fifoResult.allocations,
        });
      } else {
        // حالة المرتجع (RETURN): إعادة الكمية للمخزون
        const totalCurrentStrips =
          product.stockPacks * stripsPerPack + product.stockLooseStrips;
        const returnedStrips =
          item.unit === "pack" ? item.qty * stripsPerPack : item.qty;
        const updatedTotalStrips = totalCurrentStrips + returnedStrips;

        const newPacks = Math.floor(updatedTotalStrips / stripsPerPack);
        const newLooseStrips = updatedTotalStrips % stripsPerPack;
        const addedPacks = Math.max(0, newPacks - product.stockPacks);

        await this.productRepo.updateStock(product.id, newPacks, newLooseStrips);

        if (this.batchRepo && addedPacks > 0) {
          const targetBatch: BatchEntity = product.batches[0]
            ? {
                ...product.batches[0],
                qtyPacks: addedPacks,
              }
            : {
                id: uuidv4(),
                productId: product.id,
                batchNumber: "RET-BATCH",
                expiryDate: "2028-12-31",
                qtyPacks: addedPacks,
                branchId: CURRENT_BRANCH_ID,
              };
          await this.batchRepo.saveBatch(product.id, targetBatch);
        }

        enrichedItems.push({ ...item });
      }
    }

    const netProfit = Number(
      (
        (invoiceType === "SALE" ? 1 : -1) *
        (totalAmount - totalCostAmount)
      ).toFixed(2),
    );

    const invoice: InvoiceEntity = {
      id: invoiceId,
      type: invoiceType,
      paymentMode,
      customerName:
        customerName.trim() ||
        (paymentMode === "CREDIT" ? "عميل آجل" : "زبون نقدي"),
      subtotal,
      discountPercent: safeDiscount,
      totalAmount,
      totalCostAmount,
      netProfit,
      items: enrichedItems,
      createdAt,
      branchId: CURRENT_BRANCH_ID,
    };

    await this.invoiceRepo.saveInvoice(invoice);
    return invoice;
  }
}
