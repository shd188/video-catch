import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import {
  activateLicense,
  checkLicense,
  hasInstallActivatedOnChannel,
  createLicense,
  createLicensesBulk,
  licenseStats,
  listLicenses,
  countLicenses,
} from "./licenses.js";
import {
  REDEEM_PACKS,
  createRedeemCode,
  createRedeemCodesBulk,
  redeemCodeStats,
  listRedeemCodes,
  countRedeemCodes,
  syncRedeemRemaining,
} from "./redeem-codes.js";
import { getSphDlConfig } from "./sph-dl-client.js";
import { isVersionNewer } from "./version.js";
import {
  getReleaseFilePath,
  getLatestRelease,
  buildDownloadUrl,
  createRelease,
  deleteRelease,
  listReleases,
  registerRelease,
  sanitizeReleaseFilename,
  releaseDownloadFilename,
} from "./releases.js";
import { getReleasesDir } from "./db.js";
import {
  changeAdminPassword,
  ensureAdminPasswordReady,
  hasConfiguredPassword,
  verifyAdminKey,
} from "./admin-auth.js";
import { getAdminChannelList } from "./admin-channels.js";
import { resolveUserGuidePath } from "./user-guide.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const app = express();
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";
const ADMIN_CHANNELS = (process.env.ADMIN_CHANNELS || "quanneng,xiaoetong,tencentmeeting,feishu")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const ADMIN_CHANNEL_LABELS = process.env.ADMIN_CHANNEL_LABELS || "";

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "64kb" }));

function releaseUploadMeta(req) {
  const channelId = String(req.body?.channel_id || req.query?.channel_id || "").trim();
  const version = String(req.body?.version || req.query?.version || "").trim();
  return { channelId, version };
}

const upload = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      const { channelId } = releaseUploadMeta(req);
      const channel = channelId || "default";
      const dir = path.join(getReleasesDir(), channel);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(req, file, cb) {
      const { channelId, version } = releaseUploadMeta(req);
      const base = sanitizeReleaseFilename(file.originalname);
      const name = base.endsWith(".zip") ? base : `${base}.zip`;
      cb(null, `${channelId || "app"}-${version || "0"}-${name}`);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "cat-catch-license-server" });
});

app.get("/", (_req, res) => {
  res.redirect(302, "/guide/");
});

const adminDir = path.join(publicDir, "admin");
function sendAdminIndex(_req, res) {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(adminDir, "index.html"));
}
app.get(["/admin", "/admin/", "/admin/index.html"], sendAdminIndex);
app.use(
  "/admin",
  express.static(adminDir, {
    index: false,
    redirect: false,
    maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

const guideDir = path.join(publicDir, "guide");
function sendUserGuidePage(_req, res) {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(guideDir, "index.html"));
}
app.get(["/guide", "/guide/", "/guide/index.html"], sendUserGuidePage);
app.get("/guide/content.md", (_req, res) => {
  const filePath = resolveUserGuidePath(publicDir);
  if (!filePath) {
    return res.status(404).type("text/plain; charset=utf-8").send("用户说明文档未找到");
  }
  res.setHeader("Cache-Control", "no-cache");
  res.type("text/markdown; charset=utf-8");
  res.sendFile(path.resolve(filePath));
});
app.use(
  "/guide",
  express.static(guideDir, {
    index: false,
    redirect: false,
    maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".mp4")) {
        res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      }
    },
  })
);

app.post("/api/v1/activate", (req, res) => {
  const { license_key, channel_id, installation_id, user_agent } = req.body || {};
  if (!license_key || !channel_id || !installation_id) {
    return res.status(400).json({ ok: false, message: "缺少参数" });
  }
  const result = activateLicense({
    licenseKey: String(license_key).trim(),
    channelId: String(channel_id).trim(),
    installationId: String(installation_id).trim(),
    userAgent: user_agent,
  });
  res.status(result.ok ? 200 : 403).json(result);
});

