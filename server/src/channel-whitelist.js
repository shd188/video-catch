import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_CHANNELS_DIR = path.join(__dirname, "..", "..", "channels");

const HOST_RE = /^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const BROAD_HOST_RE = /^(?:\*\.)?(?:com|net|org|cn|xyz|top|cc|io|co)$/i;

/** Normalize admin input to `https://host/*` (host may start with `*.`). */
export function normalizeWhitelistPattern(input) {
  let s = String(input || "").trim().toLowerCase();
  if (!s) {
    throw new Error("请填写域名，例如 *.caomaoweilai.com");
  }
  if (/^(javascript|data|file):/i.test(s)) {
    throw new Error("不支持该协议");
  }
  s = s.replace(/^https?:\/\//i, "");
  const host = s.split("/")[0].split(":")[0].replace(/\.$/, "");
  if (!host || host === "*" || host === "*.*" || host.includes("*") && !host.startsWith("*.")) {
    throw new Error("域名格式不正确，例如 *.caomaoweilai.com 或 www.example.com");
  }
  if (host.startsWith("*.") && host.includes("*", 2)) {
    throw new Error("只允许在最左侧使用 *，例如 *.example.com");
  }
  if (!HOST_RE.test(host) || BROAD_HOST_RE.test(host)) {
    throw new Error("域名格式不正确，例如 *.caomaoweilai.com 或 www.example.com");
  }
  return `https://${host}/*`;
}

export function listChannelWhitelist(channelId) {
  return getDb()
    .prepare(
      `SELECT id, channel_id, url, comment, created_at
       FROM channel_whitelist
       WHERE channel_id = ?
       ORDER BY id ASC`
    )
    .all(channelId);
}

export function getChannelWhitelistPatterns(channelId) {
  return listChannelWhitelist(channelId).map((row) => ({
    url: row.url,
    state: true,
  }));
}

export function addChannelWhitelist({ channelId, url, comment }) {
  const pattern = normalizeWhitelistPattern(url);
  const note = String(comment || "").trim() || null;
  try {
    const result = getDb()
      .prepare(
        `INSERT INTO channel_whitelist (channel_id, url, comment) VALUES (?, ?, ?)`
      )
      .run(channelId, pattern, note);
    return {
      id: Number(result.lastInsertRowid),
      channel_id: channelId,
      url: pattern,
      comment: note,
    };
  } catch (err) {
    if (String(err?.message || "").includes("UNIQUE")) {
      throw new Error("该规则已存在");
    }
    throw err;
  }
}

export function deleteChannelWhitelist(id, channelId) {
  const row = getDb()
    .prepare(`SELECT id FROM channel_whitelist WHERE id = ? AND channel_id = ?`)
    .get(id, channelId);
  if (!row) {
    throw new Error("规则不存在");
  }
  getDb().prepare(`DELETE FROM channel_whitelist WHERE id = ?`).run(id);
  return { ok: true, id };
}

export function getBuiltInBlockUrl(channelId) {
  const cfgPath = path.join(REPO_CHANNELS_DIR, channelId, "channel.json");
  if (!fs.existsSync(cfgPath)) return [];
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    const list = cfg?.optionLists?.blockUrl;
    if (!Array.isArray(list)) return [];
    return list
      .filter((item) => item && item.state !== false && item.url)
      .map((item) => ({
        url: String(item.url),
        comment: item.comment || "",
      }));
  } catch {
    return [];
  }
}

export function channelUsesWhitelist(channelId) {
  const cfgPath = path.join(REPO_CHANNELS_DIR, channelId, "channel.json");
  if (!fs.existsSync(cfgPath)) return true;
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    return cfg?.optionLists?.blockUrlWhite === true;
  } catch {
    return true;
  }
}
