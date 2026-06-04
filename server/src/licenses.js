import crypto from "crypto";
import { getDb } from "./db.js";

export function generateLicenseKey() {
  const part = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `CC-${part()}-${part()}-${part()}`;
}

export function findLicenseByKey(licenseKey) {
  return getDb()
    .prepare(`SELECT * FROM licenses WHERE license_key = ?`)
    .get(licenseKey);
}

export function isLicenseExpired(license) {
  if (!license?.expires_at) return false;
  return new Date(license.expires_at) < new Date();
}

export function countActivations(licenseId) {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM activations WHERE license_id = ?`)
    .get(licenseId);
  return row.c;
}

export function upsertActivation(licenseId, installationId, userAgent) {
  const existing = getDb()
    .prepare(
      `SELECT id FROM activations WHERE license_id = ? AND installation_id = ?`
    )
    .get(licenseId, installationId);
  if (existing) {
    getDb()
      .prepare(
        `UPDATE activations SET last_seen_at = datetime('now'), user_agent = ? WHERE id = ?`
      )
      .run(userAgent || null, existing.id);
    return { created: false };
  }
  getDb()
    .prepare(
      `INSERT INTO activations (license_id, installation_id, user_agent) VALUES (?, ?, ?)`
    )
    .run(licenseId, installationId, userAgent || null);
  return { created: true };
}

export function activateLicense({ licenseKey, channelId, installationId, userAgent }) {
  const license = findLicenseByKey(licenseKey);
  if (!license) {
    return { ok: false, code: "INVALID_KEY", message: "激活码无效" };
  }
  if (license.channel_id !== channelId) {
    return { ok: false, code: "CHANNEL_MISMATCH", message: "激活码不适用于本渠道" };
  }
  if (isLicenseExpired(license)) {
    return { ok: false, code: "EXPIRED", message: "激活码已过期" };
  }

  const count = countActivations(license.id);
  const existing = getDb()
    .prepare(
      `SELECT id FROM activations WHERE license_id = ? AND installation_id = ?`
    )
    .get(license.id, installationId);

  if (!existing && count >= license.max_devices) {
    return {
      ok: false,
      code: "DEVICE_LIMIT",
      message: `已达设备上限（${license.max_devices} 台）`,
    };
  }

  upsertActivation(license.id, installationId, userAgent);

  return {
    ok: true,
    channel_id: license.channel_id,
    expires_at: license.expires_at,
    email: license.email,
    max_devices: license.max_devices,
  };
}

export function checkLicense({ licenseKey, channelId, installationId }) {
  const license = findLicenseByKey(licenseKey);
  if (!license) {
    return { active: false, code: "INVALID_KEY" };
  }
  if (license.channel_id !== channelId) {
    return { active: false, code: "CHANNEL_MISMATCH" };
  }
  if (isLicenseExpired(license)) {
    return { active: false, code: "EXPIRED", expires_at: license.expires_at };
  }
  const activation = getDb()
    .prepare(
      `SELECT id FROM activations WHERE license_id = ? AND installation_id = ?`
    )
    .get(license.id, installationId);
  if (!activation) {
    return { active: false, code: "NOT_ACTIVATED" };
  }
  upsertActivation(license.id, installationId, null);
  return {
    active: true,
    expires_at: license.expires_at,
    channel_id: license.channel_id,
  };
}

export function createLicense({
  channelId,
  email,
  maxDevices = 2,
  expiresAt,
  note,
  licenseKey,
}) {
  const key = licenseKey || generateLicenseKey();
  getDb()
    .prepare(
      `INSERT INTO licenses (license_key, channel_id, email, max_devices, expires_at, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(key, channelId, email || null, maxDevices, expiresAt || null, note || null);
  return findLicenseByKey(key);
}
