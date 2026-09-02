/**
 * GPL-3.0 — Optional subscription API client (server is proprietary, not shipped).
 * 安装页 channel-install.html 不加载 init.js，故不得依赖全局 G。
 */
const LicenseStorage = {
  key: "licenseKey",
  installationId: "installationId",
  lastCheck: "licenseLastCheck",
  activatedOnce: "licenseActivatedOnce",
  invalidated: "licenseInvalidated",
  remoteBlockUrl: "channelRemoteBlockUrl",
};

/** 不依赖 G 的订阅状态（安装页 / background 共用） */
const LicenseState = {
  active: false,
  expiresAt: null,
  update: null,
  code: null,
};

let _licenseConfigCache = null;
let _licenseStorageReady = Promise.resolve();
let _licenseStorageReadyResolve = null;

function licenseBeginStorageMigration() {
  _licenseStorageReady = new Promise((resolve) => {
    _licenseStorageReadyResolve = resolve;
  });
}

function licenseFinishStorageMigration() {
  if (_licenseStorageReadyResolve) {
    _licenseStorageReadyResolve();
    _licenseStorageReadyResolve = null;
  }
}

async function licenseAwaitStorageReady() {
  await _licenseStorageReady;
}

function licenseSyncToG() {
  if (typeof G === "undefined") return;
  G.licenseActive = LicenseState.active;
  G.licenseExpiresAt = LicenseState.expiresAt;
  G.licenseUpdate = LicenseState.update;
}

/** 渠道构建且配置了 apiBase 时，嗅探须先通过激活校验 */
function licenseSniffingBlocked() {
  if (typeof G === "undefined") return false;
  if (!G.channelLicenseApi?.apiBase) return false;
  return G.licenseActive !== true;
}

function licenseOpenInstallPage() {
  if (typeof G === "undefined" || !G.channelInstallPage) return;
  const page = String(G.channelInstallPage);
  chrome.tabs.create({ url: page });
}

function licenseApplyCheckResult(result, cfg) {
  const revoked = result?.code === "REVOKED";
  const strictMode = cfg?.strict === true;
  const updatesAllowed =
    !revoked && (!!result.updates_allowed || (!strictMode && !!result.ever_activated));
  LicenseState.active = !revoked && (!!result.active || updatesAllowed);
  LicenseState.code = result?.code || null;
  LicenseState.expiresAt = result.expires_at ?? null;
  LicenseState.update = result.update_available && result.download_url
    ? {
        version: result.latest_version,
        notes: result.release_notes,
        download_url: result.download_url,
      }
    : null;
  licenseSyncToG();

  if (revoked) {
    licenseMarkInvalidated();
  }

  if (typeof licensePersistPendingUpdate === "function") {
    licensePersistPendingUpdate(LicenseState.update);
  }
  if (LicenseState.update && typeof licenseMaybePromptUpdate === "function") {
    licenseMaybePromptUpdate();
  }
  if (Array.isArray(result?.block_url)) {
    licenseApplyRemoteBlockUrl(result.block_url);
  }
}

function licenseMarkInvalidated() {
  chrome.storage.local.set({
    [LicenseStorage.invalidated]: true,
    [LicenseStorage.activatedOnce]: false,
  });
}

function licenseClearInvalidated() {
  chrome.storage.local.set({ [LicenseStorage.invalidated]: false });
}

async function licenseIsInvalidated() {
  const items = await new Promise((resolve) => {
    chrome.storage.local.get([LicenseStorage.invalidated], (data) => resolve(data || {}));
  });
  return !!items[LicenseStorage.invalidated];
}

async function licenseHasLocalActivation() {
  const items = await new Promise((resolve) => {
    chrome.storage.local.get(
      [LicenseStorage.key, LicenseStorage.activatedOnce, LicenseStorage.invalidated],
      (data) => resolve(data || {})
    );
  });
  if (items[LicenseStorage.invalidated]) return false;
  return !!(items[LicenseStorage.key] || items[LicenseStorage.activatedOnce]);
}

function licenseApplyLocalActivationHint() {
  LicenseState.active = true;
  licenseSyncToG();
}

