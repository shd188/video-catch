/**
 * First-run page for channel builds (GPL-3.0).
 */
window.addEventListener("DOMContentLoaded", async function () {
    if (typeof licenseUiInitInstallPage === "function") {
        await licenseUiInitInstallPage();
    }
    const manifest = chrome.runtime.getManifest();
    document.getElementById("main-title").textContent =
        (manifest.name || "扩展") + " 已安装";

    fetch(chrome.runtime.getURL("channel-build.json"))
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({}))
        .then((info) => {
            const display = info.channelId
                ? `${info.channelId} · v${manifest.version}`
                : `v${manifest.version}`;
            document.getElementById("subtitle").textContent = display;

            if (info.repositoryUrl) {
                const a = document.getElementById("repo-link");
                a.href = info.repositoryUrl;
                a.textContent = info.repositoryUrl;
            }
        });

    document.getElementById("agreeBtn").addEventListener("click", closeTab);
    document.getElementById("openOptionsBtn").addEventListener("click", function () {
        chrome.runtime.openOptionsPage();
        closeTab();
    });
});
