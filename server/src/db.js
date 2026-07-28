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
    db.exec(schema);
    migrate(db);
  }
  return db;
}

function migrate(database) {
  const cols = database.prepare(`PRAGMA table_info(licenses)`).all().map((c) => c.name);
  if (!cols.includes("single_use")) {
    database.exec(`ALTER TABLE licenses ADD COLUMN single_use INTEGER NOT NULL DEFAULT 0`);
  }
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_redeem_codes_pack ON redeem_codes(pack);
    CREATE INDEX IF NOT EXISTS idx_redeem_codes_remaining ON redeem_codes(remaining);
  `);
}

export function getReleasesDir() {
  const dir = process.env.RELEASES_DIR || path.join(root, "data", "releases");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
