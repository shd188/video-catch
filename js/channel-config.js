/**
 * Shared channel-build helpers (GPL-3.0).
 */
function getChannelProtectedStorageKeys() {
    if (typeof G === "undefined" || !G.channelId) { return []; }
    const locks = G._channelLockOptions || ["blockUrl", "blockUrlWhite"];
    const keys = new Set();
    for (const item of locks) {
        if (item === "blockUrl" || item === "blockUrlWhite") {
            keys.add("blockUrl");
            keys.add("blockUrlWhite");
        } else {
            keys.add(item);
        }
    }
    return [...keys];
}

/**
 * Remove channel-locked keys from imported settings object.
 * @returns {{ data: object, stripped: string[] }}
 */
function stripChannelProtectedImport(importData) {
    const stripped = [];
    const data = { ...importData };
    for (const key of getChannelProtectedStorageKeys()) {
        if (data[key] !== undefined) {
            stripped.push(key);
            delete data[key];
        }
    }
    return { data, stripped };
}

function getChannelWhitelistPatterns() {
    const list = G._channelBuildLock?.blockUrl ?? G.OptionLists?.blockUrl ?? [];
    return list.filter((x) => x.state !== false).map((x) => x.url);
}

/** Keys to write back to chrome.storage.sync after import/reset */
function buildChannelStoragePatch() {
    const patch = {};
    if (typeof G === "undefined" || !G.channelId || !G._channelBuildLock) { return patch; }
    const lock = G._channelBuildLock;
    if (lock.blockUrl) patch.blockUrl = G.OptionLists.blockUrl;
    if (typeof lock.blockUrlWhite === "boolean") patch.blockUrlWhite = lock.blockUrlWhite;
    for (const key of Object.keys(lock)) {
        if (key === "blockUrl" || key === "blockUrlWhite") { continue; }
        if (key in G.OptionLists) patch[key] = G.OptionLists[key];
    }
    return patch;
}

function isCurrentTabChannelAllowed(callback) {
    if (!G.channelId || !G.blockUrlWhite) {
        callback(true, null);
        return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const url = tabs[0]?.url;
        if (!url || typeof isLockUrl !== "function") {
            callback(false, url);
            return;
        }
        callback(isLockUrl(url), url);
    });
}
