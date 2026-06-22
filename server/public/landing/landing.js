(function () {
  "use strict";

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

  function channelIdFromPath() {
    const parts = location.pathname.replace(/\/+$/, "").split("/");
    const idx = parts.indexOf("landing");
    return idx >= 0 ? parts[idx + 1] || "" : "";
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  function renderChannelPage(data) {
    document.title = data.displayName + " — 渠道落地页";
    document.body.dataset.theme = data.theme || data.id;

    const versionLine = data.latestVersion
      ? `当前版本 v${escapeHtml(data.latestVersion)}`
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

    const iconSrc = data.iconUrl || `/landing/icons/${data.id}.png`;

    document.getElementById("app").innerHTML = `
      <nav class="lp-nav">
        <div class="lp-nav-inner">
          <a class="lp-brand" href="/landing/">
            <img src="${escapeHtml(iconSrc)}" alt="" width="36" height="36" />
            <span>${escapeHtml(data.displayName)}</span>
          </a>
          <div class="lp-nav-links">
            <a class="lp-btn lp-btn-ghost" href="/landing/">全部渠道</a>
            <a class="lp-btn lp-btn-ghost" href="${escapeHtml(data.guideUrl)}">使用说明</a>
            <a class="lp-btn lp-btn-primary" href="${escapeHtml(data.guideUrl)}">开始安装</a>
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
              <a class="lp-btn lp-btn-primary" href="${escapeHtml(data.guideUrl)}">查看安装与使用说明</a>
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
          <p>安装包与激活码由服务商发放。详细图文步骤见用户使用说明，合规使用、仅限已授权内容。</p>
          <a class="lp-btn lp-btn-primary" href="${escapeHtml(data.guideUrl)}">打开使用说明</a>
        </section>

        <footer class="lp-footer">
          <p>
            基于 Cat-Catch（GPL-3.0）构建 ·
            ${data.repositoryUrl ? `<a href="${escapeHtml(data.repositoryUrl)}" target="_blank" rel="noopener">源码仓库</a> · ` : ""}
            <a href="${escapeHtml(data.guideUrl)}">用户指南</a>
          </p>
          <p>请仅下载您有权访问、备份或学习的课程内容。</p>
        </footer>
      </main>`;
  }

  function renderHubPage(channels) {
    document.title = "Video-Catch 渠道落地页";
    document.body.dataset.theme = "hub";

    const cards = channels
      .map(
        (c) => `<a class="lp-channel-card" href="/landing/${encodeURIComponent(c.id)}/" data-theme-card="${escapeHtml(c.theme || c.id)}">
          <div class="lp-channel-card-head">
            <img src="${escapeHtml(c.iconUrl || `/landing/icons/${c.id}.png`)}" alt="" width="56" height="56" />
            <div>
              <h2>${escapeHtml(c.displayName)}</h2>
              ${c.latestVersion ? `<span style="font-size:13px;color:var(--lp-muted)">v${escapeHtml(c.latestVersion)}</span>` : ""}
            </div>
          </div>
          <p>${escapeHtml(c.heroSubtitle || c.description)}</p>
          <span class="lp-btn lp-btn-primary" style="align-self:flex-start">进入落地页 →</span>
        </a>`
      )
      .join("");

    document.getElementById("app").innerHTML = `
      <nav class="lp-nav">
        <div class="lp-nav-inner">
          <a class="lp-brand" href="/landing/">
            <span>Video-Catch 渠道</span>
          </a>
          <div class="lp-nav-links">
            <a class="lp-btn lp-btn-ghost" href="/guide/">用户使用说明</a>
            <a class="lp-btn lp-btn-ghost" href="/admin/">管理后台</a>
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
          <p><a href="/guide/">通用用户使用说明</a> · 适用于所有渠道的安装、激活与升级流程</p>
        </footer>
      </main>`;
  }

  async function initChannelPage() {
    const id = channelIdFromPath();
    if (!id) {
      document.getElementById("app").innerHTML = '<p class="lp-error">缺少渠道 ID</p>';
      return;
    }
    try {
      const data = await fetchJson("/api/public/landing/channels/" + encodeURIComponent(id));
      renderChannelPage(data);
    } catch (e) {
      document.getElementById("app").innerHTML =
        '<p class="lp-error">无法加载渠道信息：' + escapeHtml(e.message) + "</p>";
    }
  }

  async function initHubPage() {
    try {
      const { channels } = await fetchJson("/api/public/landing/channels");
      if (!channels?.length) {
        document.getElementById("app").innerHTML = '<p class="lp-error">暂无可用渠道</p>';
        return;
      }
      renderHubPage(channels);
    } catch (e) {
      document.getElementById("app").innerHTML =
        '<p class="lp-error">无法加载渠道列表：' + escapeHtml(e.message) + "</p>";
    }
  }

  window.LandingPage = { initChannelPage, initHubPage };
})();
