import http from "node:http";
import pg from "pg";

const { Pool } = pg;

const PORT = process.env.PORT || 4000;

// إعداد تجمع اتصالات قاعدة بيانات PostgreSQL المركزية
const pool = new Pool({
  host: process.env.PGHOST || "cloud-sync-db",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "pharma_admin",
  password: process.env.PGPASSWORD || "pharma_password_2026",
  database: process.env.PGDATABASE || "pharmacare_central",
});

/**
 * إنشاء الجداول المركزية في PostgreSQL تلقائياً عند إقلاع السيرفر
 * (جداول أرشيف المزامنة + جدول الموظفين والصلاحيات RBAC)
 */
const initCentralPostgresTables = async () => {
  const client = await pool.connect();
  try {
    // 1. جدول رؤوس دفعات المزامنة المستلمة من الفروع
    await client.query(`
      CREATE TABLE IF NOT EXISTS central_sync_batches (
        batch_id VARCHAR(64) PRIMARY KEY,
        branch_id VARCHAR(64) NOT NULL,
        records_count INTEGER NOT NULL,
        sent_at TIMESTAMP NOT NULL,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. جدول الأرشيف العام لجميع السجلات المتزامنة (Audit Log & Idempotency)
    await client.query(`
      CREATE TABLE IF NOT EXISTS central_synced_records (
        id VARCHAR(64) PRIMARY KEY,
        batch_id VARCHAR(64) REFERENCES central_sync_batches(batch_id) ON DELETE CASCADE,
        branch_id VARCHAR(64) NOT NULL,
        entity_type VARCHAR(32) NOT NULL,
        operation VARCHAR(16) NOT NULL,
        record_id VARCHAR(64) NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. جدول الموظفين والصلاحيات (Multi-Branch RBAC)
    // المفتاح الأساسي المركب (branch_id, id) يمنع تضارب المعرّفات الافتراضية بين الفروع
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) NOT NULL,
        branch_id VARCHAR(64) NOT NULL DEFAULT 'MAIN_BRANCH',
        name VARCHAR(128) NOT NULL,
        role VARCHAR(32) NOT NULL,
        pin_code VARCHAR(32) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (branch_id, id),
        CONSTRAINT uq_users_branch_pin UNIQUE (branch_id, pin_code)
      );
    `);

    // فهرس لتسريع جلب موظفي فرع معين
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
    `);

    console.log(
      "✅ Central PostgreSQL tables (batches, records, users) initialized successfully.",
    );
  } finally {
    client.release();
  }
};

/**
 * حفظ أو تحديث سجل موظف واحد في جدول users (Upsert) داخل معاملة المزامنة
 */
const upsertSyncedUser = async (
  client,
  item,
  parsedPayload,
  fallbackBranchId,
) => {
  const userId = String(parsedPayload?.id || item.recordId || "").trim();
  const userBranchId = String(
    item.branchId || fallbackBranchId || "MAIN_BRANCH",
  ).trim();
  const userName = String(parsedPayload?.name || "").trim();
  const userPin = String(parsedPayload?.pinCode || "").trim();

  // التحقق من اكتمال الحقول الإلزامية قبل الحفظ في PostgreSQL
  if (!userId || !userName || !userPin) {
    throw new Error(
      `بيانات الموظف غير مكتملة للسجل (${item.recordId || "unknown"})`,
    );
  }

  // في حال كانت العملية DELETE نجمّد الحساب بدلاً من حذفه حفاظاً على سجل التدقيق
  const isActive =
    item.operation === "DELETE"
      ? false
      : parsedPayload.isActive !== undefined
        ? Boolean(parsedPayload.isActive)
        : true;

  await client.query(
    `INSERT INTO users (
       id, branch_id, name, role, pin_code, is_active, permissions, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, CURRENT_TIMESTAMP)
     ON CONFLICT (branch_id, id) DO UPDATE SET
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       pin_code = EXCLUDED.pin_code,
       is_active = EXCLUDED.is_active,
       permissions = EXCLUDED.permissions,
       updated_at = CURRENT_TIMESTAMP;`,
    [
      userId,
      userBranchId,
      userName,
      String(parsedPayload.role || "CASHIER"),
      userPin,
      isActive,
      JSON.stringify(parsedPayload.permissions || {}),
      parsedPayload.createdAt || item.createdAt || new Date().toISOString(),
    ],
  );
};

/**
 * محاولة الاتصال بقاعدة البيانات مع إعادة المحاولة حتى تجهز حاوية PostgreSQL
 */
