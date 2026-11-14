import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ==========================================
// 1. جدول الأدوية (Products Table)
// ==========================================
export const productsTable = sqliteTable("products", {
  id: text("id").primaryKey(), // UUID v4
  barcode: text("barcode").notNull().unique(),
  name: text("name").notNull(),
  scientificName: text("scientific_name").notNull(),
  category: text("category").notNull().default("عام"),
  packPrice: real("pack_price").notNull(),
  weightedCostPrice: real("weighted_cost_price").notNull(),
  stripsPerPack: integer("strips_per_pack").notNull().default(1),
  stockPacks: integer("stock_packs").notNull().default(0),
  stockLooseStrips: integer("stock_loose_strips").notNull().default(0),
  minLimit: integer("min_limit").notNull().default(5),
  isControlled: integer("is_controlled", { mode: "boolean" })
    .notNull()
    .default(false),

  // حقول التوسع المستقبلي الصامتة (Multi-Tenancy)
  branchId: text("branch_id").notNull().default("MAIN_BRANCH"),
  updatedAt: text("updated_at").notNull(),
});

// ==========================================
// 2. جدول الدفعات والصلاحيات (Batches Table - FIFO)
// ==========================================
export const batchesTable = sqliteTable("batches", {
  id: text("id").primaryKey(), // UUID v4
  productId: text("product_id")
    .notNull()
    .references(() => productsTable.id, { onDelete: "cascade" }), // ربط بالدواء
  batchNumber: text("batch_number").notNull(),
  expiryDate: text("expiry_date").notNull(), // صيغة YYYY-MM-DD
  qtyPacks: integer("qty_packs").notNull(),

  branchId: text("branch_id").notNull().default("MAIN_BRANCH"),
});

// ==========================================
// 3. جدول فواتير المبيعات والمرتجعات (Invoices Table)
// ==========================================
export const invoicesTable = sqliteTable("invoices", {
  id: text("id").primaryKey(), // UUID v4
  type: text("type").notNull(), // SALE | RETURN
  paymentMode: text("payment_mode").notNull(), // CASH | CREDIT
  customerName: text("customer_name").notNull(),
  subtotal: real("subtotal").notNull(),
  discountPercent: real("discount_percent").notNull().default(0),
  totalAmount: real("total_amount").notNull(),
  totalCostAmount: real("total_cost_amount").notNull().default(0),
  netProfit: real("net_profit").notNull().default(0),
  itemsJson: text("items_json").notNull(),
  createdAt: text("created_at").notNull(),
  branchId: text("branch_id").notNull().default("MAIN_BRANCH"),
});

// ==========================================
// 4. جدول فواتير المشتريات والبونص (Purchase Invoices Table)
// ==========================================
export const purchaseInvoicesTable = sqliteTable("purchase_invoices", {
  id: text("id").primaryKey(), // UUID v4
  supplierName: text("supplier_name").notNull(),
  supplierInvoiceNumber: text("supplier_invoice_number").notNull(),
  paymentMode: text("payment_mode").notNull(), // CASH | CREDIT
  totalAmount: real("total_amount").notNull(),
  totalBonusValue: real("total_bonus_value").notNull().default(0),
  itemsJson: text("items_json").notNull(),
  createdAt: text("created_at").notNull(),
  branchId: text("branch_id").notNull().default("MAIN_BRANCH"),
});

// ==========================================
// 5. جدول دفتر الأدوية المراقبة والنفسية (Controlled Drug Logs)
// ==========================================
export const controlledDrugLogsTable = sqliteTable("controlled_drug_logs", {
  id: text("id").primaryKey(), // UUID v4
  invoiceId: text("invoice_id").notNull(),
  productId: text("product_id").notNull(),
  productName: text("product_name").notNull(),
  scientificName: text("scientific_name").notNull(),
  barcode: text("barcode").notNull(),
  unit: text("unit").notNull(),
  qty: integer("qty").notNull(),
  batchNumber: text("batch_number").notNull(),
  patientName: text("patient_name").notNull(),
  nationalId: text("national_id").notNull(),
  doctorName: text("doctor_name").notNull(),
  prescriptionId: text("prescription_id").notNull(),
  dispensedAt: text("dispensed_at").notNull(),
  branchId: text("branch_id").notNull().default("MAIN_BRANCH"),
});

// ==========================================
// 6. جدول المصاريف النثرية (Petty Cash Expenses Table)
// ==========================================
export const cashExpensesTable = sqliteTable("cash_expenses", {
  id: text("id").primaryKey(), // UUID v4
  title: text("title").notNull(),
  category: text("category").notNull(),
  amount: real("amount").notNull(),
  notes: text("notes"),
  shiftId: text("shift_id").notNull(),
  createdAt: text("created_at").notNull(),
  branchId: text("branch_id").notNull().default("MAIN_BRANCH"),
});

// ==========================================
// 7. جدول الورديات والصندوق (Shifts Table)
// ==========================================
export const shiftsTable = sqliteTable("shifts", {
  id: text("id").primaryKey(), // UUID v4
  pharmacistName: text("pharmacist_name").notNull(),
  openedAt: text("opened_at").notNull(),
  closedAt: text("closed_at"),
  status: text("status").notNull(), // OPEN | CLOSED
  openingBalance: real("opening_balance").notNull().default(0),
  cashSalesTotal: real("cash_sales_total").notNull().default(0),
  creditSalesTotal: real("credit_sales_total").notNull().default(0),
  returnsTotal: real("returns_total").notNull().default(0),
  pettyCashTotal: real("petty_cash_total").notNull().default(0),
  expectedDrawerCash: real("expected_drawer_cash").notNull().default(0),
  actualDrawerCash: real("actual_drawer_cash"),
  variance: real("variance"),
  branchId: text("branch_id").notNull().default("MAIN_BRANCH"),
});

// ==========================================
// 8. جدول طابور المزامنة السحابية (Offline Sync Queue Table)
// ==========================================
export const syncQueueTable = sqliteTable("sync_queue", {
  id: text("id").primaryKey(), // UUID v4
  entityType: text("entity_type").notNull(),
  operation: text("operation").notNull(), // INSERT | UPDATE | DELETE
  recordId: text("record_id").notNull(),
  payload: text("payload").notNull(),
  branchId: text("branch_id").notNull().default("MAIN_BRANCH"),
  status: text("status").notNull().default("PENDING"), // PENDING | SYNCED | FAILED
  createdAt: text("created_at").notNull(),
  syncedAt: text("synced_at"),
});

export const ledgerPaymentsTable = sqliteTable("ledger_payments", {
  id: text("id").primaryKey(),
  partyType: text("party_type").notNull(), // CUSTOMER | SUPPLIER
  partyName: text("party_name").notNull(),
  amount: real("amount").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  branchId: text("branch_id").notNull(),
});
