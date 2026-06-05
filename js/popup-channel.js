/**
 * Popup UI for channel builds: whitelist status (GPL-3.0).
 */
(function () {
    const barInterval = setInterval(function () {
        if (typeof G === "undefined" || !G.channelId || !G.initSyncComplete) { return; }
        clearInterval(barInterval);
        renderChannelBar();
    }, 50);

    function renderChannelBar() {
        if (document.getElementById("channelPopupBar")) { return; }

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = chrome.runtime.getURL("css/popup-channel.css");
        document.head.appendChild(link);

        const $bar = $(`
            <div id="channelPopupBar" class="channel-allowed">
                <div class="channel-title"></div>
                <div class="channel-detail"></div>
            </div>
        `);
        $(".Tabs").after($bar);

        const name = G.channelDisplayName || G.channelId;
        const patterns = typeof getChannelWhitelistPatterns === "function"
            ? getChannelWhitelistPatterns()
            : [];
        $bar.find(".channel-title").text(name);

        if (typeof licenseCheck === "function") {
            licenseCheck(false).then(function () {
                const upd = typeof licenseGetUpdate === "function" ? licenseGetUpdate() : (G.licenseUpdate || null);
                if (upd?.download_url) {
                    const $u = $(`<div class="channel-detail">
                        <a href="${escapeAttr(upd.download_url)}" target="_blank" rel="noopener">
                        新版本 ${escapeHtml(upd.version)} 可下载</a></div>`);
                    $bar.append($u);
                }
            }).catch(function () { });
        }

        isCurrentTabChannelAllowed(function (allowed, tabUrl) {
            if (allowed) {
                $bar.removeClass("channel-blocked").addClass("channel-allowed");
                $bar.find(".channel-detail").html(
                    `${i18nChannel("popupChannelAllowed", "当前页面在白名单内，可嗅探")}`
                    + (patterns.length ? `<br><span title="${escapeAttr(patterns.join("\n"))}">${i18nChannel("popupChannelPatterns", "规则")}：${patterns.length} 条</span>` : "")
                );
            } else {
                $bar.removeClass("channel-allowed").addClass("channel-blocked");
                const host = tabUrl ? tryHost(tabUrl) : "—";
                $bar.find(".channel-detail").html(
                    `${i18nChannel("popupChannelBlocked", "当前页面不在渠道白名单内，不会嗅探")}`
                    + `<br>${i18nChannel("popupChannelHost", "当前")}：<code>${escapeHtml(host)}</code>`
                );
            }
        });
    }

    function i18nChannel(key, fallback) {
        const m = chrome.i18n.getMessage(key);
        return m || fallback;
    }

    function tryHost(url) {
        try { return new URL(url).host; } catch (e) { return url; }
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function escapeAttr(s) {
        return escapeHtml(s).replace(/"/g, "&quot;");
    }
})();
