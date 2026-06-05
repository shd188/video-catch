/**
 * GPL-3.0 — Activation UI on channel-install & options (fragment).
 */
async function licenseUiInitInstallPage() {
  const cfg = await licenseGetConfig();
  if (!cfg?.apiBase) return;

  const card = document.querySelector(".card-body");
  if (!card || document.getElementById("licenseActivateBox")) return;

  const box = document.createElement("div");
  box.id = "licenseActivateBox";
  box.className = "policy-section";
  box.innerHTML = `
    <div class="section-title">订阅激活（可选）</div>
    <div class="content-box lang-zh active">
      <p>若您已购买本渠道技术支持，请输入激活码以接收版本更新通知与下载链接。</p>
      <p><input type="text" id="licenseKeyInput" class="ch-input" placeholder="CC-XXXX-XXXX-XXXX" autocomplete="off" /></p>
      <div class="ch-actions">
        <button type="button" class="btn btn-primary" id="licenseActivateBtn">激活</button>
        <span id="licenseActivateMsg" class="ch-hint"></span>
      </div>
      <p id="licenseUpdateHint" class="ch-hint" style="display:none;margin-top:12px"></p>
    </div>
  `;
  const buttons = card.querySelector(".buttons");
  card.insertBefore(box, buttons);

  document.getElementById("licenseActivateBtn").addEventListener("click", async () => {
    const key = document.getElementById("licenseKeyInput").value;
    const msg = document.getElementById("licenseActivateMsg");
    msg.textContent = "…";
    try {
      const r = await licenseActivate(key);
      msg.textContent = r.ok ? "激活成功" : (r.message || "失败");
      msg.className = "ch-hint " + (r.ok ? "ok" : "err");
      if (r.ok) await licenseCheck(true);
      licenseUiShowUpdateHint();
    } catch (e) {
      msg.textContent = e.message || "网络错误";
    }
  });

  const stored = await licenseGetStoredKey();
  if (stored) {
    document.getElementById("licenseKeyInput").value = stored;
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
