import crypto from "crypto";
import { getDb } from "./db.js";

export const COURSE_DL_CHANNEL = "course-dl";

function normalizeOrder(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, "");
}

export function generateLicenseKey(channelId) {
  if (channelId === COURSE_DL_CHANNEL) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const part = (n) => {
      const bytes = crypto.randomBytes(n);
      let out = "";
      for (let i = 0; i < n; i++) {
        out += alphabet[bytes[i] % alphabet.length];
      }
      return out;
    };
    return `XET-${part(4)}-${part(4)}-${part(4)}`;
  }
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

export function isLicenseRevoked(license) {
  return Number(license?.revoked) === 1;
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

export function activateLicense({ licenseKey, channelId, installationId, userAgent, orderNo }) {
  const license = findLicenseByKey(licenseKey);
  if (!license) {
    return { ok: false, code: "INVALID_KEY", message: "激活码无效" };
  }
  if (license.channel_id !== channelId) {
    return { ok: false, code: "CHANNEL_MISMATCH", message: "激活码不适用于本渠道" };
  }
  if (isLicenseRevoked(license)) {
    return { ok: false, code: "REVOKED", message: "该激活码已作废，无法使用" };
  }
  if (isLicenseExpired(license)) {
    return { ok: false, code: "EXPIRED", message: "激活码已过期" };
  }

  const order = normalizeOrder(orderNo);
  if (channelId === COURSE_DL_CHANNEL) {
    if (!order || order.length < 4) {
      return { ok: false, code: "BAD_ORDER", message: "请填写完整订单号" };
    }
    if (license.order_no && license.order_no !== order) {
      return {
        ok: false,
        code: "ORDER_MISMATCH",
        message: "请使用首次激活时填写的订单号",
      };
    }
    const used = getDb()
      .prepare(
        `SELECT license_key FROM licenses
         WHERE channel_id = ? AND order_no = ? AND license_key != ?`
      )
      .get(channelId, order, license.license_key);
    if (used) {
      return {
        ok: false,
        code: "ORDER_USED",
        message: "该订单号已使用过，无法再完成激活",
      };
    }
  }

  const count = countActivations(license.id);
  const existing = getDb()
    .prepare(
      `SELECT id FROM activations WHERE license_id = ? AND installation_id = ?`
    )
    .get(license.id, installationId);

  if (license.single_use && count >= 1 && !existing) {
    return {
      ok: false,
      code: "ALREADY_USED",
      message:
        channelId === COURSE_DL_CHANNEL
          ? "该激活码已在其他设备使用，无法再次激活"
          : "激活码已使用，每个码仅可用一次",
    };
  }

  if (!existing && count >= license.max_devices) {
    return {
      ok: false,
      code: "DEVICE_LIMIT",
      message: `已达设备上限（${license.max_devices} 台）`,
    };
  }

  upsertActivation(license.id, installationId, userAgent);
  if (order && !license.order_no) {
    getDb()
      .prepare(`UPDATE licenses SET order_no = ? WHERE id = ?`)
      .run(order, license.id);
  }

  const activation = getDb()
    .prepare(
      `SELECT created_at, last_seen_at FROM activations
       WHERE license_id = ? AND installation_id = ?`
    )
    .get(license.id, installationId);

  return {
    ok: true,
    channel_id: license.channel_id,
    expires_at: license.expires_at,
    email: license.email,
    max_devices: license.max_devices,
    order_no: license.order_no || order || null,
    activated_at: activation?.created_at || null,
    last_used_at: activation?.last_seen_at || null,
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
  if (isLicenseRevoked(license)) {
    return { active: false, code: "REVOKED" };
  }
  if (isLicenseExpired(license)) {
    return { active: false, code: "EXPIRED", expires_at: license.expires_at };
  }
  const activation = getDb()
    .prepare(
      `SELECT id, created_at, last_seen_at FROM activations
       WHERE license_id = ? AND installation_id = ?`
    )
    .get(license.id, installationId);
  if (!activation) {
    return { active: false, code: "NOT_ACTIVATED" };
  }
  upsertActivation(license.id, installationId, null);
  const refreshed = getDb()
    .prepare(
      `SELECT created_at, last_seen_at FROM activations
       WHERE license_id = ? AND installation_id = ?`
    )
    .get(license.id, installationId);
  return {
    active: true,
    expires_at: license.expires_at,
    channel_id: license.channel_id,
    order_no: license.order_no || null,
    activated_at: refreshed?.created_at || activation.created_at || null,
    last_used_at: refreshed?.last_seen_at || null,
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
            SUM(CASE WHEN (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id) > 0 THEN 1 ELSE 0 END) AS used,
            SUM(CASE WHEN l.sent_at IS NULL AND (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id) = 0 THEN 1 ELSE 0 END) AS unsent,
            SUM(CASE WHEN l.sent_at IS NOT NULL AND (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id) = 0 THEN 1 ELSE 0 END) AS sent_unused
           FROM licenses l WHERE channel_id = ?`
        )
        .get(channelId)
    : getDb()
        .prepare(
          `SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id) = 0 THEN 1 ELSE 0 END) AS unused,
            SUM(CASE WHEN (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id) > 0 THEN 1 ELSE 0 END) AS used,
            SUM(CASE WHEN l.sent_at IS NULL AND (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id) = 0 THEN 1 ELSE 0 END) AS unsent,
            SUM(CASE WHEN l.sent_at IS NOT NULL AND (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id) = 0 THEN 1 ELSE 0 END) AS sent_unused
           FROM licenses l`
        )
        .get();
  return {
    channel_id: channelId || null,
    total: row?.total ?? 0,
    unused: row?.unused ?? 0,
    used: row?.used ?? 0,
    unsent: row?.unsent ?? 0,
    sent_unused: row?.sent_unused ?? 0,
  };
}

const LICENSE_ACTIVATION_COUNT_SQL = `(SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id)`;
const LICENSE_FIRST_ACTIVATED_SQL = `(SELECT MIN(a.created_at) FROM activations a WHERE a.license_id = l.id)`;
const LICENSE_LAST_SEEN_SQL = `(SELECT MAX(a.last_seen_at) FROM activations a WHERE a.license_id = l.id)`;

function unusedOnlyClause(unusedOnly) {
  return unusedOnly ? `AND ${LICENSE_ACTIVATION_COUNT_SQL} = 0` : "";
}

function unsentOnlyClause(unsentOnly) {
  return unsentOnly
    ? `AND l.sent_at IS NULL AND ${LICENSE_ACTIVATION_COUNT_SQL} = 0`
    : "";
}

function mapLicenseRow(row) {
  const activation_count = Number(row.activation_count ?? row.devices_used ?? 0);
  const revoked = Number(row.revoked) === 1;
  return {
    ...row,
    activation_count,
    devices_used: activation_count,
    is_used: activation_count > 0,
    is_sent: Boolean(row.sent_at),
    single_use: Number(row.single_use) === 1,
    revoked,
    first_activated_at: row.first_activated_at || null,
    last_seen_at: row.last_seen_at || null,
    order_no: row.order_no || null,
    sent_at: row.sent_at || null,
  };
}

export function countLicenses(channelId, { unusedOnly = false, unsentOnly = false } = {}) {
  const usedClause = unusedOnlyClause(unusedOnly);
  const sentClause = unsentOnlyClause(unsentOnly);
  const row = channelId
    ? getDb()
        .prepare(
          `SELECT COUNT(*) AS c FROM licenses l WHERE channel_id = ? ${usedClause} ${sentClause}`
        )
        .get(channelId)
    : getDb()
        .prepare(`SELECT COUNT(*) AS c FROM licenses l WHERE 1=1 ${usedClause} ${sentClause}`)
        .get();
  return Number(row?.c ?? 0);
}

export function listLicenses(
  channelId,
  { limit = 50, offset = 0, unusedOnly = false, unsentOnly = false } = {}
) {
  const usedClause = unusedOnlyClause(unusedOnly);
  const sentClause = unsentOnlyClause(unsentOnly);
  const selectSql = `SELECT l.*,
          ${LICENSE_ACTIVATION_COUNT_SQL} AS activation_count,
          ${LICENSE_ACTIVATION_COUNT_SQL} AS devices_used,
          ${LICENSE_FIRST_ACTIVATED_SQL} AS first_activated_at,
          ${LICENSE_LAST_SEEN_SQL} AS last_seen_at
         FROM licenses l`;
  const rows = channelId
    ? getDb()
        .prepare(
          `${selectSql} WHERE channel_id = ? ${usedClause} ${sentClause}
         ORDER BY l.id DESC LIMIT ? OFFSET ?`
        )
        .all(channelId, limit, offset)
    : getDb()
        .prepare(
          `${selectSql} WHERE 1=1 ${usedClause} ${sentClause}
       ORDER BY l.id DESC LIMIT ? OFFSET ?`
        )
        .all(limit, offset);
  return rows.map(mapLicenseRow);
}

/**
 * 仅按 claim_token 查找已发出的码，不新发。
 */
export function findLicenseByClaimToken(channelId, claimToken) {
  if (!channelId || !claimToken) return null;
  return getDb()
    .prepare(`SELECT * FROM licenses WHERE claim_token = ? AND channel_id = ?`)
    .get(claimToken, channelId);
}

/**
 * 发货页领取：已有 claim_token 则返回原码；否则取一条未发未激活码并标记已发。
 * @returns {{ ok: true, license_key: string, channel_id: string, claim_token: string, reused: boolean }
 *   | { ok: false, code: string, message: string }}
 */
export function claimDeliveryLicense(channelId, { existingToken } = {}) {
  if (!channelId) {
    return { ok: false, code: "BAD_CHANNEL", message: "渠道无效" };
  }
  const db = getDb();

  if (existingToken) {
    const existing = findLicenseByClaimToken(channelId, existingToken);
    if (existing) {
      return {
        ok: true,
        license_key: existing.license_key,
        channel_id: existing.channel_id,
        claim_token: existing.claim_token,
        reused: true,
      };
    }
  }

  const claim = db.transaction(() => {
    const row = db
      .prepare(
        `SELECT l.id, l.license_key FROM licenses l
         WHERE l.channel_id = ?
           AND l.sent_at IS NULL
           AND ${LICENSE_ACTIVATION_COUNT_SQL} = 0
         ORDER BY l.id ASC
         LIMIT 1`
      )
      .get(channelId);
    if (!row) return null;

    const token = crypto.randomBytes(24).toString("hex");
    const result = db
      .prepare(
        `UPDATE licenses
         SET sent_at = datetime('now'), claim_token = ?
         WHERE id = ? AND sent_at IS NULL`
      )
      .run(token, row.id);
    if (result.changes !== 1) return null;

    return {
      license_key: row.license_key,
      channel_id: channelId,
      claim_token: token,
    };
  });

  const claimed = claim();
  if (!claimed) {
    return {
      ok: false,
      code: "OUT_OF_STOCK",
      message: "激活码暂时发完，请联系客服补发",
    };
  }
  return { ok: true, ...claimed, reused: false };
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
  const key = licenseKey || generateLicenseKey(channelId);
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
    const licenseKey = generateLicenseKey(channelId);
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

export function revokeLicense(licenseKey) {
  const license = findLicenseByKey(licenseKey);
  if (!license) {
    return { ok: false, code: "NOT_FOUND", message: "激活码不存在" };
  }
  getDb().prepare(`UPDATE licenses SET revoked = 1 WHERE id = ?`).run(license.id);
  return { ok: true, message: "已作废，该设备联网后将无法使用" };
}

export function unbindLicense(licenseKey) {
  const license = findLicenseByKey(licenseKey);
  if (!license) {
    return { ok: false, code: "NOT_FOUND", message: "激活码不存在" };
  }
  if (isLicenseRevoked(license)) {
    return { ok: false, code: "REVOKED", message: "已作废的码不能解绑，请发新码" };
  }
  getDb().prepare(`DELETE FROM activations WHERE license_id = ?`).run(license.id);
  return {
    ok: true,
    message: "已解绑设备。可用同一订单号在新机器上重新激活该码",
    order_no: license.order_no || null,
  };
}

const COURSE_DL_CONFIG_KEYS = {
  download_mac_url: "course_dl_download_mac_url",
  download_win_url: "course_dl_download_win_url",
  guide_video_url: "course_dl_guide_video_url",
};

function getSetting(key) {
  const row = getDb().prepare(`SELECT value FROM admin_settings WHERE key = ?`).get(key);
  return row?.value != null ? String(row.value) : "";
}

function setSetting(key, value) {
  getDb()
    .prepare(
      `INSERT INTO admin_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, String(value ?? ""));
}

