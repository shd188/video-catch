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

            if (info.pilot?.referenceCourseUrl) {
                const box = document.querySelector(".card-body");
                const sec = document.createElement("div");
                sec.className = "policy-section";
                sec.innerHTML = `
                    <div class="section-title"><span class="emoji">🎓</span><span>试点课程页</span></div>
                    <div class="content-box lang-zh active">
                        <p>请在小鹅通课程页打开扩展使用：</p>
                        <p><a href="${info.pilot.referenceCourseUrl}" target="_blank" rel="noopener">${info.pilot.referenceCourseUrl}</a></p>
                    </div>
                `;
                const buttons = box.querySelector(".buttons");
                box.insertBefore(sec, buttons);
            }
        });

    document.getElementById("agreeBtn").addEventListener("click", closeTab);
    document.getElementById("openOptionsBtn").addEventListener("click", function () {
        chrome.runtime.openOptionsPage();
        closeTab();
    });
});
