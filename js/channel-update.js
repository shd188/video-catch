/**
 * Standalone update prompt page (channel builds).
 */
window.addEventListener("DOMContentLoaded", async function () {
    const root = document.getElementById("updateRoot");
    if (!root) return;

    let upd = typeof licenseGetUpdate === "function" ? licenseGetUpdate() : null;
    if (!upd?.download_url) {
        upd = await new Promise((resolve) => {
            chrome.storage.local.get(["pendingUpdate"], (items) => resolve(items.pendingUpdate || null));
        });
    }

    if (!upd?.download_url) {
        if (typeof licenseBootstrap === "function") {
            await licenseBootstrap();
            upd = typeof licenseGetUpdate === "function" ? licenseGetUpdate() : null;
        }
    }

    if (!upd?.download_url) {
        root.innerHTML = `<div class="ch-update-backdrop"><div class="ch-update-dialog">
            <p class="ch-update-sub">当前已是最新版本，或暂无可用的更新包。</p>
            <div class="ch-update-actions">
                <button type="button" class="btn btn-outline" id="chUpdateCloseBtn">关闭</button>
            </div>
        </div></div>`;
        document.getElementById("chUpdateCloseBtn")?.addEventListener("click", function () {
            closeTab();
        });
        return;
    }

    const should = await licenseShouldPromptUpdate(upd);
    if (!should) {
        closeTab();
        return;
    }

    const folder = typeof licenseUpdateGetChannelFolder === "function"
        ? await licenseUpdateGetChannelFolder()
        : "xiaoetong";
    root.innerHTML = licenseBuildUpdateDialogHtml(upd, folder);
    licenseBindUpdateDialog(root, upd, {
        onClose: function (dismissed) {
            if (dismissed) {
                closeTab();
                return;
            }
            setTimeout(closeTab, 600);
        },
    });
});