app.post("/api/v1/check", (req, res) => {
  const { license_key, channel_id, installation_id, current_version, strict } = req.body || {};
  if (!channel_id || !installation_id) {
    return res.status(400).json({ active: false, message: "缺少参数" });
  }
  const channelId = String(channel_id).trim();
  const installationId = String(installation_id).trim();
  const licenseKey = String(license_key || "").trim();
  const strictMode = strict === true || strict === 1 || strict === "1";
  const everActivated = hasInstallActivatedOnChannel(installationId, channelId);

  let status;
  if (licenseKey) {
    status = checkLicense({ licenseKey, channelId, installationId });
  } else if (!strictMode && everActivated) {
    status = { active: true, ever_activated: true, code: "EVER_ACTIVATED" };
  } else {
    status = { active: false, code: "NO_KEY" };
  }

  const updatesAllowed = status.active || (!strictMode && everActivated);
  const latest = getLatestRelease(channelId);
  const manifestVersion = current_version || null;
  let update_available = false;
  if (latest && updatesAllowed && manifestVersion) {
    update_available = isVersionNewer(latest.version, manifestVersion);
  }
  const payload = {
    ...status,
    strict: strictMode,
    ever_activated: everActivated,
    updates_allowed: updatesAllowed,
    current_version: manifestVersion,
    latest_version: latest?.version || null,
    release_notes: latest?.release_notes || null,
    update_available,
  };
  if (latest && updatesAllowed && update_available) {
    payload.download_url = buildDownloadUrl(
      PUBLIC_BASE_URL,
      channelId,
      latest.version,
      licenseKey,
      installationId,
      { strict: strictMode }
    );
  }
  res.json(payload);
});

app.get("/api/v1/download", (req, res) => {
  const license_key = String(req.query.key || "");
  const channel_id = String(req.query.channel || "");
  const version = String(req.query.version || "");
  const installation_id = String(req.query.installation_id || "");
  const strictMode = req.query.strict === "true" || req.query.strict === "1";
  const everActivated = hasInstallActivatedOnChannel(installation_id, channel_id);
  let allowed = !strictMode && everActivated;
  if (license_key) {
    const status = checkLicense({
      licenseKey: license_key,
      channelId: channel_id,
      installationId: installation_id,
    });
    allowed = status.active || (!strictMode && everActivated);
  }
  if (!allowed) {
    return res.status(403).send("License not active");
  }
  const filePath = getReleaseFilePath(channel_id, version);
  if (!filePath) {
    return res.status(404).send("Release file not found");
  }
  res.download(filePath, releaseDownloadFilename(channel_id));
});

function adminAuth(req, res, next) {
  const key = req.headers["x-admin-key"] || req.query.admin_key;
  if (!verifyAdminKey(key)) {
    return res.status(401).json({ ok: false, message: "登录密码不正确" });
  }
  next();
}

ensureAdminPasswordReady();

app.get("/api/admin/ping", adminAuth, (_req, res) => {
  res.json({ ok: true, password_stored: hasConfiguredPassword() });
});

app.post("/api/admin/password", adminAuth, (req, res) => {
  try {
    const newPassword = req.body?.new_password;
    changeAdminPassword(newPassword);
    res.json({ ok: true, message: "登录密码已更新，请使用新密码重新登录" });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

app.get("/api/admin/channels", adminAuth, (_req, res) => {
  res.json({
    ok: true,
    channels: getAdminChannelList(ADMIN_CHANNELS.join(","), ADMIN_CHANNEL_LABELS),
  });
});

app.get("/api/admin/releases/download", adminAuth, (req, res) => {
  const channelId = String(req.query.channel_id || "").trim();
  const version = String(req.query.version || "").trim();
  if (!channelId || !version) {
    return res.status(400).json({ ok: false, message: "请指定 channel_id 与 version" });
  }
  const filePath = getReleaseFilePath(channelId, version);
  if (!filePath) {
    return res.status(404).json({
      ok: false,
      message: `版本文件不存在（${channelId} / ${version}），请重新上传 zip`,
    });
  }
  const name = releaseDownloadFilename(channelId);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.sendFile(path.resolve(filePath), (err) => {
    if (err) {
      console.error("[admin] release download failed:", filePath, err.message);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, message: "发送文件失败，请查看服务器日志" });
      }
    }
  });
});

app.get("/api/admin/licenses/stats", adminAuth, (req, res) => {
  const channelId = req.query.channel_id ? String(req.query.channel_id).trim() : null;
  if (!channelId) {
    return res.status(400).json({ ok: false, message: "请指定 channel_id" });
  }
  res.json({ ok: true, stats: licenseStats(channelId) });
});

app.get("/api/admin/licenses", adminAuth, (req, res) => {
  const channelId = req.query.channel_id ? String(req.query.channel_id) : null;
  const unusedOnly = req.query.unused === "1";
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.page_size, 10) || 50, 1), 200);
  const offset = (page - 1) * pageSize;
  const total = countLicenses(channelId, { unusedOnly });
  const licenses = listLicenses(channelId, { limit: pageSize, offset, unusedOnly });
  res.json({
    ok: true,
    licenses,
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
});

