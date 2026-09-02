import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

let db;

export function getDb() {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || path.join(root, "data", "licenses.db");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    const schema = fs.readFileSync(path.join(root, "schema.sql"), "utf8");
    // Existing DBs already have `licenses`; schema.sql CREATE INDEX on new
    // columns would throw before migrate() can ALTER TABLE. Apply schema
    // best-effort, then add missing columns/indexes.
    try {
      db.exec(schema);
    } catch (err) {
      console.warn("schema.sql skipped (existing DB):", err && err.message ? err.message : err);
    }
    migrate(db);
  }
  return db;
}

function migrate(database) {
  const cols = database.prepare(`PRAGMA table_info(licenses)`).all().map((c) => c.name);
  if (!cols.includes("single_use")) {
    database.exec(`ALTER TABLE licenses ADD COLUMN single_use INTEGER NOT NULL DEFAULT 0`);
  }
  if (!cols.includes("sent_at")) {
    database.exec(`ALTER TABLE licenses ADD COLUMN sent_at TEXT`);
  }
  if (!cols.includes("claim_token")) {
    database.exec(`ALTER TABLE licenses ADD COLUMN claim_token TEXT`);
  }
  if (!cols.includes("order_no")) {
    database.exec(`ALTER TABLE licenses ADD COLUMN order_no TEXT`);
  }
  if (!cols.includes("revoked")) {
    database.exec(`ALTER TABLE licenses ADD COLUMN revoked INTEGER NOT NULL DEFAULT 0`);
  }
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_licenses_channel_sent ON licenses(channel_id, sent_at);
    CREATE INDEX IF NOT EXISTS idx_licenses_claim_token ON licenses(claim_token);
    DROP INDEX IF EXISTS idx_licenses_channel_order;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_licenses_channel_order
      ON licenses(channel_id, order_no)
      WHERE order_no IS NOT NULL AND order_no != '' AND ifnull(revoked, 0) = 0;
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS redeem_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      pack INTEGER NOT NULL,
      total INTEGER NOT NULL,
      remaining INTEGER NOT NULL,
      note TEXT,
      activated_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_redeem_codes_pack ON redeem_codes(pack);
    CREATE INDEX IF NOT EXISTS idx_redeem_codes_remaining ON redeem_codes(remaining);
  `);
  const redeemCols = database.prepare(`PRAGMA table_info(redeem_codes)`).all().map((c) => c.name);
  if (!redeemCols.includes("activated_at")) {
    database.exec(`ALTER TABLE redeem_codes ADD COLUMN activated_at TEXT`);
  }
  database.exec(`
    CREATE TABLE IF NOT EXISTS channel_whitelist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      url TEXT NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(channel_id, url)
    );
    CREATE INDEX IF NOT EXISTS idx_channel_whitelist_channel ON channel_whitelist(channel_id);
  `);
}

export function getReleasesDir() {
  const dir = process.env.RELEASES_DIR || path.join(root, "data", "releases");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
