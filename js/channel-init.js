/**
 * Channel build overlay (GPL-3.0).
 * Stock tree: no-op. Channel builds overwrite via `npm run build -- <channel>`.
 */
(function () {
    if (typeof G === "undefined" || !G.OptionLists) { return; }
})();

/**
 * Re-apply channel defaults after chrome.storage.sync (channel builds only).
 */
function applyChannelBuildDefaults() {
    if (typeof G === "undefined" || !G.channelId || !G._channelBuildLock) { return; }
    const lock = G._channelBuildLock;
    if (typeof lock.blockUrlWhite === "boolean") {
        G.blockUrlWhite = lock.blockUrlWhite;
        G.OptionLists.blockUrlWhite = lock.blockUrlWhite;
    }
    if (Array.isArray(lock.blockUrl)) {
        G.OptionLists.blockUrl = lock.blockUrl.map((item) => ({
            url: item.url,
            state: item.state !== false,
        }));
        G.blockUrl = G.OptionLists.blockUrl.map((item) => ({
            url: typeof wildcardToRegex === "function" ? wildcardToRegex(item.url) : item.url,
            state: item.state,
        }));
    }
    for (const key of Object.keys(lock)) {
        if (key === "blockUrl" || key === "blockUrlWhite") { continue; }
        if (!(key in G.OptionLists)) { continue; }
        G.OptionLists[key] = lock[key];
        G[key] = lock[key];
    }
    mergeChannelRemoteWhitelist();
    ensureChannelRemoteWhitelistLoaded();
}

function sanitizeChannelRemoteBlockUrl(list) {
    if (!Array.isArray(list)) { return []; }
    const out = [];
    const seen = new Set();
    for (const item of list) {
        const url = String(item?.url || item || "").trim();
        if (!url || seen.has(url)) { continue; }
        seen.add(url);
        out.push({ url, state: true });
    }
    return out;
}

function mergeChannelRemoteWhitelist() {
    if (typeof G === "undefined" || !G.channelId || G.blockUrlWhite !== true) { return; }
    const extras = sanitizeChannelRemoteBlockUrl(G._channelRemoteBlockUrl);
    if (!extras.length) { return; }
    if (!Array.isArray(G.OptionLists.blockUrl)) {
        G.OptionLists.blockUrl = [];
    }
    if (!Array.isArray(G.blockUrl)) {
        G.blockUrl = [];
    }
    const seen = new Set(G.OptionLists.blockUrl.map((x) => x.url));
    for (const item of extras) {
        if (seen.has(item.url)) { continue; }
        seen.add(item.url);
        G.OptionLists.blockUrl.push({ url: item.url, state: true });
        G.blockUrl.push({
            url: typeof wildcardToRegex === "function" ? wildcardToRegex(item.url) : item.url,
            state: true,
        });
    }
}

function ensureChannelRemoteWhitelistLoaded() {
    if (typeof G === "undefined" || G._channelRemoteBlockUrlLoaded) { return; }
    if (!chrome?.storage?.local) { return; }
    G._channelRemoteBlockUrlLoaded = true;
    chrome.storage.local.get(["channelRemoteBlockUrl"], function (items) {
        if (!G._channelRemoteBlockUrlSynced) {
            G._channelRemoteBlockUrl = sanitizeChannelRemoteBlockUrl(items?.channelRemoteBlockUrl);
        }
        applyChannelBuildDefaults();
        refreshChannelBlockUrlSet();
    });
}

function setChannelRemoteBlockUrl(list) {
    if (typeof G === "undefined") { return; }
    G._channelRemoteBlockUrl = sanitizeChannelRemoteBlockUrl(list);
    G._channelRemoteBlockUrlLoaded = true;
    G._channelRemoteBlockUrlSynced = true;
    applyChannelBuildDefaults();
    refreshChannelBlockUrlSet();
}

function refreshChannelBlockUrlSet() {
    if (typeof G === "undefined" || typeof isLockUrl !== "function" || !chrome?.tabs?.query) { return; }
    chrome.tabs.query({}, function (tabs) {
        if (!G.blockUrlSet) { G.blockUrlSet = new Set(); }
        for (const tab of tabs || []) {
            if (!tab?.id || !tab.url) { continue; }
            G.blockUrlSet.delete(tab.id);
            if (isLockUrl(tab.url)) { G.blockUrlSet.add(tab.id); }
        }
    });
}
