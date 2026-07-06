(function () {
  "use strict";

  const SITE = window.LANDING_SITE || { channels: [], guideUrl: "#", repositoryUrl: "" };

  const ICONS = {
    shield:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    film:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5"/></svg>',
    key:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="15" r="4"/><path d="M12 11l9-9M16 5l3 3"/></svg>',
    lock:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    layers:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
    scale:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M3 9h18M7 15h10"/></svg>',
    check:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>',
  };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function iconSrc(id) {
    return "icons/" + encodeURIComponent(id) + ".png";
  }

  function enrichChannel(c) {
    return {
      ...c,
      guideUrl: SITE.guideUrl,
      repositoryUrl: SITE.repositoryUrl,
      iconUrl: iconSrc(c.id),
    };
  }

  function findChannel(id) {
    return SITE.channels.find((c) => c.id === id) || null;
  }

  function purchaseConfig() {
    return SITE.purchase || {
      price: "9.99",
      priceSuffix: "永久使用",
      wechatQr: "wechat-qr.svg",
      wechatNote: "加微信备注腾讯会议/小鹅通",
    };
  }

  function buyButtonHtml(extraClass) {
    const p = purchaseConfig();
    const cls = "lp-btn lp-btn-primary lp-buy-btn" + (extraClass ? " " + extraClass : "");
    return `<button type="button" class="${cls}" data-lp-buy>
      <span class="lp-buy-label">立即购买</span>
      <span class="lp-buy-price">¥${escapeHtml(p.price)} ${escapeHtml(p.priceSuffix)}</span>
    </button>`;
  }

  function ensureWechatModal() {
    if (document.getElementById("lpWechatModal")) return;
    const p = purchaseConfig();
    const modal = document.createElement("div");
    modal.id = "lpWechatModal";
    modal.className = "lp-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="lp-modal-backdrop" data-lp-close tabindex="-1"></div>
      <div class="lp-modal-panel" role="dialog" aria-modal="true" aria-labelledby="lpModalTitle">
        <button type="button" class="lp-modal-close" data-lp-close aria-label="关闭">×</button>
        <h2 id="lpModalTitle">立即购买</h2>
        <p class="lp-modal-price">¥${escapeHtml(p.price)} <span>${escapeHtml(p.priceSuffix)}</span></p>
        <div class="lp-modal-qr">
          <img src="${escapeHtml(p.wechatQr)}" alt="微信二维码" width="220" height="220" />
        </div>
        <p class="lp-modal-note">${escapeHtml(p.wechatNote)}</p>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelectorAll("[data-lp-close]").forEach((el) => {
      el.addEventListener("click", closeWechatModal);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeWechatModal();
    });
  }

  function openWechatModal() {
    ensureWechatModal();
    const modal = document.getElementById("lpWechatModal");
    modal.hidden = false;
    document.body.classList.add("lp-modal-open");
    modal.querySelector(".lp-modal-close")?.focus();
  }

  function closeWechatModal() {
    const modal = document.getElementById("lpWechatModal");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove("lp-modal-open");
  }

  function bindPurchaseButtons(root) {
    root.querySelectorAll("[data-lp-buy]").forEach((btn) => {
      btn.addEventListener("click", openWechatModal);
    });
  }

  function renderChannelPage(data) {
    document.title = data.displayName + " — 产品介绍";
    document.body.dataset.theme = data.theme || data.id;

    const versionLine = data.latestVersion
      ? "当前版本 v" + escapeHtml(data.latestVersion)
      : "联系服务商获取最新安装包";

    const featuresHtml = (data.features || [])
      .map(
        (f) => `<article class="lp-card">
          <div class="lp-card-icon">${ICONS[f.icon] || ICONS.shield}</div>
          <h3>${escapeHtml(f.title)}</h3>
          <p>${escapeHtml(f.desc)}</p>
        </article>`
      )
      .join("");

    const stepsHtml = (data.steps || [])
      .map(
        (s, i) => `<article class="lp-step">
          <div class="lp-step-num">${i + 1}</div>
          <h3>${escapeHtml(s.title)}</h3>
          <p>${escapeHtml(s.desc)}</p>
        </article>`
      )
      .join("");

    const sitesHtml = (data.sites || [])
      .map((s) => `<span class="lp-pill">${escapeHtml(s)}</span>`)
      .join("");

    document.getElementById("app").innerHTML = `
      <nav class="lp-nav">
        <div class="lp-nav-inner">
          <a class="lp-brand" href="index.html">
            <img src="${escapeHtml(data.iconUrl)}" alt="" width="36" height="36" />
            <span>${escapeHtml(data.displayName)}</span>
          </a>
          <div class="lp-nav-links">
            <a class="lp-btn lp-btn-ghost" href="index.html">全部渠道</a>
            <a class="lp-btn lp-btn-ghost" href="${escapeHtml(data.guideUrl)}" target="_blank" rel="noopener">使用说明</a>
            ${buyButtonHtml("lp-buy-btn-nav")}
          </div>
        </div>
      </nav>
      <main class="lp-main">
        <section class="lp-hero">
          <div>
            <div class="lp-badge"><span class="lp-badge-dot"></span>${escapeHtml(data.badge)}</div>
            <h1>${escapeHtml(data.heroTitle)}<br /><em>${escapeHtml(data.heroHighlight)}</em></h1>
            <p class="lp-hero-lead">${escapeHtml(data.heroSubtitle)}</p>
            <div class="lp-hero-actions">
              ${buyButtonHtml("lp-buy-btn-hero")}
              <a class="lp-btn lp-btn-ghost" href="${escapeHtml(data.guideUrl)}" target="_blank" rel="noopener">查看安装与使用说明</a>
              <a class="lp-btn lp-btn-ghost" href="#features">了解功能</a>
            </div>
            <div class="lp-trust">
              <span>${ICONS.check} Chrome / Edge 侧载安装</span>
              <span>${ICONS.check} ${versionLine}</span>
              <span>${ICONS.check} 数据本地处理</span>
            </div>
          </div>
          <div class="lp-hero-visual">
            <div class="lp-mock">
              <div class="lp-mock-bar"><i></i><i></i><i></i></div>
              <div class="lp-mock-row">
                <div class="lp-mock-icon">▶</div>
                <div><strong>课程视频</strong><br /><span style="color:var(--lp-muted);font-size:13px">m3u8 · 已嗅探</span></div>
                <span class="lp-mock-tag">可下载</span>
              </div>
              <div class="lp-mock-row">
                <div class="lp-mock-icon">⬇</div>
                <div><strong>合并下载</strong><br /><span style="color:var(--lp-muted);font-size:13px">FFmpeg 转码</span></div>
                <span class="lp-mock-tag">就绪</span>
              </div>
            </div>
          </div>
        </section>
        <section class="lp-section" id="features">
          <div class="lp-section-head">
            <h2>为${escapeHtml(data.channelNameZh || data.displayName)}场景优化</h2>
            <p>渠道专版扩展，白名单、激活与更新策略均已预配置，开箱即用。</p>
          </div>
          <div class="lp-grid">${featuresHtml}</div>
        </section>
        <section class="lp-section">
          <div class="lp-section-head">
            <h2>三步开始使用</h2>
            <p>向服务商索取 ${escapeHtml(data.zipName)} 与激活码，按说明操作即可。</p>
          </div>
          <div class="lp-steps">${stepsHtml}</div>
        </section>
        <section class="lp-section">
          <div class="lp-section-head">
            <h2>支持的网站</h2>
            <p>仅在下列域名白名单内嗅探；其它页面扩展不会抓取资源。</p>
          </div>
          <div class="lp-sites">${sitesHtml}</div>
        </section>
        <section class="lp-cta">
          <h2>准备好备份课程了吗？</h2>
          <p>扫码加微信购买，获取安装包与激活码。详细步骤见用户使用说明，合规使用、仅限已授权内容。</p>
          ${buyButtonHtml("lp-buy-btn-cta")}
          <a class="lp-btn lp-btn-ghost lp-cta-guide" href="${escapeHtml(data.guideUrl)}" target="_blank" rel="noopener">查看使用说明</a>
        </section>
        <footer class="lp-footer">
          <p>
            基于 Cat-Catch（GPL-3.0）构建 ·
            <a href="${escapeHtml(data.repositoryUrl)}" target="_blank" rel="noopener">源码仓库</a> ·
            <a href="${escapeHtml(data.guideUrl)}" target="_blank" rel="noopener">用户指南</a>
          </p>
          <p>请仅下载您有权访问、备份或学习的课程内容。</p>
        </footer>
      </main>`;
    bindPurchaseButtons(document.getElementById("app"));
  }

  function renderHubPage(channels) {
    document.title = "Video-Catch 渠道落地页";
    document.body.dataset.theme = "hub";

    const cards = channels
      .map(
        (c) => `<a class="lp-channel-card" href="${escapeHtml(c.page || c.id + ".html")}">
          <div class="lp-channel-card-head">
            <img src="${escapeHtml(c.iconUrl)}" alt="" width="56" height="56" />
            <div>
              <h2>${escapeHtml(c.displayName)}</h2>
              ${c.latestVersion ? `<span style="font-size:13px;color:var(--lp-muted)">v${escapeHtml(c.latestVersion)}</span>` : ""}
            </div>
          </div>
          <p>${escapeHtml(c.heroSubtitle)}</p>
          <span class="lp-btn lp-btn-primary" style="align-self:flex-start">进入落地页 →</span>
        </a>`
      )
      .join("");

    document.getElementById("app").innerHTML = `
      <nav class="lp-nav">
        <div class="lp-nav-inner">
          <a class="lp-brand" href="index.html"><span>Video-Catch 渠道</span></a>
          <div class="lp-nav-links">
            <a class="lp-btn lp-btn-ghost" href="${escapeHtml(SITE.guideUrl)}" target="_blank" rel="noopener">用户使用说明</a>
          </div>
        </div>
      </nav>
      <main class="lp-main">
        <section class="lp-hub-hero">
          <h1>选择您的渠道</h1>
          <p>每个渠道是独立的浏览器扩展包，拥有专属白名单、图标与激活策略。请选择对应落地页了解功能并获取安装指引。</p>
        </section>
        <section class="lp-channel-cards">${cards}</section>
        <footer class="lp-footer" style="margin-top:48px">
          <p><a href="${escapeHtml(SITE.guideUrl)}" target="_blank" rel="noopener">通用用户使用说明</a> · 适用于所有渠道的安装、激活与升级流程</p>
        </footer>
      </main>`;
  }

  function initChannelPage(channelId) {
    const id = channelId || document.body.dataset.channel;
    const raw = findChannel(id);
    if (!raw) {
      document.getElementById("app").innerHTML = '<p class="lp-error">未找到渠道：' + escapeHtml(id) + "</p>";
      return;
    }
    renderChannelPage(enrichChannel(raw));
  }

  function initHubPage() {
    const channels = SITE.channels.map(enrichChannel);
    if (!channels.length) {
      document.getElementById("app").innerHTML = '<p class="lp-error">暂无渠道配置</p>';
      return;
    }
    renderHubPage(channels);
  }

  window.LandingPage = { initChannelPage, initHubPage };
})();
