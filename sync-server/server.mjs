import http from "node:http";
import pg from "pg";

const { Pool } = pg;

const PORT = process.env.PORT || 4000;

const pool = new Pool({
  host: process.env.PGHOST || "cloud-sync-db",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "pharma_admin",
  password: process.env.PGPASSWORD || "pharma_password_2026",
  database: process.env.PGDATABASE || "pharmacare_central",
});

// إنشاء الجداول المركزية في PostgreSQL تلقائياً عند تشغيل الحاوية
const initCentralPostgresTables = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS central_sync_batches (
        batch_id VARCHAR(64) PRIMARY KEY,
        branch_id VARCHAR(64) NOT NULL,
        records_count INTEGER NOT NULL,
        sent_at TIMESTAMP NOT NULL,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

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
    console.log("✅ Central PostgreSQL tables initialized successfully.");
  } finally {
    client.release();
  }
};

// إعادة المحاولة حتى تجهز حاوية PostgreSQL
const connectWithRetry = async () => {
  for (let i = 0; i < 10; i++) {
    try {
      await initCentralPostgresTables();
      return;
    } catch (err) {
      console.log("⏳ Waiting for PostgreSQL container to be ready...");
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
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

  // نقطة فحص حالة السيرفر
  if (req.method === "GET" && req.url === "/api/v1/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ status: "ONLINE", db: "PostgreSQL 16" }));
    return;
  }

  // نقطة استقبال حزمة المزامنة المجمعة (Batch Sync Endpoint)
  if (req.method === "POST" && req.url === "/api/v1/sync/batch") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      const client = await pool.connect();
      try {
        const data = JSON.parse(body);
        const { batchId, branchId, sentAt, records = [] } = data;

        await client.query("BEGIN");

        await client.query(
          `INSERT INTO central_sync_batches (batch_id, branch_id, records_count, sent_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (batch_id) DO NOTHING;`,
          [
            batchId,
            branchId || "MAIN_BRANCH",
            records.length,
            sentAt || new Date().toISOString(),
          ],
        );

        for (const item of records) {
          let parsedPayload = {};
          try {
            parsedPayload =
              typeof item.payload === "string"
                ? JSON.parse(item.payload)
                : item.payload;
          } catch {
            parsedPayload = { raw: item.payload };
          }

          await client.query(
            `INSERT INTO central_synced_records (
               id, batch_id, branch_id, entity_type, operation, record_id, payload, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
               payload = EXCLUDED.payload,
               synced_at = CURRENT_TIMESTAMP;`,
            [
              item.id,
              batchId,
              item.branchId || branchId || "MAIN_BRANCH",
              item.entityType,
              item.operation,
              item.recordId,
              JSON.stringify(parsedPayload),
              item.createdAt || new Date().toISOString(),
            ],
          );
        }

        await client.query("COMMIT");

        console.log(
          `📦 [Batch Synced] ${batchId} | Branch: ${branchId} | Records: ${records.length}`,
        );

        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(
          JSON.stringify({
            success: true,
            batchId,
            syncedCount: records.length,
          }),
        );
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ Sync Batch Error:", err);
        res.writeHead(500, {
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(JSON.stringify({ success: false, error: err.message }));
      } finally {
        client.release();
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

connectWithRetry().then(() => {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(
      `🚀 PharmaCare Cloud Sync API listening on http://localhost:${PORT}`,
    );
  });
});
