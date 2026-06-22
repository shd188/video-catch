import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getLatestRelease } from "./releases.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_CHANNELS_DIR = path.join(__dirname, "..", "..", "channels");

/** 各渠道落地页文案与主题（UI 层，与 channel.json 互补） */
const LANDING_COPY = {
  xiaoetong: {
    theme: "xiaoetong",
    heroTitle: "小鹅通课程视频",
    heroHighlight: "本地备份下载",
    heroSubtitle:
      "专为小鹅通 H5 / PC 课程页打造的 Chrome 扩展。在白名单站点自动嗅探回放与点播，合并保存到电脑，学习资料不再过期丢失。",
    badge: "小鹅通渠道专版",
    features: [
      {
        title: "站点白名单",
        desc: "仅在小鹅通相关域名工作，H5 直播、PC 视频课均可覆盖，其它网站默认不嗅探。",
        icon: "shield",
      },
      {
        title: "m3u8 一键合并",
        desc: "解析器默认在线 FFmpeg 转码，长课程也能稳定合并为可播放文件。",
        icon: "film",
      },
      {
        title: "激活与更新",
        desc: "每设备激活一次即可；后续版本升级覆盖原目录，无需重新输入激活码。",
        icon: "key",
      },
      {
        title: "本地优先",
        desc: "嗅探与下载在浏览器本机完成，不上传页面内容与视频文件。",
        icon: "lock",
      },
    ],
    steps: [
      { title: "安装扩展", desc: "解压渠道包，在 chrome://extensions 加载已解压文件夹。" },
      { title: "激活授权", desc: "首次打开说明页，输入服务商提供的激活码。" },
      { title: "播放并下载", desc: "打开课程页播放视频，点击扩展图标合并下载。" },
    ],
    sites: [
      "H5 店铺 *.h5.xiaoeknow.com",
      "PC 视频课 *.xet-pc.citv.cn",
      "PC 官方域 *.pc.xiaoe-tech.com",
      "学员版 study.xiaoe-tech.com",
    ],
  },
  tencentmeeting: {
    theme: "tencentmeeting",
    heroTitle: "腾讯会议回放",
    heroHighlight: "本地保存",
    heroSubtitle:
      "面向腾讯会议 Web 回放的专用扩展。在 meeting.tencent.com 白名单内嗅探媒体流，方便已授权用户备份学习与复盘资料。",
    badge: "腾讯会议渠道专版",
    features: [
      {
        title: "回放页专用",
        desc: "锁定 meeting.tencent.com 及子域，只在会议回放场景启用嗅探。",
        icon: "shield",
      },
      {
        title: "m3u8 一键合并",
        desc: "支持回放常见流媒体格式，解析器内完成合并与转码。",
        icon: "film",
      },
      {
        title: "独立扩展",
        desc: "与小鹅通渠道包相互独立，可同时安装、各自激活。",
        icon: "layers",
      },
      {
        title: "合规提醒",
        desc: "仅限自有或已获授权的回放内容；请遵守平台服务条款与著作权法。",
        icon: "scale",
      },
    ],
    steps: [
      { title: "安装扩展", desc: "加载 tencentmeeting 文件夹，与小鹅通包路径分开即可。" },
      { title: "激活授权", desc: "使用腾讯会议渠道激活码，每设备首次激活一次。" },
      { title: "打开回放", desc: "在浏览器打开会议回放页，播放后从 Popup 下载。" },
    ],
    sites: ["meeting.tencent.com", "*.meeting.tencent.com 子域"],
  },
};

function listRepoChannelIds() {
  if (!fs.existsSync(REPO_CHANNELS_DIR)) return [];
  return fs
    .readdirSync(REPO_CHANNELS_DIR)
    .filter((name) => {
      if (name.startsWith("_") || name.startsWith(".")) return false;
      return fs.existsSync(path.join(REPO_CHANNELS_DIR, name, "channel.json"));
    })
    .sort();
}

function readChannelJson(channelId) {
  const cfgPath = path.join(REPO_CHANNELS_DIR, channelId, "channel.json");
  if (!fs.existsSync(cfgPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  } catch {
    return null;
  }
}

function iconUrl(channelId, publicBaseUrl) {
  const iconPath = path.join(REPO_CHANNELS_DIR, channelId, "icons", "icon128.png");
  if (!fs.existsSync(iconPath)) return null;
  const base = publicBaseUrl.replace(/\/$/, "");
  return `${base}/landing/icons/${channelId}.png`;
}

function buildChannelPayload(channelId, publicBaseUrl) {
  const cfg = readChannelJson(channelId);
  if (!cfg) return null;
  const copy = LANDING_COPY[channelId] || {
    theme: channelId,
    heroTitle: cfg.displayName || channelId,
    heroHighlight: "视频下载",
    heroSubtitle: cfg.description || "",
    badge: cfg.channelNameZh || cfg.displayName || channelId,
    features: [],
    steps: [],
    sites: [],
  };
  const latest = getLatestRelease(channelId);
  const base = publicBaseUrl.replace(/\/$/, "");
  return {
    id: channelId,
    displayName: cfg.displayName || cfg.channelNameZh || channelId,
    channelNameZh: cfg.channelNameZh || null,
    description: cfg.description || "",
    repositoryUrl: cfg.repositoryUrl || cfg.manifest?.homepage_url || null,
    latestVersion: latest?.version || null,
    releaseNotes: latest?.release_notes || null,
    guideUrl: `${base}/guide/`,
    landingUrl: `${base}/landing/${channelId}/`,
    iconUrl: iconUrl(channelId, publicBaseUrl),
    zipName: `${channelId}.zip`,
    ...copy,
  };
}

export function listLandingChannels(publicBaseUrl) {
  return listRepoChannelIds()
    .map((id) => buildChannelPayload(id, publicBaseUrl))
    .filter(Boolean);
}

export function getLandingChannel(channelId, publicBaseUrl) {
  return buildChannelPayload(String(channelId).trim(), publicBaseUrl);
}

export function resolveLandingIconPath(channelId) {
  const safe = String(channelId).replace(/[^a-z0-9_-]/gi, "");
  const iconPath = path.join(REPO_CHANNELS_DIR, safe, "icons", "icon128.png");
  if (!fs.existsSync(iconPath)) return null;
  return iconPath;
}

export function isKnownLandingChannel(channelId) {
  return !!readChannelJson(channelId);
}
