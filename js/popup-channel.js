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
        $bar.find(".channel-title").text(name);

        const renderWhitelist = function () {
            const patterns = typeof getChannelWhitelistPatterns === "function"
                ? getChannelWhitelistPatterns()
                : [];
            isCurrentTabChannelAllowed(function (allowed, tabUrl) {
                if (allowed) {
                    $bar.removeClass("channel-blocked").addClass("channel-allowed");
                    const isUniversal = G.blockUrlWhite === false;
                    const detail = isUniversal
                        ? i18nChannel("popupChannelAllowed", "全能渠道：当前页面可嗅探")
                        : `${i18nChannel("popupChannelAllowed", "当前页面在白名单内，可嗅探")}`
                            + (patterns.length ? `<br><span title="${escapeAttr(patterns.join("\n"))}">${i18nChannel("popupChannelPatterns", "规则")}：${patterns.length} 条</span>` : "");
                    $bar.find(".channel-detail").html(detail);
                } else {
                    $bar.removeClass("channel-allowed").addClass("channel-blocked");
                    const host = tabUrl ? tryHost(tabUrl) : "—";
                    $bar.find(".channel-detail").html(
                        `${i18nChannel("popupChannelBlocked", "当前页面不在渠道白名单内，不会嗅探")}`
                        + `<br>${i18nChannel("popupChannelHost", "当前")}：<code>${escapeHtml(host)}</code>`
                    );
                }
            });
        };

        const renderLicenseState = function () {
            if (typeof licenseBootstrap !== "function" || !G.channelLicenseApi?.apiBase) {
                renderWhitelist();
                return;
            }
            licenseBootstrap().then(function () {
                if (G.licenseActive !== true) {
                    $bar.removeClass("channel-allowed").addClass("channel-blocked");
                    const installUrl = chrome.runtime.getURL(G.channelInstallPage || "channel-install.html");
                    const revoked = typeof LicenseState !== "undefined" && LicenseState.code === "REVOKED";
                    const statusText = revoked
                        ? i18nChannel("popupChannelRevoked", "激活码已作废，嗅探已禁用")
                        : i18nChannel("popupChannelNeedActivate", "尚未激活，嗅探已禁用");
                    $bar.find(".channel-detail").html(
                        `${statusText}`
                        + `<br><a href="${escapeAttr(installUrl)}" target="_blank" rel="noopener">`
                        + `${i18nChannel("popupChannelOpenActivate", "打开激活页")}</a>`
                    );
                    return;
                }
                renderWhitelist();
                if (typeof licenseShowPopupUpdateModal === "function") {
                    licenseShowPopupUpdateModal();
                }
            }).catch(function () {
                renderWhitelist();
            });
        };

        renderLicenseState();
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
