/**
 * GPL-3.0 — Announce channel install/activation status to the public /guide/ page.
 * Only runs on paths under /guide so normal sites stay unaffected.
 */
(function () {
    "use strict";

    try {
        const path = location.pathname || "";
        if (path !== "/guide" && path !== "/guide/" && !path.startsWith("/guide/")) {
            return;
        }
    } catch (_) {
        return;
    }

    const PING = "VIDEO_CATCH_GUIDE_PING";
    const PONG = "VIDEO_CATCH_GUIDE_PONG";

    function getLicenseKeys() {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.get(
                    ["licenseKey", "licenseActivatedOnce"],
                    (items) => {
                        if (chrome.runtime.lastError) {
                            resolve({});
                            return;
                        }
                        resolve(items || {});
                    }
                );
            } catch (_) {
                resolve({});
            }
        });
    }

    async function readChannelBuild() {
        try {
            const res = await fetch(chrome.runtime.getURL("channel-build.json"));
            if (!res.ok) return null;
            return await res.json();
        } catch (_) {
            return null;
        }
    }

    async function buildPayload() {
        const build = await readChannelBuild();
        const items = await getLicenseKeys();
        let version = "";
        try {
            version = chrome.runtime.getManifest().version || "";
        } catch (_) {}
        return {
            type: PONG,
            channelId: build?.channelId || null,
            displayName: build?.displayName || build?.extensionName || null,
            version,
            activated: !!(items.licenseKey || items.licenseActivatedOnce),
            extensionId: chrome.runtime.id,
            at: Date.now(),
        };
    }

    async function announce() {
        const payload = await buildPayload();
        try {
            window.postMessage(payload, "*");
        } catch (_) {}
        try {
            document.documentElement.setAttribute(
                "data-video-catch-beacon",
                JSON.stringify(payload)
            );
        } catch (_) {}
    }

    window.addEventListener("message", function (e) {
        if (e.source !== window) return;
        if (!e.data || e.data.type !== PING) return;
        announce();
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", announce);
    } else {
        announce();
    }
})();
