import Database from "@tauri-apps/plugin-sql";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

export let sqliteRaw: Database | null = null;

// التحقق مما إذا كان التطبيق يعمل داخل نافذة سطح المكتب Tauri
export const isTauriDesktop = (): boolean => {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
};

// إنشاء الجداول الـ 10 تلقائياً وتفعيل WAL Mode عند الإقلاع بما يطابق schema.ts
const bootstrapSQLiteTables = async (db: Database) => {
  await db.execute("PRAGMA journal_mode = WAL;");
  await db.execute("PRAGMA synchronous = NORMAL;");
  await db.execute("PRAGMA foreign_keys = ON;");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      barcode TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      scientific_name TEXT NOT NULL,
      category TEXT DEFAULT 'عام' NOT NULL,
      pack_price REAL NOT NULL,
      weighted_cost_price REAL NOT NULL,
      strips_per_pack INTEGER DEFAULT 1 NOT NULL,
      stock_packs INTEGER DEFAULT 0 NOT NULL,
      stock_loose_strips INTEGER DEFAULT 0 NOT NULL,
      min_limit INTEGER DEFAULT 5 NOT NULL,
      is_controlled INTEGER DEFAULT 0 NOT NULL,
      branch_id TEXT DEFAULT 'MAIN_BRANCH' NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      batch_number TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      qty_packs INTEGER NOT NULL,
      branch_id TEXT DEFAULT 'MAIN_BRANCH' NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      payment_mode TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount_percent REAL DEFAULT 0 NOT NULL,
      total_amount REAL NOT NULL,
      total_cost_amount REAL DEFAULT 0 NOT NULL,
      net_profit REAL DEFAULT 0 NOT NULL,
      items_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      branch_id TEXT DEFAULT 'MAIN_BRANCH' NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id TEXT PRIMARY KEY NOT NULL,
      supplier_name TEXT NOT NULL,
      supplier_invoice_number TEXT NOT NULL,
      payment_mode TEXT NOT NULL,
      total_amount REAL NOT NULL,
      total_bonus_value REAL DEFAULT 0 NOT NULL,
      items_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      branch_id TEXT DEFAULT 'MAIN_BRANCH' NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS controlled_drug_logs (
      id TEXT PRIMARY KEY NOT NULL,
      invoice_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      scientific_name TEXT NOT NULL,
      barcode TEXT NOT NULL,
      unit TEXT NOT NULL,
      qty INTEGER NOT NULL,
      batch_number TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      national_id TEXT NOT NULL,
      doctor_name TEXT NOT NULL,
      prescription_id TEXT NOT NULL,
      dispensed_at TEXT NOT NULL,
      branch_id TEXT DEFAULT 'MAIN_BRANCH' NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS cash_expenses (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      notes TEXT,
      shift_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      branch_id TEXT DEFAULT 'MAIN_BRANCH' NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY NOT NULL,
      pharmacist_name TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      status TEXT NOT NULL,
      opening_balance REAL NOT NULL,
      cash_sales_total REAL NOT NULL DEFAULT 0,
      credit_sales_total REAL NOT NULL DEFAULT 0,
      returns_total REAL NOT NULL DEFAULT 0,
      credit_returns_total REAL NOT NULL DEFAULT 0,
      debt_collections_total REAL NOT NULL DEFAULT 0,
      supplier_payments_total REAL NOT NULL DEFAULT 0,
      cash_purchases_total REAL NOT NULL DEFAULT 0,
      petty_cash_total REAL NOT NULL DEFAULT 0,
      expected_drawer_cash REAL NOT NULL DEFAULT 0,
      actual_drawer_cash REAL,
      variance REAL,
      safe_drop_amount REAL DEFAULT 0,
      next_shift_float REAL DEFAULT 0,
      branch_id TEXT DEFAULT 'MAIN_BRANCH' NOT NULL
    );
  `);

  // ترقية آمنة لجدول shifts إذا كانت قاعدة البيانات منشأة من إصدار أقدم
  const alterShiftColumns = [
    "ALTER TABLE shifts ADD COLUMN credit_returns_total REAL NOT NULL DEFAULT 0;",
    "ALTER TABLE shifts ADD COLUMN debt_collections_total REAL NOT NULL DEFAULT 0;",
    "ALTER TABLE shifts ADD COLUMN supplier_payments_total REAL NOT NULL DEFAULT 0;",
    "ALTER TABLE shifts ADD COLUMN cash_purchases_total REAL NOT NULL DEFAULT 0;",
    "ALTER TABLE shifts ADD COLUMN safe_drop_amount REAL DEFAULT 0;",
    "ALTER TABLE shifts ADD COLUMN next_shift_float REAL DEFAULT 0;",
  ];
  for (const stmt of alterShiftColumns) {
    try {
      await db.execute(stmt);
    } catch {
      // العمود موجود مسبقاً
    }
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      entity_type TEXT NOT NULL,
      operation TEXT NOT NULL,
      record_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      branch_id TEXT DEFAULT 'MAIN_BRANCH' NOT NULL,
      status TEXT DEFAULT 'PENDING' NOT NULL,
      created_at TEXT NOT NULL,
      synced_at TEXT
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS ledger_payments (
      id TEXT PRIMARY KEY NOT NULL,
      party_type TEXT NOT NULL,
      party_name TEXT NOT NULL,
      amount REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      branch_id TEXT DEFAULT 'MAIN_BRANCH' NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS pharmacy_settings (
      id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // إضافة جدول المستخدمين (نظام الصلاحيات RBAC)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      pin_code TEXT UNIQUE NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      permissions_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // فهارس عالية الأداء لتسريع البحث بالباركود والاسم والمادة الفعالة وربط الدفعات عند وجود 10,000+ دواء
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_products_scientific ON products(scientific_name);",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_batches_product_id ON batches(product_id);",
  );

  // فهرس لتسريع البحث عن المستخدم بواسطة الرمز السري (PIN) أثناء تسجيل الدخول
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_users_pin_code ON users(pin_code);",
  );
};

// جسر Drizzle ORM المتصل بـ Tauri SQL Plugin
export const db = drizzle(
  async (sql, params, method) => {
    if (!sqliteRaw) {
      return { rows: [] };
    }
    try {
      if (method === "run") {
        await sqliteRaw.execute(sql, params);
        return { rows: [] };
      }
      const rows = await sqliteRaw.select<Record<string, unknown>[]>(
        sql,
        params,
      );
      return {
        rows: rows.map((row) => Object.values(row)),
      };
    } catch (error) {
      console.error("SQLite Execution Error:", error);
      throw error;
    }
  },
  { schema },
);

export const initDatabase = async () => {
  if (isTauriDesktop()) {
    console.log(
      "🚀 Tauri Desktop Mode: Connecting to local SQLite (pharmacare.db)...",
    );
    sqliteRaw = await Database.load("sqlite:pharmacare.db");
    await bootstrapSQLiteTables(sqliteRaw);
  } else {
    console.log(
      "🌐 Docker Browser Mode: Running with LocalStorage Persistence...",
    );
  }
  return db;
};

export const setDb = (_instance: unknown) => {};
