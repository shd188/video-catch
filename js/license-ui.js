/**
 * GPL-3.0 — Activation UI on channel-install & options (fragment).
 */
async function licenseUiInitInstallPage() {
  const cfg = await licenseGetConfig();
  const emptySlot = document.getElementById("licenseActivateSlot");
  if (!cfg?.apiBase) {
    if (emptySlot) emptySlot.remove();
    return;
  }

  const slot = document.getElementById("licenseActivateSlot");
  if (!slot || document.getElementById("licenseActivateBox")) return;

  if (typeof licenseBootstrap === "function") {
    await licenseBootstrap();
  }

  if (LicenseState.active) {
    const box = document.createElement("div");
    box.id = "licenseActivateBox";
    box.className = "policy-section";
    box.innerHTML = `
      <div class="section-title">🔑 渠道激活</div>
      <div class="content-box lang-zh active">
        <p class="ch-hint ok">本设备已激活。版本升级后<strong>无需</strong>重新输入激活码。</p>
        <p id="licenseUpdateHint" class="ch-hint" style="display:none;margin-top:12px"></p>
      </div>
    `;
    slot.replaceWith(box);
    licenseUiShowUpdateHint();
    return;
  }

  const box = document.createElement("div");
  box.id = "licenseActivateBox";
  box.className = "policy-section";
  box.innerHTML = `
    <div class="section-title">🔑 渠道激活（首次使用）</div>
    <div class="content-box lang-zh active">
      <p>每个渠道<strong>首次使用</strong>时请输入激活码（每设备一次）。激活后扩展可正常使用；后续版本更新不再重复校验激活码。</p>
      <p><input type="text" id="licenseKeyInput" class="ch-input" placeholder="CC-XXXX-XXXX-XXXX" autocomplete="off" /></p>
      <div class="ch-actions">
        <button type="button" class="btn btn-primary" id="licenseActivateBtn">激活</button>
        <span id="licenseActivateMsg" class="ch-hint"></span>
      </div>
      <p id="licenseUpdateHint" class="ch-hint" style="display:none;margin-top:12px"></p>
    </div>
  `;
  slot.replaceWith(box);

  document.getElementById("licenseActivateBtn").addEventListener("click", async () => {
    const key = document.getElementById("licenseKeyInput").value;
    const msg = document.getElementById("licenseActivateMsg");
    msg.textContent = "…";
    try {
      const r = await licenseActivate(key);
      msg.textContent = r.ok ? "激活成功" : (r.message || "失败");
      msg.className = "ch-hint " + (r.ok ? "ok" : "err");
      if (r.ok) {
        await licenseCheck(true);
        chrome.runtime.sendMessage({ Message: "licenseActivated" }, function () {
          chrome.runtime.lastError;
        });
      }
      licenseUiShowUpdateHint();
    } catch (e) {
      msg.textContent = e.message || "网络错误";
    }
  });

  const stored = await licenseGetStoredKey();
  if (stored) {
    document.getElementById("licenseKeyInput").value = stored;
    if (typeof LicenseState !== "undefined" && LicenseState.code === "REVOKED") {
      const msg = document.getElementById("licenseActivateMsg");
      if (msg) {
        msg.textContent = "该激活码已作废，请更换新的激活码";
        msg.className = "ch-hint err";
      }
    }
    licenseUiShowUpdateHint();
  }
}

async function licenseUiShowUpdateHint() {
  const el = document.getElementById("licenseUpdateHint");
  if (!el) return;
  await licenseCheck(true);
  const upd = typeof licenseGetUpdate === "function" ? licenseGetUpdate() : null;
  if (upd?.download_url) {
    el.style.display = "block";
    el.innerHTML = `新版本 <b>${upd.version}</b> 可用。
      <a href="${upd.download_url}" target="_blank" rel="noopener">下载更新包</a>
      ${upd.notes ? `<br>${upd.notes}` : ""}`;
  }
}