app.post("/api/admin/licenses", adminAuth, (req, res) => {
  try {
    const singleUse = req.body.single_use !== false && req.body.single_use !== 0;
    const row = createLicense({
      channelId: req.body.channel_id,
      email: req.body.email,
      maxDevices: singleUse ? 1 : (req.body.max_devices ?? 2),
      singleUse,
      expiresAt: req.body.expires_at,
      note: req.body.note,
      licenseKey: req.body.license_key,
    });
    res.json({ ok: true, license: row });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

app.post("/api/admin/licenses/bulk", adminAuth, (req, res) => {
  try {
    const result = createLicensesBulk({
      channelId: req.body.channel_id,
      count: req.body.count ?? 100,
      expiresAt: req.body.expires_at,
      note: req.body.note,
      singleUse: req.body.single_use !== false,
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

app.get("/api/admin/redeem-codes/stats", adminAuth, (req, res) => {
  const pack = req.query.pack != null && req.query.pack !== "" ? Number(req.query.pack) : null;
  const sph = getSphDlConfig();
  res.json({
    ok: true,
    stats: redeemCodeStats({ pack }),
    packs: REDEEM_PACKS,
    sph_dl_configured: !!(sph.apiBase && sph.adminToken),
  });
});

app.get("/api/admin/redeem-codes", adminAuth, async (req, res) => {
  try {
    const pack = req.query.pack != null && req.query.pack !== "" ? Number(req.query.pack) : null;
    const status = req.query.status ? String(req.query.status).trim() : "";
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.page_size, 10) || 50, 1), 200);
    const offset = (page - 1) * pageSize;
    const sync = req.query.sync === "1" || req.query.sync === "true";
    let codes = listRedeemCodes({ pack, status, limit: pageSize, offset });
    let syncResult = null;
    if (sync && codes.length) {
      syncResult = await syncRedeemRemaining(codes.map((c) => c.code));
      codes = listRedeemCodes({ pack, status, limit: pageSize, offset });
    }
    const total = countRedeemCodes({ pack, status });
    const sph = getSphDlConfig();
    res.json({
      ok: true,
      packs: REDEEM_PACKS,
      codes,
      sync: syncResult,
      sph_dl_configured: !!(sph.apiBase && sph.adminToken),
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post("/api/admin/redeem-codes", adminAuth, async (req, res) => {
  try {
    const row = await createRedeemCode({
      pack: req.body.pack,
      note: req.body.note,
    });
    res.json({ ok: true, code: row });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

app.post("/api/admin/redeem-codes/bulk", adminAuth, async (req, res) => {
  try {
    const result = await createRedeemCodesBulk({
      pack: req.body.pack,
      count: req.body.count ?? 10,
      note: req.body.note,
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

app.get("/api/admin/releases", adminAuth, (req, res) => {
  const channelId = req.query.channel_id ? String(req.query.channel_id) : null;
  res.json({ ok: true, releases: listReleases(channelId) });
});

app.post("/api/admin/releases", adminAuth, (req, res) => {
  try {
    const row = createRelease({
      channelId: req.body.channel_id,
      version: req.body.version,
      filename: req.body.filename,
      releaseNotes: req.body.release_notes,
    });
    res.json({ ok: true, release: row });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

app.delete("/api/admin/releases", adminAuth, (req, res) => {
  try {
    const channelId = String(req.body?.channel_id || req.query?.channel_id || "").trim();
    const version = String(req.body?.version || req.query?.version || "").trim();
    if (!channelId || !version) {
      return res.status(400).json({ ok: false, message: "请指定 channel_id 与 version" });
    }
    const removed = deleteRelease({ channelId, version, removeFile: true });
    res.json({ ok: true, removed });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

app.post("/api/admin/releases/upload", adminAuth, upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: "请上传 zip 文件" });
    }
    const { channelId, version } = releaseUploadMeta(req);
    if (!channelId || !version) {
      return res.status(400).json({ ok: false, message: "请填写渠道与版本号" });
    }
    const row = registerRelease({
      channelId,
      version,
      filename: req.file.filename,
      releaseNotes: req.body.release_notes,
    });
    res.json({ ok: true, release: row });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

const server = app.listen(PORT, HOST, () => {
  fs.mkdirSync(getReleasesDir(), { recursive: true });
  console.log(`License server http://${HOST}:${PORT}`);
  const base = PUBLIC_BASE_URL.replace(/\/$/, "");
  console.log(`Admin UI: ${base}/admin/`);
  console.log(`User guide: ${base}/guide/`);
  console.log(`PUBLIC_BASE_URL=${PUBLIC_BASE_URL}`);
  if (!ADMIN_API_KEY || ADMIN_API_KEY === "change-me-to-a-long-random-string") {
    console.warn("WARN: Set a strong ADMIN_API_KEY in .env");
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n端口 ${PORT} 已被占用。请先结束旧进程，再启动：`);
    console.error(`  lsof -i :${PORT}`);
    console.error(`  kill <PID>\n`);
    console.error("或修改 .env 中的 PORT=8788，并同步改 channel.json 的 license.apiBase 端口。");
  } else {
    console.error(err);
  }
  process.exit(1);
});
