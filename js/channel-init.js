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
            url: wildcardToRegex(item.url),
            state: item.state,
        }));
    }
    for (const key of Object.keys(lock)) {
        if (key === "blockUrl" || key === "blockUrlWhite") { continue; }
        if (!(key in G.OptionLists)) { continue; }
        G.OptionLists[key] = lock[key];
        G[key] = lock[key];
    }
}
