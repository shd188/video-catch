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

function licenseUpdateGetExtensionName() {
  try {
    return chrome.runtime.getManifest().name || "本扩展";
  } catch (e) {
    return "本扩展";
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
        <p class="ch-update-sub">升级<strong>无需重新激活</strong>。请按下列步骤覆盖原扩展目录后重新加载（不要解压到新文件夹再「加载已解压」，否则会装成第二个扩展）。</p>
        <div class="ch-update-versions">
          <span>当前 <b>${licenseUpdateEscapeHtml(current)}</b></span>
          <span class="ch-update-arrow">→</span>
          <span>新版 <b>${licenseUpdateEscapeHtml(upd.version)}</b></span>
        </div>
        <ol class="ch-update-steps">
          <li>点击下方 <b>下载更新</b>，将 zip 保存到电脑（建议记住保存位置）。</li>
          <li>解压 zip，得到扩展文件夹（内含 <code>manifest.json</code>）。</li>
          <li>打开你<strong>当初加载本扩展时选中的那个文件夹</strong>（例如 <code>dist/xiaoetong</code>），用解压出的文件<strong>全部覆盖</strong>原目录（替换同名文件）。</li>
          <li>在浏览器地址栏输入 <code>chrome://extensions</code> 并回车，打开扩展管理页。</li>
          <li>找到「${licenseUpdateEscapeHtml(licenseUpdateGetExtensionName())}」，点击卡片上的 <b>重新加载</b> 按钮（圆形箭头图标）。</li>
          <li>确认版本号已变为 <b>${licenseUpdateEscapeHtml(upd.version)}</b>，即可继续使用。</li>
        </ol>
        ${notes}
        <div class="ch-update-actions">
          <button type="button" class="btn btn-primary" id="chUpdateDownloadBtn">下载更新</button>
          <button type="button" class="btn btn-outline" id="chUpdateOpenExtBtn">打开扩展管理页</button>
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
  root.querySelector("#chUpdateOpenExtBtn")?.addEventListener("click", function () {
    chrome.tabs.create({ url: "chrome://extensions" });
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
