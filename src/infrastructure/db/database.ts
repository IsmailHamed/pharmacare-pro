import {
  ProductEntity,
  PurchaseInvoiceEntity,
  ControlledDrugLogEntity,
  CashExpenseEntity,
  ShiftSummaryEntity,
  SyncQueueItemEntity,
  LedgerPaymentEntity,
  InvoiceEntity,
  UserEntity,
  SupplierEntity,
} from "../../domain/entities";
import {
  INITIAL_SEED_PRODUCTS,
  DEFAULT_ADMIN_USER,
  CURRENT_BRANCH_ID,
} from "./seedData";
import { v4 as uuidv4 } from "uuid";

const STORAGE_KEY = "PHARMACARE_SQLITE_WAL_STORAGE_V2";
export { CURRENT_BRANCH_ID, INITIAL_SEED_PRODUCTS };
export interface LocalDatabaseSnapshot {
  walMode: boolean;
  journalMode: "WAL";
  synchronous: "NORMAL";
  branchId: string;
  products: ProductEntity[];
  invoices: InvoiceEntity[];
  purchaseInvoices: PurchaseInvoiceEntity[];
  controlledLogs: ControlledDrugLogEntity[];
  expenses: CashExpenseEntity[];
  shifts: ShiftSummaryEntity[];
  syncQueue: SyncQueueItemEntity[];
  ledgerPayments: LedgerPaymentEntity[];
  users: UserEntity[];
  suppliers: SupplierEntity[];
}

const createDefaultDatabase = (): LocalDatabaseSnapshot => {
  const nowIso = new Date().toISOString();
  return {
    walMode: true,
    journalMode: "WAL",
    synchronous: "NORMAL",
    branchId: CURRENT_BRANCH_ID,
    products: INITIAL_SEED_PRODUCTS,
    invoices: [],
    purchaseInvoices: [],
    controlledLogs: [],
    expenses: [],
    shifts: [
      {
        id: "SHIFT-001",
        pharmacistName: "د. عمر الصيدلي",
        openedAt: nowIso,
        status: "OPEN",
        openingBalance: 500,
        cashSalesTotal: 0,
        creditSalesTotal: 0,
        returnsTotal: 0,
        creditReturnsTotal: 0,
        debtCollectionsTotal: 0,
        supplierPaymentsTotal: 0,
        cashPurchasesTotal: 0,
        pettyCashTotal: 0,
        expectedDrawerCash: 500,
        branchId: CURRENT_BRANCH_ID,
      },
    ],
    syncQueue: [],
    ledgerPayments: [],
    users: [DEFAULT_ADMIN_USER],
    suppliers: [],
  };
};

class LocalSQLiteEngine {
  private state: LocalDatabaseSnapshot;

  constructor() {
    this.state = this.loadFromStorage();
  }

  private loadFromStorage(): LocalDatabaseSnapshot {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<LocalDatabaseSnapshot>;
          if (
            parsed &&
            Array.isArray(parsed.products) &&
            parsed.products.length > 0
          ) {
            const fallback = createDefaultDatabase();
            return {
              ...fallback,
              ...parsed,
              invoices: parsed.invoices || [],
              purchaseInvoices: parsed.purchaseInvoices || [],
              controlledLogs: parsed.controlledLogs || [],
              expenses: parsed.expenses || [],
              shifts:
                parsed.shifts && parsed.shifts.length > 0
                  ? parsed.shifts
                  : fallback.shifts,
              syncQueue: parsed.syncQueue || [],
              ledgerPayments: parsed.ledgerPayments || [],
              suppliers: Array.isArray(parsed.suppliers)
                ? parsed.suppliers
                : [],
            };
          }
        }
      }
    } catch (err) {
      console.warn("SQLite WAL Storage Fallback:", err);
    }
    const fresh = createDefaultDatabase();
    this.persistToStorage(fresh);
    return fresh;
  }

  private persistToStorage(snapshot: LocalDatabaseSnapshot = this.state): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      }
    } catch (err) {
      console.error("Failed to commit WAL transaction:", err);
    }
  }

  public getSnapshot(): LocalDatabaseSnapshot {
    return this.state;
  }

  public commit(mutator: (draft: LocalDatabaseSnapshot) => void): void {
    mutator(this.state);
    this.persistToStorage(this.state);
  }

  public enqueueSync(
    entityType: SyncQueueItemEntity["entityType"],
    operation: SyncQueueItemEntity["operation"],
    recordId: string,
    payloadObj: unknown,
  ): SyncQueueItemEntity {
    const item: SyncQueueItemEntity = {
      id: uuidv4(),
      entityType,
      operation,
      recordId,
      payload: JSON.stringify(payloadObj),
      branchId: CURRENT_BRANCH_ID,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };
    this.state.syncQueue.unshift(item);
    this.persistToStorage(this.state);
    return item;
  }

  public resetToFactory(): LocalDatabaseSnapshot {
    this.state = createDefaultDatabase();
    this.persistToStorage(this.state);
    return this.state;
  }
}

export const sqliteEngine = new LocalSQLiteEngine();