const connectWithRetry = async () => {
  for (let i = 0; i < 10; i++) {
    try {
      await initCentralPostgresTables();
      return;
    } catch {
      console.log("⏳ Waiting for PostgreSQL container to be ready...");
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
  throw new Error("تعذر الاتصال بقاعدة بيانات PostgreSQL بعد 10 محاولات.");
};

/**
 * دالة مساعدة موحدة لإرسال استجابات JSON بترميز UTF-8
 */
const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
};

const server = http.createServer(async (req, res) => {
  // تفعيل CORS للسماح لواجهة React (5173) ونافذة Tauri بالاتصال المباشر
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // تحليل المسار ومعاملات الاستعلام بأمان
  const parsedUrl = new URL(
    req.url || "/",
    `http://${req.headers.host || "localhost"}`,
  );
  const pathname = parsedUrl.pathname;

  // 1. نقطة فحص حالة السيرفر
  if (req.method === "GET" && pathname === "/api/v1/health") {
    sendJson(res, 200, { status: "ONLINE", db: "PostgreSQL 16" });
    return;
  }

  // 2. نقطة عرض الموظفين المزامنين في السحابة (للتدقيق والتحقق — بدون إرجاع pin_code)
  if (req.method === "GET" && pathname === "/api/v1/users") {
    try {
      const branchId = parsedUrl.searchParams.get("branchId");
      const result = branchId
        ? await pool.query(
            `SELECT id, branch_id, name, role, is_active, permissions, created_at, updated_at
             FROM users
             WHERE branch_id = $1
             ORDER BY created_at ASC;`,
            [branchId],
          )
        : await pool.query(
            `SELECT id, branch_id, name, role, is_active, permissions, created_at, updated_at
             FROM users
             ORDER BY branch_id ASC, created_at ASC;`,
          );

      sendJson(res, 200, {
        success: true,
        count: result.rows.length,
        users: result.rows,
      });
    } catch (err) {
      console.error("❌ Get Users Error:", err);
      sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // 3. نقطة استقبال حزمة المزامنة المجمعة (Batch Sync Endpoint)
  if (req.method === "POST" && pathname === "/api/v1/sync/batch") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      let data;
      try {
        data = JSON.parse(body || "{}");
      } catch {
        sendJson(res, 400, {
          success: false,
          error: "صيغة JSON المرسلة غير صالحة",
        });
        return;
      }

      const { batchId, branchId, sentAt, records = [] } = data;
      if (!batchId || !Array.isArray(records)) {
        sendJson(res, 400, {
          success: false,
          error: "الحقل batchId أو مصفوفة records غير موجودة",
        });
        return;
      }

      // فرز السجلات زمنياً من الأقدم إلى الأحدث لضمان تطبيق آخر تعديل أخيراً
      const orderedRecords = [...records].sort((a, b) =>
        String(a.createdAt || "").localeCompare(String(b.createdAt || "")),
      );

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // تسجيل رأس الدفعة
        await client.query(
          `INSERT INTO central_sync_batches (batch_id, branch_id, records_count, sent_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (batch_id) DO NOTHING;`,
          [
            batchId,
            branchId || "MAIN_BRANCH",
            orderedRecords.length,
            sentAt || new Date().toISOString(),
          ],
        );

        const syncedIds = [];

        for (const item of orderedRecords) {
          let parsedPayload = {};
          try {
            parsedPayload =
              typeof item.payload === "string"
                ? JSON.parse(item.payload)
                : item.payload || {};
          } catch {
            parsedPayload = { raw: item.payload };
          }

          const recordBranchId = item.branchId || branchId || "MAIN_BRANCH";

          // أولاً: حفظ السجل في أرشيف المزامنة العام
          await client.query(
            `INSERT INTO central_synced_records (
               id, batch_id, branch_id, entity_type, operation, record_id, payload, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
             ON CONFLICT (id) DO UPDATE SET
               payload = EXCLUDED.payload,
               synced_at = CURRENT_TIMESTAMP;`,
            [
              item.id,
              batchId,
              recordBranchId,
              item.entityType,
              item.operation,
              item.recordId,
              JSON.stringify(parsedPayload),
              item.createdAt || new Date().toISOString(),
            ],
          );

          // ثانياً: إسقاط الكيانات المخصصة في جداولها العلائقية
          if (item.entityType === "USER") {
            await upsertSyncedUser(client, item, parsedPayload, recordBranchId);
          }

          syncedIds.push(item.id);
        }

        await client.query("COMMIT");

        console.log(
          `📦 [Batch Synced] ${batchId} | Branch: ${branchId} | Records: ${syncedIds.length}`,
        );

        sendJson(res, 200, {
          success: true,
          batchId,
          syncedCount: syncedIds.length,
          syncedIds,
        });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ Sync Batch Error:", err);
        sendJson(res, 500, { success: false, error: err.message });
      } finally {
        client.release();
      }
    });
    return;
  }

  sendJson(res, 404, { error: "Not Found" });
});

connectWithRetry()
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(
        `🚀 PharmaCare Cloud Sync API listening on http://localhost:${PORT}`,
      );
    });
  })
  .catch((err) => {
    console.error("❌ Failed to start sync server:", err);
    process.exit(1);
  });
