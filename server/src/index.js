import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import { activateLicense, checkLicense, createLicense } from "./licenses.js";
import {
  getReleaseFilePath,
  getLatestRelease,
  buildDownloadUrl,
  createRelease,
} from "./releases.js";
import { getReleasesDir } from "./db.js";

const app = express();
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "64kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "cat-catch-license-server" });
});

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
  if (!ADMIN_API_KEY || key !== ADMIN_API_KEY) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
  next();
}

app.post("/api/admin/licenses", adminAuth, (req, res) => {
  try {
    const row = createLicense({
      channelId: req.body.channel_id,
      email: req.body.email,
      maxDevices: req.body.max_devices ?? 2,
      expiresAt: req.body.expires_at,
      note: req.body.note,
      licenseKey: req.body.license_key,
    });
    res.json({ ok: true, license: row });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
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

const server = app.listen(PORT, HOST, () => {
  fs.mkdirSync(getReleasesDir(), { recursive: true });
  console.log(`License server http://${HOST}:${PORT}`);
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