async function licenseBootstrap() {
  await licenseAwaitStorageReady();
  await licenseLoadCachedRemoteBlockUrl();
  const cfg = await licenseGetConfig();
  if (!cfg?.apiBase) {
    LicenseState.active = true;
    licenseSyncToG();
    return { skipped: true };
  }
  if (await licenseHasLocalActivation()) {
    licenseApplyLocalActivationHint();
  } else if (await licenseIsInvalidated()) {
    LicenseState.active = false;
    LicenseState.code = "REVOKED";
    licenseSyncToG();
  }
  try {
    return await licenseCheck(true);
  } catch (e) {
    if (await licenseHasLocalActivation()) {
      licenseApplyLocalActivationHint();
      return { cached: true, active: true, offline: true };
    }
    if (await licenseIsInvalidated()) {
      LicenseState.active = false;
      LicenseState.code = "REVOKED";
      licenseSyncToG();
      return { cached: true, active: false, offline: true, code: "REVOKED" };
    }
    throw e;
  }
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

function licenseApplyRemoteBlockUrl(list) {
  const cleaned = Array.isArray(list)
    ? list
        .map((item) => ({ url: String(item?.url || item || "").trim(), state: true }))
        .filter((item) => item.url)
    : [];
  chrome.storage.local.set({ [LicenseStorage.remoteBlockUrl]: cleaned });
  if (typeof setChannelRemoteBlockUrl === "function") {
    setChannelRemoteBlockUrl(cleaned);
  } else if (typeof G !== "undefined") {
    G._channelRemoteBlockUrl = cleaned;
  }
}

async function licenseLoadCachedRemoteBlockUrl() {
  const items = await new Promise((resolve) => {
    chrome.storage.local.get([LicenseStorage.remoteBlockUrl], (data) => resolve(data || {}));
  });
  const list = items[LicenseStorage.remoteBlockUrl];
  if (!Array.isArray(list)) return;
  if (typeof setChannelRemoteBlockUrl === "function") {
    setChannelRemoteBlockUrl(list);
  } else if (typeof G !== "undefined") {
    G._channelRemoteBlockUrl = list;
  }
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
    licenseClearInvalidated();
    LicenseState.active = true;
    LicenseState.code = null;
    LicenseState.expiresAt = result.expires_at;
    licenseSyncToG();
    chrome.storage.local.set({ [LicenseStorage.activatedOnce]: true });
  }
  return result;
}

async function licenseCheck(force = false) {
  await licenseAwaitStorageReady();
  const cfg = await licenseGetConfig();
  const channelId = await licenseGetChannelId();
  if (!cfg?.apiBase || !channelId) return { skipped: true };

  const licenseKey = await licenseGetStoredKey();
  const last = await new Promise((r) => {
    chrome.storage.local.get([LicenseStorage.lastCheck], (i) => r(i[LicenseStorage.lastCheck] || 0));
  });
  const intervalMs = (cfg.checkIntervalHours ?? 24) * 3600 * 1000;
  if (!force && Date.now() - last < intervalMs && (licenseKey || LicenseState.active)) {
    return { cached: true, active: LicenseState.active, update: LicenseState.update };
  }

  const installationId = await licenseGetInstallationId();
  const manifest = chrome.runtime.getManifest();
  const strictMode = cfg.strict === true;
  let result;
  try {
    result = await licenseApiPost("/api/v1/check", {
      license_key: licenseKey || "",
      channel_id: channelId,
      installation_id: installationId,
      current_version: manifest.version,
      strict: strictMode,
    });
  } catch (e) {
    if (await licenseHasLocalActivation()) {
      licenseApplyLocalActivationHint();
      return { cached: true, active: true, offline: true };
    }
    throw e;
  }

  chrome.storage.local.set({ [LicenseStorage.lastCheck]: Date.now() });
  licenseApplyCheckResult(result, cfg);
  if (LicenseState.active) {
    licenseClearInvalidated();
    chrome.storage.local.set({ [LicenseStorage.activatedOnce]: true });
  }

  return result;
}

function licensePreserveKeys() {
  return [
    LicenseStorage.key,
    LicenseStorage.installationId,
    LicenseStorage.lastCheck,
    LicenseStorage.activatedOnce,
    LicenseStorage.invalidated,
    LicenseStorage.remoteBlockUrl,
    "updateDismissedVersion",
    "updatePromptShownVersion",
    "pendingUpdate",
  ];
}
