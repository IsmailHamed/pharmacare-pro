import { CartItemEntity } from "./index";

export interface InvoiceEntity {
  id: string;
  type: "SALE" | "RETURN";
  paymentMode: "CASH" | "CREDIT";
  customerName: string;
  subtotal: number;
  discountPercent: number;
  totalAmount: number;
  totalCostAmount?: number; // إجمالي تكلفة البضاعة المباعة لحساب صافي الربح
  netProfit?: number;
  items: CartItemEntity[];
  createdAt: string;
  shiftId?: string; // رقم الوردية التي صُدرت خلالها الفاتورة
  performedByUserId?: string; // معرّف المستخدم الذي نفّذ الفاتورة
  performedByName?: string; // اسم المستخدم الذي نفّذ الفاتورة
  branchId: string;
}
