/**
 * كيان عنصر طابور المزامنة السحابية (Offline-First Sync Queue Record)
 */
export interface SyncQueueItemEntity {
  id: string; // UUID v4
  entityType:
    | "PRODUCT"
    | "BATCH"
    | "INVOICE"
    | "PURCHASE"
    | "CONTROLLED_LOG"
    | "EXPENSE"
    | "SHIFT"
    | "BULK_PRICING"
    | "LEDGER_PAYMENT"
    | "USER"
    | "SUPPLIER";
  operation: "INSERT" | "UPDATE" | "DELETE";
  recordId: string;
  payload: string; // JSON serialized
  branchId: string;
  status: "PENDING" | "SYNCED" | "FAILED";
  createdAt: string;
  syncedAt?: string;
}
export interface PharmacySettingsEntity {
  pharmacyName: string;
  phone: string;
  address: string;
  taxNumber: string;
  receiptFooter: string;
  thermalPrinterName: string;
  cloudSyncUrl: string;
  scannerMaxIntervalMs: number;
}
