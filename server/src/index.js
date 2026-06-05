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
  createLicense,
  createLicensesBulk,
  licenseStats,
  listLicenses,
} from "./licenses.js";
import {
  getReleaseFilePath,
  getLatestRelease,
  buildDownloadUrl,
  createRelease,
  listReleases,
  registerRelease,
  sanitizeReleaseFilename,
} from "./releases.js";
import { getReleasesDir } from "./db.js";
import {
  changeAdminPassword,
  ensureAdminPasswordReady,
  hasConfiguredPassword,
  verifyAdminKey,
} from "./admin-auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const app = express();
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";
const ADMIN_CHANNELS = (process.env.ADMIN_CHANNELS || "xiaoetong")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

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
  const { license_key, channel_id, installation_id, current_version } = req.body || {};
  if (!license_key || !channel_id || !installation_id) {
    return res.status(400).json({ active: false, message: "缺少参数" });
  }
  const status = checkLicense({
    licenseKey: String(license_key).trim(),
    channelId: String(channel_id).trim(),
    installationId: String(installation_id).trim(),
  });
  const latest = getLatestRelease(String(channel_id).trim());
  const manifestVersion = current_version || null;
  let update_available = false;
  if (latest && status.active && manifestVersion) {
    update_available = manifestVersion !== latest.version;
  }
  const payload = {
    ...status,
    current_version: manifestVersion,
    latest_version: latest?.version || null,
    release_notes: latest?.release_notes || null,
    update_available,
  };
  if (latest && status.active && update_available) {
    payload.download_url = buildDownloadUrl(
      PUBLIC_BASE_URL,
      channel_id,
      latest.version,
      license_key,
      installation_id
    );
  }
  res.json(payload);
});

app.get("/api/v1/download", (req, res) => {
  const license_key = String(req.query.key || "");
  const channel_id = String(req.query.channel || "");
  const version = String(req.query.version || "");
  const installation_id = String(req.query.installation_id || "");
  const status = checkLicense({
    licenseKey: license_key,
    channelId: channel_id,
    installationId: installation_id,
  });
  if (!status.active) {
    return res.status(403).send("License not active");
  }
  const filePath = getReleaseFilePath(channel_id, version);
  if (!filePath) {
    return res.status(404).send("Release file not found");
  }
  res.download(filePath, path.basename(filePath));
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
  res.json({ ok: true, channels: ADMIN_CHANNELS });
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
  const limit = Math.min(parseInt(req.query.limit, 10) || 500, 5000);
  res.json({ ok: true, licenses: listLicenses(channelId, { limit, unusedOnly }) });
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
  console.log(`Admin UI: ${PUBLIC_BASE_URL.replace(/\/$/, "")}/admin/`);
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