export function getCourseDlConfig() {
  return {
    download_mac_url: getSetting(COURSE_DL_CONFIG_KEYS.download_mac_url),
    download_win_url: getSetting(COURSE_DL_CONFIG_KEYS.download_win_url),
    guide_video_url: getSetting(COURSE_DL_CONFIG_KEYS.guide_video_url),
  };
}

export function setCourseDlConfig(body = {}) {
  for (const [field, key] of Object.entries(COURSE_DL_CONFIG_KEYS)) {
    if (body[field] === undefined) continue;
    setSetting(key, body[field]);
  }
  return getCourseDlConfig();
}

const VERIFY_ERRORS = {
  INVALID_KEY: "激活码无效",
  CHANNEL_MISMATCH: "激活码不适用于本软件",
  REVOKED: "激活码已作废，软件已停用",
  EXPIRED: "激活码已过期",
  NOT_ACTIVATED: "尚未激活",
};

export function activateCourseDl({ code, deviceId, orderNo, userAgent }) {
  const licenseKey = String(code || "").trim().toUpperCase();
  const installationId = String(deviceId || "")
    .trim()
    .toUpperCase();
  if (!licenseKey || !installationId || !normalizeOrder(orderNo)) {
    return { ok: false, error: "请填写激活码、机器码和订单号", message: "请填写激活码、机器码和订单号" };
  }
  const result = activateLicense({
    licenseKey,
    channelId: COURSE_DL_CHANNEL,
    installationId,
    userAgent,
    orderNo,
  });
  if (!result.ok) {
    const msg = result.message || "激活失败";
    return { ...result, error: msg };
  }
  return {
    ok: true,
    message: "激活成功",
    code: licenseKey,
    device_id: installationId,
    order_no: result.order_no,
    activated_at: result.activated_at,
  };
}

export function verifyCourseDl({ code, deviceId }) {
  const licenseKey = String(code || "").trim().toUpperCase();
  const installationId = String(deviceId || "")
    .trim()
    .toUpperCase();
  if (!licenseKey || !installationId) {
    return { ok: false, valid: false, error: "缺少激活码或机器码", message: "缺少激活码或机器码" };
  }
  const status = checkLicense({
    licenseKey,
    channelId: COURSE_DL_CHANNEL,
    installationId,
  });
  if (!status.active) {
    const msg = VERIFY_ERRORS[status.code] || "校验失败";
    const http =
      status.code === "INVALID_KEY" ? 404 : status.code === "REVOKED" ? 403 : 403;
    return {
      ok: false,
      valid: false,
      error: msg,
      message: msg,
      code: status.code,
      http,
    };
  }
  return {
    ok: true,
    valid: true,
    code: licenseKey,
    device_id: installationId,
    order_no: status.order_no,
    activated_at: status.activated_at,
    last_used_at: status.last_used_at,
  };
}

