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

const CHANNEL_VIDEO_EXTS = ["mp4", "webm", "mov", "m4v", "mkv", "m4s", "ogg", "ogv", "3gp", "mpeg"];

function channelIsVideoMedia(info) {
    if (!info) { return false; }
    const ext = String(info.ext || "").toLowerCase();
    if (["m3u8", "m3u", "mpd"].includes(ext)) { return false; }
    if (info.type?.startsWith("video/")) { return true; }
    return CHANNEL_VIDEO_EXTS.includes(ext);
}

function channelNameLacksVideoExtension(name) {
    if (!name) { return true; }
    return !/\.(mp4|webm|mov|m4v|mkv|m4s|mp3|m4a|wav|ogg|ogv|3gp|mpeg)$/i.test(name);
}

/** 腾讯会议 / 全能渠道都需要处理腾讯会议回放的 text 误嗅探与 COS 下载 */
function channelAppliesTencentMeetingMediaFix() {
    return typeof G !== "undefined"
        && (G.channelId === "tencentmeeting" || G.channelId === "quanneng");
}

function channelIsTencentMeetingCosUrl(url) {
    const u = String(url || "").toLowerCase();
    return u.includes("ylz.cos.meeting.tencent.com")
        || u.includes("cos.meeting.tencent.com");
}

/** 渠道嗅探过滤：true 表示丢弃该资源 */
function channelShouldIgnoreSniffedMedia(info) {
    if (!info || typeof G === "undefined" || !G.channelId) {
        return false;
    }
    if (!channelAppliesTencentMeetingMediaFix()) { return false; }

    const ext = String(info.ext || "").toLowerCase();
    const type = String(info.type || "").toLowerCase();
    const name = String(info.name || "").toLowerCase();
    const url = String(info.url || "").toLowerCase();

    // 全能渠道：只过滤腾讯会议相关的 text / .txt 误报，避免影响其它站点
    if (G.channelId === "quanneng") {
        const isTencent = url.includes("meeting.tencent.com") || channelIsTencentMeetingCosUrl(url);
        if (!isTencent) { return false; }
    }

    if (ext === "txt" || ext === "plain") { return true; }
    if (type.startsWith("text/")) { return true; }
    if (/\.txt(\?|#|$)/.test(url) || /\.txt$/i.test(name)) { return true; }
    if (/recording-\d+\.txt(\?|#|$)/i.test(url) || /recording-\d+\.txt$/i.test(name)) { return true; }

    return false;
}

/** 腾讯会议 COS 等资源下载需携带嗅探到的请求头，不能用裸 chrome.downloads.download */
function channelPreferCatDownload(info) {
    if (!info) { return false; }
    // 按 URL 判断：腾讯会议 / 全能等渠道访问 COS 时都走猫抓下载器
    return channelIsTencentMeetingCosUrl(info.url);
}

/** 渠道下载文件名修正（就地修改 info） */
function channelNormalizeMediaForDownload(info) {
    if (!info || typeof G === "undefined" || !G.channelId) { return; }
    if (G.channelId === "feishu" && channelIsVideoMedia(info)) {
        if (!info.ext || !CHANNEL_VIDEO_EXTS.includes(String(info.ext).toLowerCase())) {
            info.ext = "mp4";
        }
        if (info.name && channelNameLacksVideoExtension(info.name)) {
            info.name = info.name + ".mp4";
        }
    }
}
