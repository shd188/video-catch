/**
 * Delivery panel for /d/:token — pan link + manual license claim.
 * Expects window.__VC_DELIVER__ = { channelId, token } injected by the server.
 */
(function () {
  "use strict";

  var cfg = window.__VC_DELIVER__;
  if (!cfg || !cfg.channelId || !cfg.token) return;

  var channelId = cfg.channelId;
  var token = cfg.token;
  var LS_KEY = "vc_deliver_key_" + channelId;

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showToast(msg) {
    var el = $("deliver-toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      el.hidden = true;
    }, 1800);
  }

  function copyText(text) {
    if (!text) return Promise.reject();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  function renderPan(pan) {
    var urlEl = $("deliver-pan-url");
    var codeWrap = $("deliver-pan-code-wrap");
    var codeEl = $("deliver-pan-code");
    var missing = $("deliver-pan-missing");
    if (!urlEl) return;
    if (pan && pan.url) {
      urlEl.href = pan.url;
      urlEl.textContent = "打开网盘下载安装包";
      urlEl.hidden = false;
      if (missing) missing.hidden = true;
      if (codeWrap && codeEl) {
        if (pan.code) {
          codeEl.textContent = pan.code;
          codeWrap.hidden = false;
        } else {
          codeWrap.hidden = true;
        }
      }
    } else {
      urlEl.hidden = true;
      if (codeWrap) codeWrap.hidden = true;
      if (missing) missing.hidden = false;
    }
  }

  function showClaimed(key) {
    var btn = $("deliver-claim-btn");
    var keyBox = $("deliver-key-box");
    var keyEl = $("deliver-key");
    var err = $("deliver-claim-err");
    if (err) {
      err.hidden = true;
      err.textContent = "";
    }
    if (btn) btn.hidden = true;
    if (keyBox) keyBox.hidden = false;
    if (keyEl) keyEl.textContent = key;
    try {
      localStorage.setItem(LS_KEY, key);
    } catch (_) {}
  }

  function showUnclaimed() {
    var btn = $("deliver-claim-btn");
    var keyBox = $("deliver-key-box");
    if (btn) {
      btn.hidden = false;
      btn.disabled = false;
      btn.textContent = "领取激活码";
    }
    if (keyBox) keyBox.hidden = true;
  }

  function setError(msg) {
    var err = $("deliver-claim-err");
    if (!err) return;
    err.textContent = msg || "";
    err.hidden = !msg;
  }

  function loadMeta() {
    return fetch("/api/v1/delivery/meta?token=" + encodeURIComponent(token), {
      credentials: "same-origin",
      cache: "no-store",
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok || !data.ok) throw new Error(data.message || "加载失败");
        return data;
      });
    });
  }

  function claim() {
    var btn = $("deliver-claim-btn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "领取中…";
    }
    setError("");
    return fetch("/api/v1/delivery/claim", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { res: res, data: data };
        });
      })
      .then(function (_ref) {
        var res = _ref.res;
        var data = _ref.data;
        if (!res.ok || !data.ok) {
          throw new Error(data.message || "领取失败");
        }
        showClaimed(data.license_key);
        if (data.pan) renderPan(data.pan);
        showToast(data.reused ? "已显示您之前领取的激活码" : "领取成功，请妥善保存");
      })
      .catch(function (e) {
        setError(e.message || "领取失败");
        showUnclaimed();
      });
  }

  function initPanel() {
    var root = $("deliver-panel");
    if (!root) return;
    root.hidden = false;

    var title = $("deliver-channel-label");
    var localKey = null;
    try {
      localKey = localStorage.getItem(LS_KEY);
    } catch (_) {}

    loadMeta()
      .then(function (data) {
        if (title) title.textContent = data.channel_label || channelId;
        renderPan(data.pan || {});
        if (data.claimed && data.license_key) {
          showClaimed(data.license_key);
        } else if (localKey) {
          // 本地有码但 cookie 丢失：仍展示本地码，点领取会用 cookie 对齐或新领
          showClaimed(localKey);
        } else {
          showUnclaimed();
        }
      })
      .catch(function (e) {
        setError(e.message || "无法加载发货信息");
        showUnclaimed();
      });

    var claimBtn = $("deliver-claim-btn");
    if (claimBtn) {
      claimBtn.addEventListener("click", function () {
        claim();
      });
    }

    var copyKey = $("deliver-copy-key");
    if (copyKey) {
      copyKey.addEventListener("click", function () {
        var key = ($("deliver-key") || {}).textContent || "";
        copyText(key)
          .then(function () {
            showToast("激活码已复制");
          })
          .catch(function () {
            showToast("复制失败，请手动选择");
          });
      });
    }

    var copyPanCode = $("deliver-copy-pan-code");
    if (copyPanCode) {
      copyPanCode.addEventListener("click", function () {
        var code = ($("deliver-pan-code") || {}).textContent || "";
        copyText(code)
          .then(function () {
            showToast("提取码已复制");
          })
          .catch(function () {
            showToast("复制失败");
          });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPanel);
  } else {
    initPanel();
  }
})();
