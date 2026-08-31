import crypto from "crypto";
import { getDb } from "./db.js";
import { getAdminChannelList } from "./admin-channels.js";

const PAN_KEY_PREFIX = "delivery_pan_";
const SLUG_KEY_PREFIX = "delivery_slug_";

/** @type {Map<string, { count: number, day: string }>} */
const claimRate = new Map();
/** @type {Map<string, { count: number, day: string }>} */
const packageRate = new Map();

export function deliveryChannelAllowed(channelId, adminChannelsEnv, labelOverridesEnv) {
  if (!channelId) return false;
  const list = getAdminChannelList(adminChannelsEnv, labelOverridesEnv);
  return list.some((c) => c.id === channelId);
}

function newDeliverySlug() {
  return crypto.randomBytes(24).toString("hex");
}

function setSetting(key, value) {
  getDb()
    .prepare(
      `INSERT INTO admin_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, value);
}

function getSetting(key) {
  const row = getDb().prepare(`SELECT value FROM admin_settings WHERE key = ?`).get(key);
  return row?.value != null ? String(row.value) : null;
}

/** 读取已有 slug；没有则生成并写入 */
export function ensureDeliverySlug(channelId) {
  if (!channelId) return null;
  const key = `${SLUG_KEY_PREFIX}${channelId}`;
  const existing = getSetting(key);
  if (existing && /^[a-f0-9]{32,}$/i.test(existing)) return existing;
  const slug = newDeliverySlug();
  setSetting(key, slug);
  return slug;
}

/** 用 slug 反查渠道 ID；无效返回 null */
export function getChannelIdBySlug(slug) {
  const token = String(slug || "").trim();
  if (!token || !/^[a-f0-9]{32,}$/i.test(token)) return null;
  const row = getDb()
    .prepare(
      `SELECT key FROM admin_settings WHERE key LIKE ? AND value = ? COLLATE NOCASE LIMIT 1`
    )
    .get(`${SLUG_KEY_PREFIX}%`, token);
  if (!row?.key || !String(row.key).startsWith(SLUG_KEY_PREFIX)) return null;
  return String(row.key).slice(SLUG_KEY_PREFIX.length);
}

/** 轮换 slug，旧链接立即失效 */
export function rotateDeliverySlug(channelId) {
  if (!channelId) return null;
  const slug = newDeliverySlug();
  setSetting(`${SLUG_KEY_PREFIX}${channelId}`, slug);
  return slug;
}

export function getDeliverySlug(channelId) {
  if (!channelId) return null;
  return getSetting(`${SLUG_KEY_PREFIX}${channelId}`);
}

export function listDeliverySlugs(channelIds) {
  return (channelIds || []).map((id) => ({
    channel_id: id,
    slug: ensureDeliverySlug(id),
  }));
}

export function deliveryPageUrl(baseUrl, slug) {
  const base = String(baseUrl || "").replace(/\/$/, "");
  return `${base}/d/${slug}`;
}

export function getDeliveryPan(channelId) {
  const row = getDb()
    .prepare(`SELECT value FROM admin_settings WHERE key = ?`)
    .get(`${PAN_KEY_PREFIX}${channelId}`);
  if (!row?.value) return { url: "", code: "" };
  try {
    const parsed = JSON.parse(row.value);
    return {
      url: String(parsed.url || "").trim(),
      code: String(parsed.code || "").trim(),
    };
  } catch {
    return { url: "", code: "" };
  }
}

export function setDeliveryPan(channelId, { url, code } = {}) {
  const payload = JSON.stringify({
    url: String(url || "").trim(),
    code: String(code || "").trim(),
  });
  getDb()
    .prepare(
      `INSERT INTO admin_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(`${PAN_KEY_PREFIX}${channelId}`, payload);
  return getDeliveryPan(channelId);
}

export function listDeliveryPanConfigs(channelIds) {
  return (channelIds || []).map((id) => ({
    channel_id: id,
    pan: getDeliveryPan(id),
  }));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function bumpRate(store, ip, channelId, maxPerDay, message) {
  const day = todayKey();
  const key = `${ip || "unknown"}:${channelId}:${day}`;
  const cur = store.get(key);
  if (!cur || cur.day !== day) {
    store.set(key, { count: 0, day });
  }
  const entry = store.get(key);
  if (entry.count >= maxPerDay) {
    return { ok: false, code: "RATE_LIMIT", message };
  }
  entry.count += 1;
  return { ok: true };
}

/** @returns {{ ok: true } | { ok: false, code: string, message: string }} */
export function checkClaimRateLimit(ip, channelId, { maxPerDay = 20 } = {}) {
  return bumpRate(
    claimRate,
    ip,
    channelId,
    maxPerDay,
    "领取过于频繁，请稍后再试或联系客服"
  );
}

/** @returns {{ ok: true } | { ok: false, code: string, message: string }} */
export function checkPackageDownloadRateLimit(ip, channelId, { maxPerDay = 40 } = {}) {
  return bumpRate(
    packageRate,
    ip,
    channelId,
    maxPerDay,
    "下载过于频繁，请稍后再试"
  );
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function claimCookieName(channelId) {
  return `vc_claim_${channelId}`;
}

export function newClaimToken() {
  return crypto.randomBytes(24).toString("hex");
}
