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

  if (license.single_use && count >= 1 && !existing) {
    return { ok: false, code: "ALREADY_USED", message: "激活码已使用，每个码仅可用一次" };
  }

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

/** 本设备安装过该渠道的任意激活码（用于「仅首次激活、更新不限制」） */
export function hasInstallActivatedOnChannel(installationId, channelId) {
  if (!installationId || !channelId) return false;
  const row = getDb()
    .prepare(
      `SELECT a.id FROM activations a
       INNER JOIN licenses l ON l.id = a.license_id
       WHERE a.installation_id = ? AND l.channel_id = ?
       LIMIT 1`
    )
    .get(installationId, channelId);
  return !!row;
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

/** 某渠道激活码用量统计（用于后台判断是否要补生成） */
export function licenseStats(channelId) {
  const row = channelId
    ? getDb()
        .prepare(
          `SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id) = 0 THEN 1 ELSE 0 END) AS unused,
            SUM(CASE WHEN (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id) > 0 THEN 1 ELSE 0 END) AS used
           FROM licenses l WHERE channel_id = ?`
        )
        .get(channelId)
    : getDb()
        .prepare(
          `SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id) = 0 THEN 1 ELSE 0 END) AS unused,
            SUM(CASE WHEN (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id) > 0 THEN 1 ELSE 0 END) AS used
           FROM licenses l`
        )
        .get();
  return {
    channel_id: channelId || null,
    total: row?.total ?? 0,
    unused: row?.unused ?? 0,
    used: row?.used ?? 0,
  };
}

export function listLicenses(channelId, { limit = 500, unusedOnly = false } = {}) {
  const usedClause = unusedOnly
    ? `AND (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id) = 0`
    : "";
  if (channelId) {
    return getDb()
      .prepare(
        `SELECT l.*,
          (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id) AS devices_used
         FROM licenses l WHERE channel_id = ? ${usedClause}
         ORDER BY l.id DESC LIMIT ?`
      )
      .all(channelId, limit);
  }
  return getDb()
    .prepare(
      `SELECT l.*,
        (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id) AS devices_used
       FROM licenses l WHERE 1=1 ${usedClause}
       ORDER BY l.id DESC LIMIT ?`
    )
    .all(limit);
}

function insertLicenseRow({
  channelId,
  email,
  maxDevices = 2,
  singleUse = 0,
  expiresAt,
  note,
  licenseKey,
}) {
  const key = licenseKey || generateLicenseKey();
  const devices = singleUse ? 1 : maxDevices;
  const single = singleUse ? 1 : 0;
  getDb()
    .prepare(
      `INSERT INTO licenses (license_key, channel_id, email, max_devices, single_use, expires_at, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(key, channelId, email || null, devices, single, expiresAt || null, note || null);
  return findLicenseByKey(key);
}

export function createLicense({
  channelId,
  email,
  maxDevices = 2,
  singleUse = false,
  expiresAt,
  note,
  licenseKey,
}) {
  return insertLicenseRow({
    channelId,
    email,
    maxDevices,
    singleUse: singleUse ? 1 : 0,
    expiresAt,
    note,
    licenseKey,
  });
}

/** 批量生成一次性激活码（适合预生成 1000 个发客户） */
export function createLicensesBulk({
  channelId,
  count,
  expiresAt,
  note,
  singleUse = true,
}) {
  const n = Math.min(Math.max(parseInt(count, 10) || 0, 1), 10000);
  const batchNote = note || `batch-${new Date().toISOString().slice(0, 10)}`;
  const keys = [];
  const insert = getDb().transaction((items) => {
    for (const item of items) {
      insertLicenseRow(item);
      keys.push(item.licenseKey);
    }
  });
  const items = [];
  const seen = new Set();
  while (items.length < n) {
    const licenseKey = generateLicenseKey();
    if (seen.has(licenseKey)) continue;
    seen.add(licenseKey);
    items.push({
      channelId,
      email: null,
      maxDevices: 1,
      singleUse: singleUse ? 1 : 0,
      expiresAt: expiresAt || null,
      note: batchNote,
      licenseKey,
    });
  }
  insert(items);
  const csv = ["license_key,channel_id,note,expires_at"].concat(
    items.map(
      (i) =>
        `${i.licenseKey},${channelId},${(batchNote || "").replace(/,/g, " ")},${expiresAt || ""}`
    )
  ).join("\n");
  return { count: n, channel_id: channelId, note: batchNote, keys, csv };
}
