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
  }
  return db;
}

export function getReleasesDir() {
  const dir = process.env.RELEASES_DIR || path.join(root, "data", "releases");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
