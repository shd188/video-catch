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
  claimDeliveryLicense,
  findLicenseByClaimToken,
  revokeLicense,
  unbindLicense,
  activateCourseDl,
  verifyCourseDl,
  claimCourseDlByOrder,
  claimAndActivateCourseDl,
  COURSE_DL_CHANNEL,
  getCourseDlConfig,
  setCourseDlConfig,
} from "./licenses.js";
import {
  deliveryChannelAllowed,
  getDeliveryPan,
  setDeliveryPan,
  listDeliveryPanConfigs,
  checkClaimRateLimit,
  checkPackageDownloadRateLimit,
  parseCookies,
  claimCookieName,
  ensureDeliverySlug,
  getChannelIdBySlug,
  rotateDeliverySlug,
  deliveryPageUrl,
} from "./delivery.js";
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
  getLatestPackage,
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
const ADMIN_CHANNELS = (process.env.ADMIN_CHANNELS || "quanneng,xiaoetong,tencentmeeting,feishu,course-dl")
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

const courseDlDir = path.join(publicDir, "course-dl");
function sendCourseDlIndex(_req, res) {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(courseDlDir, "index.html"));
}
app.get(["/course-dl", "/course-dl/"], sendCourseDlIndex);
app.use(
  "/course-dl",
  express.static(courseDlDir, {
    index: false,
    redirect: false,
    maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith("index.html") || filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

function sendDeliverPage(req, res) {
  const slug = String(req.params.slug || "").trim();
  const channelId = getChannelIdBySlug(slug);
  if (!channelId || !deliveryChannelAllowed(channelId, ADMIN_CHANNELS.join(","), ADMIN_CHANNEL_LABELS)) {
    return res.status(404).type("text/plain; charset=utf-8").send("链接无效或已失效");
  }
  let html = fs.readFileSync(path.join(guideDir, "index.html"), "utf8");
  const inject = `<script>window.__VC_DELIVER__=${JSON.stringify({
    channelId,
    token: slug,
  })};</script>`;
  if (html.includes("</head>")) {
    html = html.replace("</head>", `${inject}</head>`);
  } else {
    html = inject + html;
  }
  // Bust stale browser cache that may still hold application/octet-stream for same ETag
  html = html.replace(
    "<head>",
    `<head>\n  <!-- vc-deliver-v4 -->\n  <meta http-equiv="Cache-Control" content="no-store" />`
  );
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(html);
}
app.get("/d/:slug", sendDeliverPage);
// 旧的可枚举渠道路径已废弃
app.get("/deliver/:channelId", (_req, res) => {
  res.status(404).type("text/plain; charset=utf-8").send("链接无效或已失效");
});

function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  return req.socket?.remoteAddress || "";
}

function publicDeliveryPackage(channelId, token) {
  const pkg = getLatestPackage(channelId);
  if (!pkg) return { available: false };
  return {
    available: true,
    version: pkg.version,
    filename: pkg.filename,
    download_url: `/api/v1/delivery/package?token=${encodeURIComponent(token)}`,
  };
}

app.get("/api/v1/delivery/meta", (req, res) => {
  const token = String(req.query.token || "").trim();
  const channelId = getChannelIdBySlug(token);
  if (!channelId || !deliveryChannelAllowed(channelId, ADMIN_CHANNELS.join(","), ADMIN_CHANNEL_LABELS)) {
    return res.status(400).json({ ok: false, message: "链接无效或已失效" });
  }
  const channels = getAdminChannelList(ADMIN_CHANNELS.join(","), ADMIN_CHANNEL_LABELS);
  const ch = channels.find((c) => c.id === channelId);
  const pan = getDeliveryPan(channelId);
  const cookies = parseCookies(req.headers.cookie);
  const claimTok = cookies[claimCookieName(channelId)] || "";
  let claimed = false;
  let licenseKey = null;
  if (claimTok) {
    const existing = findLicenseByClaimToken(channelId, claimTok);
    if (existing) {
      claimed = true;
      licenseKey = existing.license_key;
    }
  }
  res.json({
    ok: true,
    channel_id: channelId,
    channel_label: ch?.label || channelId,
    pan,
    package: publicDeliveryPackage(channelId, token),
    claimed,
    license_key: licenseKey,
  });
});

app.post("/api/v1/delivery/claim", (req, res) => {
  const token = String(req.body?.token || "").trim();
  const channelId = getChannelIdBySlug(token);
  if (!channelId || !deliveryChannelAllowed(channelId, ADMIN_CHANNELS.join(","), ADMIN_CHANNEL_LABELS)) {
    return res.status(400).json({ ok: false, code: "BAD_TOKEN", message: "链接无效或已失效" });
  }
  const cookies = parseCookies(req.headers.cookie);
  const existingToken = cookies[claimCookieName(channelId)] || "";

  // 已领过：不计入限流，直接返回
  if (existingToken) {
    const existing = findLicenseByClaimToken(channelId, existingToken);
    if (existing) {
      const pan = getDeliveryPan(channelId);
      return res.json({
        ok: true,
        license_key: existing.license_key,
        channel_id: existing.channel_id,
        pan,
        package: publicDeliveryPackage(channelId, token),
        reused: true,
      });
    }
  }

  const rate = checkClaimRateLimit(clientIp(req), channelId, { maxPerDay: 20 });
  if (!rate.ok) {
    return res.status(429).json(rate);
  }

  const result = claimDeliveryLicense(channelId, {});
  if (!result.ok) {
    const status = result.code === "OUT_OF_STOCK" ? 409 : 400;
    return res.status(status).json(result);
  }

  const pan = getDeliveryPan(channelId);
  const cookieName = claimCookieName(channelId);
  const maxAge = 365 * 24 * 60 * 60;
  res.setHeader(
    "Set-Cookie",
    `${cookieName}=${encodeURIComponent(result.claim_token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${
      process.env.NODE_ENV === "production" || PUBLIC_BASE_URL.startsWith("https")
        ? "; Secure"
        : ""
    }`
  );
  res.json({
    ok: true,
    license_key: result.license_key,
    channel_id: result.channel_id,
    pan,
    package: publicDeliveryPackage(channelId, token),
    reused: false,
  });
});

app.get("/api/v1/delivery/package", (req, res) => {
  const token = String(req.query.token || "").trim();
  const channelId = getChannelIdBySlug(token);
  if (!channelId || !deliveryChannelAllowed(channelId, ADMIN_CHANNELS.join(","), ADMIN_CHANNEL_LABELS)) {
    return res.status(400).type("text/plain; charset=utf-8").send("链接无效或已失效");
  }
  const rate = checkPackageDownloadRateLimit(clientIp(req), channelId, { maxPerDay: 40 });
  if (!rate.ok) {
    return res.status(429).type("text/plain; charset=utf-8").send(rate.message);
  }
  const pkg = getLatestPackage(channelId);
  if (!pkg) {
    return res.status(404).type("text/plain; charset=utf-8").send("安装包暂未上传，请联系客服");
  }
  res.setHeader("Cache-Control", "private, no-store");
  res.download(pkg.filePath, pkg.filename);
});

const manualDir = path.join(publicDir, "manual");
function sendManualIndex(_req, res) {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(manualDir, "index.html"));
}
app.get(["/manual", "/manual/", "/manual/index.html"], sendManualIndex);
app.use(
  "/manual",
  express.static(manualDir, {
    index: false,
    redirect: false,
    maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith("index.html") || filePath.endsWith(".md")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

app.post("/api/v1/activate", (req, res) => {
  const { license_key, channel_id, installation_id, user_agent, order_no, orderNo } = req.body || {};
  if (!license_key || !channel_id || !installation_id) {
    return res.status(400).json({ ok: false, message: "缺少参数" });
  }
  const result = activateLicense({
    licenseKey: String(license_key).trim(),
    channelId: String(channel_id).trim(),
    installationId: String(installation_id).trim(),
    userAgent: user_agent,
    orderNo: order_no || orderNo,
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
  let everActivated = hasInstallActivatedOnChannel(installationId, channelId);

  let status;
  if (licenseKey) {
    status = checkLicense({ licenseKey, channelId, installationId });
  } else if (!strictMode && everActivated) {
    status = { active: true, ever_activated: true, code: "EVER_ACTIVATED" };
  } else {
    status = { active: false, code: "NO_KEY" };
  }

  if (status.code === "REVOKED") {
    everActivated = false;
    status = { ...status, active: false };
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

/** course-dl 桌面端兼容接口（与 Cloudflare Worker 版路径一致） */
app.post("/api/claim", (req, res) => {
  const body = req.body || {};
  const orderNo = body.order_no || body.orderNo || body.order;
  const rate = checkClaimRateLimit(clientIp(req), COURSE_DL_CHANNEL, { maxPerDay: 30 });
  if (!rate.ok) {
    return res.status(429).json({
      ok: false,
      error: rate.message || "领取过于频繁，请稍后再试",
      message: rate.message || "领取过于频繁，请稍后再试",
    });
  }
  const result = claimCourseDlByOrder(orderNo);
  const status = result.ok ? 200 : result.code === "BAD_ORDER" ? 400 : 403;
  res.status(status).json(result);
});

app.post("/api/web-activate", (req, res) => {
  const body = req.body || {};
  const rate = checkClaimRateLimit(clientIp(req), COURSE_DL_CHANNEL, { maxPerDay: 30 });
  if (!rate.ok) {
    return res.status(429).json({
      ok: false,
      error: rate.message || "提交过于频繁，请稍后再试",
      message: rate.message || "提交过于频繁，请稍后再试",
    });
  }
  const result = claimAndActivateCourseDl({
    orderNo: body.order_no || body.orderNo || body.order,
    deviceId: body.device_id || body.deviceId || body.installation_id,
    userAgent: req.headers["user-agent"],
  });
  const status = result.ok
    ? 200
    : result.code === "BAD_ORDER" || result.code === "BAD_DEVICE"
      ? 400
      : result.code === "INVALID_KEY"
        ? 404
        : 403;
  res.status(status).json(result);
});

app.post("/api/activate", (req, res) => {
  const body = req.body || {};
  const result = activateCourseDl({
    code: body.code || body.license_key,
    deviceId: body.device_id || body.deviceId || body.installation_id,
    orderNo: body.order_no || body.orderNo,
    userAgent: req.headers["user-agent"],
  });
  const status = result.ok ? 200 : result.code === "INVALID_KEY" ? 404 : 403;
  if (!result.ok && result.error && result.error.includes("请填写")) {
    return res.status(400).json(result);
  }
  res.status(status).json(result);
});

app.post("/api/verify", (req, res) => {
  const body = req.body || {};
  const result = verifyCourseDl({
    code: body.code || body.license_key,
    deviceId: body.device_id || body.deviceId || body.installation_id,
  });
  res.status(result.ok ? 200 : result.http || 403).json(result);
});

app.get("/api/config", (_req, res) => {
  res.json({ ok: true, ...getCourseDlConfig() });
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
    allowed =
      status.code === "REVOKED"
        ? false
        : status.active || (!strictMode && everActivated);
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
  const unsentOnly = req.query.unsent === "1";
  const status = String(req.query.status || "").trim();
  const q = String(req.query.q || "").trim();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.page_size, 10) || 50, 1), 200);
  const offset = (page - 1) * pageSize;
  const total = countLicenses(channelId, { unusedOnly, unsentOnly, status, q });
  const licenses = listLicenses(channelId, {
    limit: pageSize,
    offset,
    unusedOnly,
    unsentOnly,
    status,
    q,
  });
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

app.get("/api/admin/delivery/pan", adminAuth, (req, res) => {
  const channelId = req.query.channel_id ? String(req.query.channel_id).trim() : "";
  if (channelId) {
    const slug = ensureDeliverySlug(channelId);
    const pkg = getLatestPackage(channelId);
    return res.json({
      ok: true,
      channel_id: channelId,
      pan: getDeliveryPan(channelId),
      package: pkg
        ? { available: true, version: pkg.version, filename: pkg.filename }
        : { available: false },
      slug,
      page_url: deliveryPageUrl(PUBLIC_BASE_URL, slug),
    });
  }
  const channels = getAdminChannelList(ADMIN_CHANNELS.join(","), ADMIN_CHANNEL_LABELS);
  const ids = channels.map((c) => c.id);
  res.json({
    ok: true,
    items: listDeliveryPanConfigs(ids).map((item) => {
      const slug = ensureDeliverySlug(item.channel_id);
      return {
        ...item,
        slug,
        page_url: deliveryPageUrl(PUBLIC_BASE_URL, slug),
      };
    }),
  });
});

app.put("/api/admin/delivery/pan", adminAuth, (req, res) => {
  const channelId = String(req.body?.channel_id || "").trim();
  if (!channelId) {
    return res.status(400).json({ ok: false, message: "请指定 channel_id" });
  }
  const pan = setDeliveryPan(channelId, {
    url: req.body?.url,
    code: req.body?.code,
  });
  const slug = ensureDeliverySlug(channelId);
  res.json({
    ok: true,
    channel_id: channelId,
    pan,
    slug,
    page_url: deliveryPageUrl(PUBLIC_BASE_URL, slug),
  });
});

app.post("/api/admin/delivery/slug/rotate", adminAuth, (req, res) => {
  const channelId = String(req.body?.channel_id || "").trim();
  if (!channelId) {
    return res.status(400).json({ ok: false, message: "请指定 channel_id" });
  }
  if (!deliveryChannelAllowed(channelId, ADMIN_CHANNELS.join(","), ADMIN_CHANNEL_LABELS)) {
    return res.status(400).json({ ok: false, message: "渠道无效" });
  }
  const slug = rotateDeliverySlug(channelId);
  res.json({
    ok: true,
    channel_id: channelId,
    slug,
    page_url: deliveryPageUrl(PUBLIC_BASE_URL, slug),
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

app.post("/api/admin/licenses/revoke", adminAuth, (req, res) => {
  const key = String(req.body?.license_key || req.body?.code || "").trim();
  if (!key) return res.status(400).json({ ok: false, message: "缺少激活码" });
  const result = revokeLicense(key);
  res.status(result.ok ? 200 : 404).json(result);
});

app.post("/api/admin/licenses/unbind", adminAuth, (req, res) => {
  const key = String(req.body?.license_key || req.body?.code || "").trim();
  if (!key) return res.status(400).json({ ok: false, message: "缺少激活码" });
  const result = unbindLicense(key);
  const status = result.ok ? 200 : result.code === "REVOKED" ? 403 : 404;
  res.status(status).json(result);
});

app.get("/api/admin/course-dl/config", adminAuth, (_req, res) => {
  res.json({ ok: true, ...getCourseDlConfig() });
});

app.post("/api/admin/course-dl/config", adminAuth, (req, res) => {
  const cfg = setCourseDlConfig(req.body || {});
  res.json({ ok: true, ...cfg });
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
    const q = String(req.query.q || "").trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.page_size, 10) || 50, 1), 200);
    const offset = (page - 1) * pageSize;
    const sync = req.query.sync === "1" || req.query.sync === "true";
    let codes = listRedeemCodes({ pack, status, limit: pageSize, offset, q });
    let syncResult = null;
    if (sync && codes.length) {
      syncResult = await syncRedeemRemaining(codes.map((c) => c.code));
      codes = listRedeemCodes({ pack, status, limit: pageSize, offset, q });
    }
    const total = countRedeemCodes({ pack, status, q });
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
  console.log(`Course-dl delivery: ${base}/course-dl/`);
  console.log(`Delivery pages: ${base}/d/<token>`);
  console.log(`Remote install prep: ${base}/manual/`);
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
