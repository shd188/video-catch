import crypto from "crypto";
import { getDb } from "./db.js";

const SETTINGS_KEY = "password_hash";
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(plain, salt, 32, SCRYPT_PARAMS);
  return `${salt.toString("base64")}:${hash.toString("base64")}`;
}

function verifyScrypt(plain, stored) {
  const [saltB64, hashB64] = stored.split(":");
  if (!saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = crypto.scryptSync(plain, salt, expected.length, SCRYPT_PARAMS);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function getStoredHash() {
  const row = getDb()
    .prepare(`SELECT value FROM admin_settings WHERE key = ?`)
    .get(SETTINGS_KEY);
  return row?.value || null;
}

function bootstrapFromEnv() {
  const envKey = process.env.ADMIN_API_KEY || "";
  if (!envKey || envKey === "change-me-to-a-long-random-string") return false;
  const hashed = hashPassword(envKey);
  getDb()
    .prepare(
      `INSERT INTO admin_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO NOTHING`
    )
    .run(SETTINGS_KEY, hashed);
  return true;
}

export function ensureAdminPasswordReady() {
  if (!getStoredHash()) bootstrapFromEnv();
}

export function verifyAdminKey(key) {
  if (!key) return false;
  ensureAdminPasswordReady();
  const stored = getStoredHash();
  if (stored) return verifyScrypt(String(key), stored);
  const envKey = process.env.ADMIN_API_KEY || "";
  if (!envKey || envKey === "change-me-to-a-long-random-string") return false;
  const a = Buffer.from(String(key));
  const b = Buffer.from(envKey);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function changeAdminPassword(newPassword) {
  const plain = String(newPassword || "").trim();
  if (plain.length < 8) {
    throw new Error("新密码至少 8 位");
  }
  const hashed = hashPassword(plain);
  getDb()
    .prepare(
      `INSERT INTO admin_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(SETTINGS_KEY, hashed);
  return { ok: true };
}

export function hasConfiguredPassword() {
  ensureAdminPasswordReady();
  return Boolean(getStoredHash());
}
