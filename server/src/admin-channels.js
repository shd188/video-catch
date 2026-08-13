import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDb, getReleasesDir } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_CHANNELS_DIR = path.join(__dirname, "..", "..", "channels");

const LABEL_FALLBACK = {
  xiaoetong: "小鹅通",
  tencentmeeting: "腾讯会议",
  feishu: "飞书",
  quanneng: "全能",
  "course-dl": "课程下载器",
};

const DEFAULT_CHANNEL_IDS = ["xiaoetong", "tencentmeeting", "feishu", "quanneng", "course-dl"];

function parseLabelOverrides(envValue) {
  const map = new Map();
  if (!envValue) return map;
  for (const part of String(envValue).split(",")) {
    const [id, label] = part.split(":").map((s) => s.trim());
    if (id && label) map.set(id, label);
  }
  return map;
}

function parseChannelIds(envValue) {
  return String(envValue || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function listRepoChannelIds() {
  const ids = [];
  if (!fs.existsSync(REPO_CHANNELS_DIR)) return ids;
  for (const name of fs.readdirSync(REPO_CHANNELS_DIR)) {
    if (name.startsWith("_") || name.startsWith(".")) continue;
    if (fs.existsSync(path.join(REPO_CHANNELS_DIR, name, "channel.json"))) {
      ids.push(name);
    }
  }
  return ids;
}

function listDirChannelIds(dir) {
  const ids = [];
  if (!dir || !fs.existsSync(dir)) return ids;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith("_") || name.startsWith(".")) continue;
    try {
      if (fs.statSync(path.join(dir, name)).isDirectory()) ids.push(name);
    } catch {
      /* ignore */
    }
  }
  return ids;
}

function listDbChannelIds() {
  try {
    return getDb()
      .prepare(
        `SELECT channel_id AS id FROM releases
         UNION
         SELECT channel_id AS id FROM licenses`
      )
      .all()
      .map((r) => r.id)
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** 合并 .env、仓库 channels/、发布目录、数据库中的渠道 ID */
export function collectAdminChannelIds(adminChannelsEnv) {
  const set = new Set(DEFAULT_CHANNEL_IDS);
  for (const id of parseChannelIds(adminChannelsEnv)) set.add(id);
  for (const id of listRepoChannelIds()) set.add(id);
  for (const id of listDirChannelIds(getReleasesDir())) set.add(id);
  for (const id of listDbChannelIds()) set.add(id);
  return [...set].sort();
}

function labelFromChannelJson(channelId) {
  const cfgPath = path.join(REPO_CHANNELS_DIR, channelId, "channel.json");
  if (!fs.existsSync(cfgPath)) return null;
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    return cfg.channelNameZh || cfg.displayName || null;
  } catch {
    return null;
  }
}

/** @returns {{ id: string, label: string }[]} */
export function getAdminChannelList(adminChannelsEnv, labelOverridesEnv) {
  const ids = collectAdminChannelIds(adminChannelsEnv);
  const overrides = parseLabelOverrides(labelOverridesEnv);
  return ids.map((id) => {
    const label =
      overrides.get(id) ||
      labelFromChannelJson(id) ||
      LABEL_FALLBACK[id] ||
      id;
    return { id, label };
  });
}
