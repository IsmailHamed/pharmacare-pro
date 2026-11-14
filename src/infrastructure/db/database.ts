import {
  ProductEntity,
  PurchaseInvoiceEntity,
  ControlledDrugLogEntity,
  CashExpenseEntity,
  ShiftSummaryEntity,
  SyncQueueItemEntity,
  LedgerPaymentEntity,
} from "../../domain/entities";
import { InvoiceEntity } from "../../domain/entities/Invoice";
import { v4 as uuidv4 } from "uuid";

const STORAGE_KEY = "PHARMACARE_SQLITE_WAL_STORAGE_V2";
export const CURRENT_BRANCH_ID = "MAIN_BRANCH";

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
}

/**
 * البيانات الدوائية الأولية للصيدلية (Seed Data)
 * تشمل أدوية حقيقية شائعة، بدائل علمية، أدوية مراقبة، وتداخلات دوائية معروفة
 */
export const INITIAL_SEED_PRODUCTS: ProductEntity[] = [
  {
    id: "prod-augmentin-1g",
    barcode: "6281000010111",
    name: "أوجمنتين 1 جم (Augmentin 1g)",
    scientificName: "Amoxicillin + Clavulanic Acid",
    category: "مضادات حيوية",
    packPrice: 89.5,
    weightedCostPrice: 68.0,
    stripsPerPack: 2,
    stockPacks: 24,
    stockLooseStrips: 1,
    minLimit: 10,
    isControlled: false,
    branchId: CURRENT_BRANCH_ID,
    updatedAt: new Date().toISOString(),
    batches: [
      {
        id: "batch-aug-01",
        productId: "prod-augmentin-1g",
        batchNumber: "AUG-2026-A1",
        expiryDate: "2027-02-15",
        qtyPacks: 9,
        branchId: CURRENT_BRANCH_ID,
      },
      {
        id: "batch-aug-02",
        productId: "prod-augmentin-1g",
        batchNumber: "AUG-2026-B8",
        expiryDate: "2028-06-30",
        qtyPacks: 15,
        branchId: CURRENT_BRANCH_ID,
      },
    ],
  },
  {
    id: "prod-hibiotic-1g",
    barcode: "6281000010222",
    name: "هاي بيوتك 1 جم (Hibiotic 1g)",
    scientificName: "Amoxicillin + Clavulanic Acid",
    category: "مضادات حيوية",
    packPrice: 64.0,
    weightedCostPrice: 46.5,
    stripsPerPack: 2,
    stockPacks: 18,
    stockLooseStrips: 0,
    minLimit: 8,
    isControlled: false,
    branchId: CURRENT_BRANCH_ID,
    updatedAt: new Date().toISOString(),
    batches: [
      {
        id: "batch-hib-01",
        productId: "prod-hibiotic-1g",
        batchNumber: "HIB-8821",
        expiryDate: "2027-09-20",
        qtyPacks: 18,
        branchId: CURRENT_BRANCH_ID,
      },
    ],
  },
  {
    id: "prod-panadol-extra",
    barcode: "6281000020111",
    name: "بنادول إكسترا (Panadol Extra)",
    scientificName: "Paracetamol + Caffeine",
    category: "مسكنات وخافضات حرارة",
    packPrice: 18.0,
    weightedCostPrice: 12.5,
    stripsPerPack: 2,
    stockPacks: 55,
    stockLooseStrips: 1,
    minLimit: 20,
    isControlled: false,
    branchId: CURRENT_BRANCH_ID,
    updatedAt: new Date().toISOString(),
    batches: [
      {
        id: "batch-pan-01",
        productId: "prod-panadol-extra",
        batchNumber: "PND-104",
        expiryDate: "2027-04-10",
        qtyPacks: 20,
        branchId: CURRENT_BRANCH_ID,
      },
      {
        id: "batch-pan-02",
        productId: "prod-panadol-extra",
        batchNumber: "PND-209",
        expiryDate: "2028-11-01",
        qtyPacks: 35,
        branchId: CURRENT_BRANCH_ID,
      },
    ],
  },
  {
    id: "prod-adol-extra",
    barcode: "6281000020222",
    name: "أدول إكسترا (Adol Extra)",
    scientificName: "Paracetamol + Caffeine",
    category: "مسكنات وخافضات حرارة",
    packPrice: 14.0,
    weightedCostPrice: 9.8,
    stripsPerPack: 2,
    stockPacks: 32,
    stockLooseStrips: 0,
    minLimit: 15,
    isControlled: false,
    branchId: CURRENT_BRANCH_ID,
    updatedAt: new Date().toISOString(),
    batches: [
      {
        id: "batch-adl-01",
        productId: "prod-adol-extra",
        batchNumber: "ADL-441",
        expiryDate: "2028-01-15",
        qtyPacks: 32,
        branchId: CURRENT_BRANCH_ID,
      },
    ],
  },
  {
    id: "prod-warfarin-5mg",
    barcode: "6281000030111",
    name: "وارفارين 5 ملجم (Warfarin 5mg)",
    scientificName: "Warfarin Sodium",
    category: "أدوية القلب والسيولة",
    packPrice: 45.0,
    weightedCostPrice: 33.0,
    stripsPerPack: 3,
    stockPacks: 6,
    stockLooseStrips: 0,
    minLimit: 8,
    isControlled: false,
    branchId: CURRENT_BRANCH_ID,
    updatedAt: new Date().toISOString(),
    batches: [
      {
        id: "batch-war-01",
        productId: "prod-warfarin-5mg",
        batchNumber: "WRF-901",
        expiryDate: "2027-01-25",
        qtyPacks: 6,
        branchId: CURRENT_BRANCH_ID,
      },
    ],
  },
  {
    id: "prod-aspirin-protect",
    barcode: "6281000030222",
    name: "أسبرين بروتكت 100 ملجم (Aspirin Protect)",
    scientificName: "Acetylsalicylic Acid",
    category: "أدوية القلب والسيولة",
    packPrice: 27.0,
    weightedCostPrice: 19.5,
    stripsPerPack: 3,
    stockPacks: 4,
    stockLooseStrips: 2,
    minLimit: 10,
    isControlled: false,
    branchId: CURRENT_BRANCH_ID,
    updatedAt: new Date().toISOString(),
    batches: [
      {
        id: "batch-asp-01",
        productId: "prod-aspirin-protect",
        batchNumber: "ASP-773",
        expiryDate: "2027-07-19",
        qtyPacks: 4,
        branchId: CURRENT_BRANCH_ID,
      },
    ],
  },
  {
    id: "prod-brufen-600",
    barcode: "6281000040111",
    name: "بروفين 600 ملجم (Brufen 600mg)",
    scientificName: "Ibuprofen",
    category: "مسكنات ومضادات التهاب",
    packPrice: 31.5,
    weightedCostPrice: 22.0,
    stripsPerPack: 3,
    stockPacks: 19,
    stockLooseStrips: 0,
    minLimit: 10,
    isControlled: false,
    branchId: CURRENT_BRANCH_ID,
    updatedAt: new Date().toISOString(),
    batches: [
      {
        id: "batch-bru-01",
        productId: "prod-brufen-600",
        batchNumber: "BRU-331",
        expiryDate: "2027-05-12",
        qtyPacks: 7,
        branchId: CURRENT_BRANCH_ID,
      },
      {
        id: "batch-bru-02",
        productId: "prod-brufen-600",
        batchNumber: "BRU-550",
        expiryDate: "2028-08-30",
        qtyPacks: 12,
        branchId: CURRENT_BRANCH_ID,
      },
    ],
  },
  {
    id: "prod-viagra-100",
    barcode: "6281000050111",
    name: "فياجرا 100 ملجم (Viagra 100mg)",
    scientificName: "Sildenafil Citrate",
    category: "صحة الرجال",
    packPrice: 120.0,
    weightedCostPrice: 88.0,
    stripsPerPack: 1,
    stockPacks: 12,
    stockLooseStrips: 0,
    minLimit: 5,
    isControlled: false,
    branchId: CURRENT_BRANCH_ID,
    updatedAt: new Date().toISOString(),
    batches: [
      {
        id: "batch-via-01",
        productId: "prod-viagra-100",
        batchNumber: "VGR-112",
        expiryDate: "2028-03-01",
        qtyPacks: 12,
        branchId: CURRENT_BRANCH_ID,
      },
    ],
  },
  {
    id: "prod-isordil-10",
    barcode: "6281000050222",
    name: "إيزورديل 10 ملجم للذبحة (Isordil 10mg)",
    scientificName: "Isosorbide Dinitrate",
    category: "أدوية القلب والسيولة",
    packPrice: 38.0,
    weightedCostPrice: 27.0,
    stripsPerPack: 2,
    stockPacks: 9,
    stockLooseStrips: 0,
    minLimit: 5,
    isControlled: false,
    branchId: CURRENT_BRANCH_ID,
    updatedAt: new Date().toISOString(),
    batches: [
      {
        id: "batch-iso-01",
        productId: "prod-isordil-10",
        batchNumber: "ISD-604",
        expiryDate: "2027-10-14",
        qtyPacks: 9,
        branchId: CURRENT_BRANCH_ID,
      },
    ],
  },
  {
    id: "prod-lyrica-150",
    barcode: "6281000060111",
    name: "ليريكا 150 ملجم (Lyrica 150mg)",
    scientificName: "Pregabalin",
    category: "أدوية الأعصاب والمراقبة",
    packPrice: 165.0,
    weightedCostPrice: 125.0,
    stripsPerPack: 2,
    stockPacks: 8,
    stockLooseStrips: 0,
    minLimit: 5,
    isControlled: true,
    branchId: CURRENT_BRANCH_ID,
    updatedAt: new Date().toISOString(),
    batches: [
      {
        id: "batch-lyr-01",
        productId: "prod-lyrica-150",
        batchNumber: "LYR-CTRL-09",
        expiryDate: "2027-08-01",
        qtyPacks: 8,
        branchId: CURRENT_BRANCH_ID,
      },
    ],
  },
  {
    id: "prod-xanax-0.5",
    barcode: "6281000060222",
    name: "زاناكس 0.5 ملجم (Xanax 0.5mg)",
    scientificName: "Alprazolam",
    category: "أدوية الأعصاب والمراقبة",
    packPrice: 78.0,
    weightedCostPrice: 54.0,
    stripsPerPack: 3,
    stockPacks: 3,
    stockLooseStrips: 0,
    minLimit: 5,
    isControlled: true,
    branchId: CURRENT_BRANCH_ID,
    updatedAt: new Date().toISOString(),
    batches: [
      {
        id: "batch-xnx-01",
        productId: "prod-xanax-0.5",
        batchNumber: "XNX-CTRL-42",
        expiryDate: "2027-03-11",
        qtyPacks: 3,
        branchId: CURRENT_BRANCH_ID,
      },
    ],
  },
  {
    id: "prod-tramadol-100",
    barcode: "6281000060333",
    name: "ترامادول 100 ملجم (Tramal 100mg)",
    scientificName: "Tramadol HCl",
    category: "أدوية الأعصاب والمراقبة",
    packPrice: 96.0,
    weightedCostPrice: 70.0,
    stripsPerPack: 2,
    stockPacks: 5,
    stockLooseStrips: 0,
    minLimit: 4,
    isControlled: true,
    branchId: CURRENT_BRANCH_ID,
    updatedAt: new Date().toISOString(),
    batches: [
      {
        id: "batch-trm-01",
        productId: "prod-tramadol-100",
        batchNumber: "TRM-CTRL-77",
        expiryDate: "2027-12-30",
        qtyPacks: 5,
        branchId: CURRENT_BRANCH_ID,
      },
    ],
  },
  {
    id: "prod-nexium-40",
    barcode: "6281000070111",
    name: "نيكسيوم 40 ملجم (Nexium 40mg)",
    scientificName: "Esomeprazole",
    category: "الجهاز الهضمي",
    packPrice: 92.0,
    weightedCostPrice: 69.0,
    stripsPerPack: 2,
    stockPacks: 14,
    stockLooseStrips: 1,
    minLimit: 6,
    isControlled: false,
    branchId: CURRENT_BRANCH_ID,
    updatedAt: new Date().toISOString(),
    batches: [
      {
        id: "batch-nex-01",
        productId: "prod-nexium-40",
        batchNumber: "NEX-512",
        expiryDate: "2028-04-20",
        qtyPacks: 14,
        branchId: CURRENT_BRANCH_ID,
      },
    ],
  },
  {
    id: "prod-esomep-40",
    barcode: "6281000070222",
    name: "إيزوميب 40 ملجم بديل نيكسيوم (Esomep 40mg)",
    scientificName: "Esomeprazole",
    category: "الجهاز الهضمي",
    packPrice: 54.0,
    weightedCostPrice: 36.0,
    stripsPerPack: 2,
    stockPacks: 22,
    stockLooseStrips: 0,
    minLimit: 6,
    isControlled: false,
    branchId: CURRENT_BRANCH_ID,
    updatedAt: new Date().toISOString(),
    batches: [
      {
        id: "batch-eso-01",
        productId: "prod-esomep-40",
        batchNumber: "ESM-819",
        expiryDate: "2028-09-10",
        qtyPacks: 22,
        branchId: CURRENT_BRANCH_ID,
      },
    ],
  },
];

const createDefaultDatabase = (): LocalDatabaseSnapshot => {
  const initialShiftId = "shift-default-01";
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
          const parsed = JSON.parse(raw) as LocalDatabaseSnapshot;
          if (
            parsed &&
            Array.isArray(parsed.products) &&
            parsed.products.length > 0
          ) {
            return parsed;
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
