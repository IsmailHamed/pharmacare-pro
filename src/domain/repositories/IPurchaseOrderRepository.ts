import { PurchaseOrderEntity } from "../entities/PurchaseOrder";

export interface IPurchaseOrderRepository {
  getAllPurchaseOrders(): Promise<PurchaseOrderEntity[]>;
  getPurchaseOrderById(id: string): Promise<PurchaseOrderEntity | null>;
  upsertPurchaseOrder(order: PurchaseOrderEntity): Promise<void>;
  deletePurchaseOrder(id: string): Promise<void>;
}
