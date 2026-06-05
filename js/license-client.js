/**
 * GPL-3.0 — Optional subscription API client (server is proprietary, not shipped).
 * 安装页 channel-install.html 不加载 init.js，故不得依赖全局 G。
 */
const LicenseStorage = {
  key: "licenseKey",
  installationId: "installationId",
  lastCheck: "licenseLastCheck",
};

/** 不依赖 G 的订阅状态（安装页 / background 共用） */
const LicenseState = {
  active: false,
  expiresAt: null,
  update: null,
};

let _licenseConfigCache = null;

function licenseSyncToG() {
  if (typeof G === "undefined") return;
  G.licenseActive = LicenseState.active;
  G.licenseExpiresAt = LicenseState.expiresAt;
  G.licenseUpdate = LicenseState.update;
}

function licenseGetUpdate() {
  return LicenseState.update;
}

async function licenseGetConfig() {
  if (typeof G !== "undefined" && G.channelLicenseApi) return G.channelLicenseApi;
  if (_licenseConfigCache) return _licenseConfigCache;
  try {
    const res = await fetch(chrome.runtime.getURL("channel-build.json"));
    if (!res.ok) return null;
    const info = await res.json();
    _licenseConfigCache = info.license || null;
    if (typeof G !== "undefined" && _licenseConfigCache) {
      G.channelLicenseApi = _licenseConfigCache;
    }
    return _licenseConfigCache;
  } catch (e) {
    return null;
  }
}

async function licenseGetChannelId() {
  if (typeof G !== "undefined" && G.channelId) return G.channelId;
  const res = await fetch(chrome.runtime.getURL("channel-build.json"));
  if (!res.ok) return null;
  const info = await res.json();
  return info.channelId || null;
}

function licenseGetInstallationId() {
  return new Promise((resolve) => {
    chrome.storage.local.get([LicenseStorage.installationId], (items) => {
      if (items[LicenseStorage.installationId]) {
        resolve(items[LicenseStorage.installationId]);
        return;
      }
      const id = crypto.randomUUID();
      chrome.storage.local.set({ [LicenseStorage.installationId]: id }, () => resolve(id));
    });
  });
}

function licenseGetStoredKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get([LicenseStorage.key], (items) => {
      resolve(items[LicenseStorage.key] || "");
    });
  });
}

function licenseSetStoredKey(key) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [LicenseStorage.key]: key }, resolve);
  });
}

async function licenseApiPost(path, body) {
  const cfg = await licenseGetConfig();
  if (!cfg?.apiBase) {
    throw new Error("未配置订阅 API：请先 npm run build -- xiaoetong 并加载 dist/xiaoetong/");
  }
  const base = cfg.apiBase.replace(/\/$/, "");
  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(
      `无法连接 ${base}（${e.message || "Failed to fetch"}）。请确认：1) cd server && npm run dev 已启动；2) channel.json 的 apiBase 与 .env 一致；3) 已加载 dist/xiaoetong 而非仓库根目录。`
    );
  }
  return res.json();
}

async function licenseActivate(licenseKey) {
  const cfg = await licenseGetConfig();
  const channelId = await licenseGetChannelId();
  if (!cfg?.apiBase || !channelId) {
    return { ok: false, message: "未配置订阅服务" };
  }
  const installationId = await licenseGetInstallationId();
  const result = await licenseApiPost("/api/v1/activate", {
    license_key: licenseKey.trim(),
    channel_id: channelId,
    installation_id: installationId,
    user_agent: navigator.userAgent,
  });
  if (result.ok) {
    await licenseSetStoredKey(licenseKey.trim());
    LicenseState.active = true;
    LicenseState.expiresAt = result.expires_at;
    licenseSyncToG();
  }
  return result;
}

async function licenseCheck(force = false) {
  const cfg = await licenseGetConfig();
  const channelId = await licenseGetChannelId();
  if (!cfg?.apiBase || !channelId) return { skipped: true };

  const licenseKey = await licenseGetStoredKey();
  if (!licenseKey) {
    LicenseState.active = false;
    LicenseState.update = null;
    licenseSyncToG();
    return { active: false, code: "NO_KEY" };
  }

  const last = await new Promise((r) => {
    chrome.storage.local.get([LicenseStorage.lastCheck], (i) => r(i[LicenseStorage.lastCheck] || 0));
  });
  const intervalMs = (cfg.checkIntervalHours ?? 24) * 3600 * 1000;
  if (!force && Date.now() - last < intervalMs) {
    return { cached: true, active: LicenseState.active, update: LicenseState.update };
  }

  const installationId = await licenseGetInstallationId();
  const manifest = chrome.runtime.getManifest();
  const strictMode = cfg.strict === true;
  const result = await licenseApiPost("/api/v1/check", {
    license_key: licenseKey,
    channel_id: channelId,
    installation_id: installationId,
    current_version: manifest.version,
    strict: strictMode,
  });

  chrome.storage.local.set({ [LicenseStorage.lastCheck]: Date.now() });
  const updatesAllowed = !!result.updates_allowed || (!strictMode && !!result.ever_activated);
  LicenseState.active = !!result.active || updatesAllowed;
  LicenseState.expiresAt = result.expires_at;
  LicenseState.update = result.update_available && result.download_url
    ? {
        version: result.latest_version,
        notes: result.release_notes,
        download_url: result.download_url,
      }
    : null;
  licenseSyncToG();

  return result;
}
