import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_CHANNELS_DIR = path.join(__dirname, "..", "..", "channels");

const LABEL_FALLBACK = {
  xiaoetong: "小鹅通",
  tencentmeeting: "腾讯会议",
};

function parseLabelOverrides(envValue) {
  const map = new Map();
  if (!envValue) return map;
  for (const part of String(envValue).split(",")) {
    const [id, label] = part.split(":").map((s) => s.trim());
    if (id && label) map.set(id, label);
  }
  return map;
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
  const ids = String(adminChannelsEnv || "xiaoetong")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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
