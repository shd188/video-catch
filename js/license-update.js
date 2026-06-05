/**
 * GPL-3.0 — Channel update prompt (no re-activation when ever_activated).
 */
const UpdateStorage = {
  dismissed: "updateDismissedVersion",
  promptShown: "updatePromptShownVersion",
  pending: "pendingUpdate",
};

function licenseUpdateEscapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function licenseUpdateGetCurrentVersion() {
  try {
    return chrome.runtime.getManifest().version || "";
  } catch (e) {
    return "";
  }
}

function licenseDismissUpdate(version) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [UpdateStorage.dismissed]: version }, resolve);
  });
}

function licenseShouldPromptUpdate(upd) {
  return new Promise((resolve) => {
    if (!upd?.download_url || !upd?.version) {
      resolve(false);
      return;
    }
    chrome.storage.local.get([UpdateStorage.dismissed], (items) => {
      resolve(items[UpdateStorage.dismissed] !== upd.version);
    });
  });
}

function licenseStartDownload(url) {
  if (!url) return;
  if (chrome.downloads?.download) {
    chrome.downloads.download({ url, saveAs: true }, function () {
      if (chrome.runtime.lastError) {
        chrome.tabs.create({ url });
      }
    });
    return;
  }
  chrome.tabs.create({ url });
}

function licenseBuildUpdateDialogHtml(upd) {
  const current = licenseUpdateGetCurrentVersion();
  const notes = upd.notes
    ? `<div class="ch-update-notes">${licenseUpdateEscapeHtml(upd.notes).replace(/\n/g, "<br>")}</div>`
    : "";
  return `
    <div class="ch-update-backdrop">
      <div class="ch-update-dialog" role="dialog" aria-labelledby="chUpdateTitle">
        <div class="ch-update-icon">🎉</div>
        <h2 id="chUpdateTitle" class="ch-update-title">发现新版本</h2>
        <p class="ch-update-sub">升级无需重新激活，下载后解压并在扩展管理页重新加载即可。</p>
        <div class="ch-update-versions">
          <span>当前 <b>${licenseUpdateEscapeHtml(current)}</b></span>
          <span class="ch-update-arrow">→</span>
          <span>新版 <b>${licenseUpdateEscapeHtml(upd.version)}</b></span>
        </div>
        ${notes}
        <div class="ch-update-actions">
          <button type="button" class="btn btn-primary" id="chUpdateDownloadBtn">下载更新</button>
          <button type="button" class="btn btn-outline" id="chUpdateCancelBtn">稍后再说</button>
        </div>
      </div>
    </div>
  `;
}

function licenseBindUpdateDialog(root, upd, options) {
  const onClose = options?.onClose || function () {};
  root.querySelector("#chUpdateDownloadBtn")?.addEventListener("click", function () {
    licenseStartDownload(upd.download_url);
    onClose(false);
  });
  root.querySelector("#chUpdateCancelBtn")?.addEventListener("click", function () {
    licenseDismissUpdate(upd.version).then(function () {
      onClose(true);
    });
  });
}

/** 后台：检测到新版本时打开升级页（每版本仅自动提示一次） */
function licenseMaybePromptUpdate() {
  const upd = typeof licenseGetUpdate === "function" ? licenseGetUpdate() : null;
  if (!upd?.download_url) return;

  licenseShouldPromptUpdate(upd).then(function (should) {
    if (!should) return;
    chrome.storage.local.get([UpdateStorage.promptShown], function (items) {
      if (items[UpdateStorage.promptShown] === upd.version) return;
      chrome.storage.local.set({ [UpdateStorage.promptShown]: upd.version }, function () {
        chrome.tabs.create({ url: chrome.runtime.getURL("channel-update.html") });
      });
    });
  });
}

/** Popup：显示升级浮层 */
function licenseShowPopupUpdateModal() {
  const upd = typeof licenseGetUpdate === "function" ? licenseGetUpdate() : null;
  if (!upd?.download_url) return Promise.resolve(false);
  if (document.getElementById("channelUpdateOverlay")) return Promise.resolve(true);

  return licenseShouldPromptUpdate(upd).then(function (should) {
    if (!should) return false;

    if (!document.getElementById("ch-update-styles")) {
      const link = document.createElement("link");
      link.id = "ch-update-styles";
      link.rel = "stylesheet";
      link.href = chrome.runtime.getURL("css/channel-update.css");
      document.head.appendChild(link);
    }

    const wrap = document.createElement("div");
    wrap.id = "channelUpdateOverlay";
    wrap.innerHTML = licenseBuildUpdateDialogHtml(upd);
    document.body.appendChild(wrap);

    licenseBindUpdateDialog(wrap, upd, {
      onClose: function () {
        wrap.remove();
      },
    });
    return true;
  });
}

function licensePersistPendingUpdate(upd) {
  return new Promise((resolve) => {
    if (!upd?.download_url) {
      chrome.storage.local.remove(UpdateStorage.pending, resolve);
      return;
    }
    chrome.storage.local.set({ [UpdateStorage.pending]: upd }, resolve);
  });
}
