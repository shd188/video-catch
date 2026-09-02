/**
 * Options page behavior for channel builds (GPL-3.0).
 */
(function () {
    function whenReady(fn) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", fn);
        } else {
            fn();
        }
    }

    whenReady(function () {
        if (typeof G === "undefined" || !G.channelId) { return; }

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = chrome.runtime.getURL("css/channel-options.css");
        document.head.appendChild(link);

        const locks = new Set(G._channelLockOptions || ["blockUrl", "blockUrlWhite"]);

        if (locks.has("blockUrl") || locks.has("blockUrlWhite")) {
            const nav = document.querySelector('.sidebar a[href="#anchorBlockUrl"]');
            if (nav) nav.classList.add("channel-locked-nav");
            const section = document.getElementById("anchorBlockUrl");
            if (section) {
                section.classList.add("channel-locked-section");
                insertWhitelistPanel(section, G);
            }
        }

        if (locks.has("deepSearch")) {
            const deep = document.getElementById("deepSearch");
            if (deep) {
                deep.closest(".item")?.classList.add("channel-whitelist-readonly");
                deep.disabled = true;
            }
        }

        insertBanner();
        patchAboutLinks();
        patchImportExport();
        patchResetHandlers(locks);
    });

    function insertBanner() {
        const wrapper = document.querySelector(".wrapper.options");
        if (!wrapper || document.getElementById("channel-options-banner")) { return; }

        const name = G.channelDisplayName || G.channelId;
        const div = document.createElement("div");
        div.id = "channel-options-banner";
        div.className = "channel-banner";
        div.innerHTML = `
            <h2>${escapeHtml(name)}</h2>
            <p>渠道构建版本：域名白名单由源码配置锁定，并可接收服务端远程追加。修改内置规则请编辑仓库 <code>channels/${escapeHtml(G.channelId)}/channel.json</code> 后重新构建；临时域名可在管理后台「渠道白名单」添加，用户无需重装。</p>
            <p>软件遵循 <strong>GPL-3.0</strong>；付费内容为技术支持与适配服务，见仓库 <code>docs/SERVICE.md</code>。</p>
        `;
        wrapper.insertBefore(div, wrapper.firstChild);
    }

    function insertWhitelistPanel(hiddenSection, G) {
        const wrapper = document.querySelector(".wrapper.options");
        if (!wrapper || document.getElementById("anchorChannelWhitelist")) { return; }

        const urls = (typeof getChannelWhitelistPatterns === "function"
            ? getChannelWhitelistPatterns()
            : (G._channelBuildLock?.blockUrl || G.OptionLists?.blockUrl || [])
                .filter((x) => x.state !== false)
                .map((x) => x.url));

        const section = document.createElement("section");
        section.id = "anchorChannelWhitelist";
        section.innerHTML = `
            <h1 class="optionsTitle">渠道白名单（只读）</h1>
            <div class="optionBox channel-whitelist-readonly">
                <p>白名单模式已启用。仅在下列 URL 模式下嗅探媒体：</p>
                <ul>${urls.map((u) => `<li><code>${escapeHtml(u)}</code></li>`).join("") || "<li>（未配置）</li>"}</ul>
            </div>
        `;
        hiddenSection.parentNode.insertBefore(section, hiddenSection.nextSibling);
    }

    function patchAboutLinks() {
        fetch(chrome.runtime.getURL("channel-build.json"))
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
            .then((info) => {
                if (!info?.repositoryUrl) { return; }
                const about = document.getElementById("anchorAbout");
                if (!about) { return; }
                const gh = about.querySelector('a[href*="github.com"]');
                if (gh) {
                    gh.href = info.repositoryUrl;
                    gh.textContent = info.repositoryUrl;
                }
            });
    }

    function patchImportExport() {
        if (typeof stripChannelProtectedImport !== "function") { return; }

        $("#importOptionsFile").off("change").on("change", function () {
            const fileReader = new FileReader();
            fileReader.onload = function () {
                let importData = this.result;
                try {
                    importData = JSON.parse(importData);
                } catch (e) {
                    importData = Base64.decode(importData);
                    importData = JSON.parse(importData);
                }
                const { data, stripped } = stripChannelProtectedImport(importData);
                const keys = Object.keys(G.OptionLists);
                for (let item in G.OptionLists) {
                    if (keys.includes(item) && data[item] !== undefined) {
                        chrome.storage.sync.set({ [item]: data[item] });
                    }
                }
                if (typeof applyChannelBuildDefaults === "function") {
                    applyChannelBuildDefaults();
                }
                const patch = typeof buildChannelStoragePatch === "function"
                    ? buildChannelStoragePatch()
                    : {};
                chrome.storage.sync.set(patch, function () {
                    let msg = (typeof i18n !== "undefined" ? i18n.alertimport : "导入成功");
                    if (stripped.length) {
                        const tpl = chrome.i18n.getMessage("channelImportStripped")
                            || "已导入。以下渠道锁定项未写入：${keys}";
                        msg = tpl.replace("${keys}", stripped.join(", "));
                    }
                    alert(msg);
                    location.reload();
                });
            };
            const file = $("#importOptionsFile").prop("files")[0];
            if (file) fileReader.readAsText(file);
        });

        $("#exportOptions").off("click").on("click", function () {
            chrome.storage.sync.get(null, function (items) {
                const protectedKeys = new Set(getChannelProtectedStorageKeys());
                const exportItems = { ...items };
                for (const key of protectedKeys) {
                    delete exportItems[key];
                }
                exportItems._channelExportNote = {
                    channelId: G.channelId,
                    omittedKeys: [...protectedKeys],
                    message: "Channel-locked keys omitted from export; see channels/" + G.channelId + "/channel.json",
                };
                let ExportData = JSON.stringify(exportItems);
                ExportData = "data:text/plain," + Base64.encode(ExportData);
                const date = new Date();
                const filename = `${G.channelId}-cat-catch-${chrome.runtime.getManifest().version}-${date.getFullYear()}${appendZero(date.getMonth() + 1)}${appendZero(date.getDate())}.txt`;
                if (G.isFirefox) {
                    downloadDataURL(ExportData, filename);
                    return;
                }
                chrome.downloads.download({ url: ExportData, filename });
            });
        });
    }

    function patchResetHandlers(locks) {
        const protectedOptions = new Set();
        if (locks.has("blockUrl") || locks.has("blockUrlWhite")) {
            protectedOptions.add("blockUrl");
        }
        for (const k of locks) {
            protectedOptions.add(k);
        }

        $("[data-reset]").off("click").on("click", function () {
            const Option = $(this).data("reset");
            if (protectedOptions.has(Option)) {
                alert(channelMsg(
                    "该设置由渠道构建锁定，请修改 channels/" + G.channelId + "/channel.json 后重新构建。",
                    "This setting is locked by the channel build."
                ));
                return;
            }
            if (confirm(i18n.confirmReset)) {
                chrome.storage.sync.set({ [Option]: G.OptionLists[Option] }, () => location.reload());
            }
        });

        $("#ClearData").off("click").on("click", function () {
            chrome.storage.local.clear();
            (chrome.storage.session ?? { clear: (cb) => cb() }).clear();
            chrome.runtime.sendMessage({ Message: "ClearIcon" });
            location.reload();
        });

        $("#ResetAllOption").off("click").on("click", function () {
            if (!confirm(i18n.confirmReset)) { return; }
            chrome.storage.sync.clear(function () {
                if (typeof InitOptions === "function") { InitOptions(); }
                chrome.storage.local.clear();
                if (chrome.storage.session) { chrome.storage.session.clear(); }
                chrome.runtime.sendMessage({ Message: "ClearIcon" });
                location.reload();
            });
        });
    }

    function channelMsg(zh, en) {
        const lang = (navigator.language || "").toLowerCase();
        return lang.startsWith("zh") ? zh : en;
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }
})();
