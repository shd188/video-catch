/**
 * Guide install wizard — interactive steps + extension beacon detection.
 * Depends on DOM from /guide/index.html (#panel-wizard).
 */
(function () {
  "use strict";

  var PING = "VIDEO_CATCH_GUIDE_PING";
  var PONG = "VIDEO_CATCH_GUIDE_PONG";

  var CHANNELS = [
    {
      id: "xiaoetong",
      name: "小鹅通视频下载",
      zip: "xiaoetong.zip",
      folder: "xiaoetong",
      sites: "小鹅通 H5 / PC 课程页",
    },
    {
      id: "tencentmeeting",
      name: "腾讯会议视频下载",
      zip: "tencentmeeting.zip",
      folder: "tencentmeeting",
      sites: "meeting.tencent.com",
    },
    {
      id: "feishu",
      name: "飞书视频下载",
      zip: "feishu.zip",
      folder: "feishu",
      sites: "飞书 / Lark 网页",
    },
    {
      id: "quanneng",
      name: "全能视频下载",
      zip: "quanneng.zip",
      folder: "quanneng",
      sites: "普通 http(s) 网页",
    },
  ];

  var state = {
    channelId: null,
    browser: "unknown",
    step: 1,
    checks: {
      hasZip: false,
      unzipped: false,
      openedExtPage: false,
      devMode: false,
      loaded: false,
      activated: false,
    },
    beacons: {},
  };

  var els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function detectBrowser() {
    var ua = navigator.userAgent || "";
    if (/Edg\//.test(ua)) return "edge";
    if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "chrome";
    if (/Firefox\//.test(ua)) return "firefox";
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "safari";
    return "unknown";
  }

  function extensionsUrl() {
    return state.browser === "edge" ? "edge://extensions" : "chrome://extensions";
  }

  function channelById(id) {
    for (var i = 0; i < CHANNELS.length; i++) {
      if (CHANNELS[i].id === id) return CHANNELS[i];
    }
    return null;
  }

  function selectedChannel() {
    return channelById(state.channelId);
  }

  function queryChannelFromUrl() {
    try {
      var q = new URLSearchParams(location.search).get("channel");
      if (q && channelById(q)) return q;
    } catch (_) {}
    return null;
  }

  function saveProgress() {
    try {
      localStorage.setItem(
        "vc-guide-wizard",
        JSON.stringify({
          channelId: state.channelId,
          step: state.step,
          checks: state.checks,
        })
      );
    } catch (_) {}
  }

  function loadProgress() {
    try {
      var raw = localStorage.getItem("vc-guide-wizard");
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data.channelId && channelById(data.channelId)) {
        state.channelId = data.channelId;
      }
      if (data.checks && typeof data.checks === "object") {
        Object.keys(state.checks).forEach(function (k) {
          if (typeof data.checks[k] === "boolean") state.checks[k] = data.checks[k];
        });
      }
      if (typeof data.step === "number" && data.step >= 1 && data.step <= 6) {
        state.step = data.step;
      }
    } catch (_) {}
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return fallbackCopy(text);
        }
      );
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (_) {}
    document.body.removeChild(ta);
    return ok;
  }

  function flashBtn(btn, okText) {
    if (!btn) return;
    var prev = btn.textContent;
    btn.textContent = okText || "已复制";
    btn.disabled = true;
    setTimeout(function () {
      btn.textContent = prev;
      btn.disabled = false;
    }, 1600);
  }

  function beaconList() {
    return Object.keys(state.beacons).map(function (k) {
      return state.beacons[k];
    });
  }

  function matchingBeacon() {
    var list = beaconList();
    if (!list.length) return null;
    if (state.channelId) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].channelId === state.channelId) return list[i];
      }
    }
    return list[0];
  }

  function syncChecksFromBeacon() {
    var b = matchingBeacon();
    if (!b) return;
    state.checks.loaded = true;
    if (b.activated) state.checks.activated = true;
    if (!state.channelId && b.channelId && channelById(b.channelId)) {
      state.channelId = b.channelId;
    }
  }

  function requestBeacon() {
    try {
      window.postMessage({ type: PING }, "*");
    } catch (_) {}
    try {
      var attr = document.documentElement.getAttribute("data-video-catch-beacon");
      if (attr) {
        var parsed = JSON.parse(attr);
        if (parsed && parsed.type === PONG) ingestBeacon(parsed);
      }
    } catch (_) {}
  }

  function ingestBeacon(payload) {
    if (!payload || payload.type !== PONG) return;
    var key = payload.extensionId || payload.channelId || "unknown";
    state.beacons[key] = payload;
    syncChecksFromBeacon();
    render();
  }

  function setStep(n) {
    if (n < 1) n = 1;
    if (n > 6) n = 6;
    state.step = n;
    saveProgress();
    render();
    var panel = $("wizard-steps");
    if (panel) {
      var active = panel.querySelector('.wiz-step[data-step="' + n + '"]');
      if (active) active.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function setCheck(key, value) {
    state.checks[key] = !!value;
    saveProgress();
    render();
  }

  function setChannel(id) {
    if (!channelById(id)) return;
    state.channelId = id;
    saveProgress();
    render();
  }

  function browserLabel() {
    if (state.browser === "chrome") return "Google Chrome";
    if (state.browser === "edge") return "Microsoft Edge";
    if (state.browser === "firefox") return "Firefox（本扩展主要支持 Chrome / Edge）";
    if (state.browser === "safari") return "Safari（不支持侧载本扩展，请改用 Chrome 或 Edge）";
    return "未识别，请使用 Chrome 或 Edge";
  }

  function browserOk() {
    return state.browser === "chrome" || state.browser === "edge";
  }

  function statusClass() {
    var b = matchingBeacon();
    if (b && b.activated) return "ok";
    if (b) return "warn";
    return "idle";
  }

  function statusText() {
    var list = beaconList();
    var ch = selectedChannel();
    if (!list.length) {
      return "尚未检测到扩展。装好后回到本页点「重新检测」，或刷新页面。";
    }
    var parts = list.map(function (b) {
      var name = b.displayName || b.channelId || "扩展";
      var act = b.activated ? "已激活" : "未激活";
      var ver = b.version ? " v" + b.version : "";
      return name + ver + "（" + act + "）";
    });
    var msg = "已检测到：" + parts.join("；");
    if (ch) {
      var hit = list.some(function (b) {
        return b.channelId === ch.id;
      });
      if (!hit) {
        msg += " —— 注意：当前选的是「" + ch.name + "」，检测到的渠道不一致。";
      }
    }
    return msg;
  }

  function renderStatus() {
    var bar = $("wiz-status");
    if (!bar) return;
    bar.className = "wiz-status " + statusClass();
    var text = $("wiz-status-text");
    if (text) text.textContent = statusText();
  }

  function renderBrowserBanner() {
    var el = $("wiz-browser");
    if (!el) return;
    el.className = "wiz-browser " + (browserOk() ? "ok" : "bad");
    el.innerHTML =
      "<strong>当前浏览器：</strong>" +
      browserLabel() +
      (browserOk()
        ? ""
        : ' · 请用 Chrome / Edge 打开本页继续。<a href="#video">也可先看视频了解流程</a>');
  }

  function renderChannelPicker() {
    var box = $("wiz-channels");
    if (!box) return;
    box.innerHTML = CHANNELS.map(function (ch) {
      var active = state.channelId === ch.id ? " is-active" : "";
      return (
        '<button type="button" class="wiz-channel' +
        active +
        '" data-channel="' +
        ch.id +
        '">' +
        "<strong>" +
        ch.name +
        "</strong>" +
        "<span>" +
        ch.sites +
        "</span>" +
        "<em>安装包 " +
        ch.zip +
        "</em>" +
        "</button>"
      );
    }).join("");
  }

  function fillChannelHints() {
    var ch = selectedChannel();
    var name = ch ? ch.name : "（请先选择渠道）";
    var zip = ch ? ch.zip : "对应渠道.zip";
    var folder = ch ? ch.folder : "解压后的文件夹";
    document.querySelectorAll("[data-ch-name]").forEach(function (n) {
      n.textContent = name;
    });
    document.querySelectorAll("[data-ch-zip]").forEach(function (n) {
      n.textContent = zip;
    });
    document.querySelectorAll("[data-ch-folder]").forEach(function (n) {
      n.textContent = folder;
    });
    document.querySelectorAll("[data-ext-url]").forEach(function (n) {
      n.textContent = extensionsUrl();
    });
  }

  function renderSteps() {
    var root = $("wizard-steps");
    if (!root) return;
    root.querySelectorAll(".wiz-step").forEach(function (stepEl) {
      var n = Number(stepEl.getAttribute("data-step"));
      stepEl.classList.toggle("is-current", n === state.step);
      stepEl.classList.toggle("is-done", n < state.step);
      var body = stepEl.querySelector(".wiz-step-body");
      if (body) body.hidden = n !== state.step;
    });

    root.querySelectorAll("[data-check]").forEach(function (input) {
      var key = input.getAttribute("data-check");
      if (key && Object.prototype.hasOwnProperty.call(state.checks, key)) {
        input.checked = !!state.checks[key];
      }
    });

    var nextBtns = root.querySelectorAll("[data-next]");
    nextBtns.forEach(function (btn) {
      var needChannel = btn.hasAttribute("data-need-channel");
      var needBrowser = btn.hasAttribute("data-need-browser");
      var disabled = false;
      if (needChannel && !state.channelId) disabled = true;
      if (needBrowser && !browserOk()) disabled = true;
      var needChecks = btn.getAttribute("data-need-checks");
      if (needChecks) {
        needChecks.split(",").forEach(function (k) {
          k = k.trim();
          if (k && !state.checks[k]) disabled = true;
        });
      }
      btn.disabled = disabled;
    });
  }

  function renderDetectPanel() {
    var result = $("wiz-detect-result");
    if (!result) return;
    var b = matchingBeacon();
    var ch = selectedChannel();
    if (!b) {
      result.className = "wiz-detect bad";
      result.innerHTML =
        "<strong>未检测到扩展</strong>" +
        "<p>请确认已「加载已解压的扩展程序」，且选中的是文件夹 <code>" +
        (ch ? ch.folder : "…") +
        "</code>（不是 zip）。装好后点下方「重新检测」，或刷新本页。</p>" +
        "<ul>" +
        "<li>常见错误：直接加载了 zip 文件</li>" +
        "<li>常见错误：解压后多套了一层文件夹，应选到含 <code>manifest.json</code> 的那一层</li>" +
        "<li>常见错误：用了 Safari / 非 Chromium 浏览器</li>" +
        "</ul>";
      return;
    }
    if (ch && b.channelId && b.channelId !== ch.id) {
      result.className = "wiz-detect warn";
      result.innerHTML =
        "<strong>检测到其他渠道扩展</strong>" +
        "<p>当前选择的是「" +
        ch.name +
        "」，但浏览器里检测到的是「" +
        (b.displayName || b.channelId) +
        "」。若您买的是另一个渠道，请改选渠道；若装错了包，请加载正确的 zip。</p>";
      return;
    }
    if (!b.activated) {
      result.className = "wiz-detect warn";
      result.innerHTML =
        "<strong>扩展已安装，尚未激活</strong>" +
        "<p>首次加载后应自动打开「安装说明」页。在其中的「渠道激活」输入激活码并点击激活。完成后回到本页再点「重新检测」。</p>" +
        "<p class=\"wiz-muted\">若说明页已关掉：打开扩展 Popup，或在 <code>" +
        extensionsUrl() +
        "</code> 找到扩展，点「详细信息」里的扩展选项 / 重新打开安装页。</p>";
      return;
    }
    result.className = "wiz-detect ok";
    result.innerHTML =
      "<strong>安装成功</strong>" +
      "<p>已检测到「" +
      (b.displayName || (ch && ch.name) || "扩展") +
      "」" +
      (b.version ? " v" + b.version : "") +
      "，且已激活。可以去对应网站打开视频试一下嗅探。</p>";
  }

  function render() {
    renderStatus();
    renderBrowserBanner();
    renderChannelPicker();
    fillChannelHints();
    renderSteps();
    renderDetectPanel();
  }

  function bind() {
    var root = $("panel-wizard");
    if (!root) return;

    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-channel]");
      if (t) {
        setChannel(t.getAttribute("data-channel"));
        return;
      }
      t = e.target.closest("[data-goto]");
      if (t) {
        setStep(Number(t.getAttribute("data-goto")));
        return;
      }
      t = e.target.closest("[data-next]");
      if (t && !t.disabled) {
        setStep(state.step + 1);
        return;
      }
      t = e.target.closest("[data-prev]");
      if (t) {
        setStep(state.step - 1);
        return;
      }
      t = e.target.closest("[data-copy]");
      if (t) {
        var val = t.getAttribute("data-copy");
        if (val === "ext-url") val = extensionsUrl();
        copyText(val).then(function (ok) {
          flashBtn(t, ok ? "已复制" : "复制失败");
        });
        return;
      }
      t = e.target.closest("[data-redetect]");
      if (t) {
        requestBeacon();
        flashBtn(t, "检测中…");
        setTimeout(requestBeacon, 400);
        return;
      }
    });

    root.addEventListener("change", function (e) {
      var input = e.target;
      if (input && input.matches("[data-check]")) {
        setCheck(input.getAttribute("data-check"), input.checked);
      }
    });

    window.addEventListener("message", function (e) {
      if (e.source !== window) return;
      if (!e.data || e.data.type !== PONG) return;
      ingestBeacon(e.data);
    });

    var redetect = $("wiz-redetect-top");
    if (redetect) {
      redetect.addEventListener("click", function () {
        requestBeacon();
      });
    }
  }

  function init() {
    state.browser = detectBrowser();
    loadProgress();
    var fromUrl = queryChannelFromUrl();
    if (fromUrl) state.channelId = fromUrl;
    bind();
    render();
    requestBeacon();
    setTimeout(requestBeacon, 500);
    setTimeout(requestBeacon, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.GuideWizard = {
    requestBeacon: requestBeacon,
    getState: function () {
      return state;
    },
  };
})();
