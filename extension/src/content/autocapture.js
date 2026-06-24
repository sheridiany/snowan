// Smart auto-capture content script. Always injected (document_idle on all http/https pages).
// It does NOT capture everything — only when ALL gates pass:
//   autoCapture enabled · dwell long enough (visible + focused) · enough real body text ·
//   host not on denylist · this URL not already captured this session.
// AI-chat pages are detected and captured automatically, then re-captured (same URL) as the
// conversation grows.
//
// It runs in the page world but never hits the network: extraction/scraping happen here (the
// scraper/extractor/detect modules are listed alongside this file in the same content_scripts
// entry, so they share `window`), and the resulting payload is handed to background via
// chrome.runtime.sendMessage({ type: "autocapture", ... }) for the POST + dedup + badge.

(function () {
  "use strict";

  const STORAGE_KEYS = {
    autoCapture: "autoCapture",
    dwellSeconds: "dwellSeconds",
    minChars: "minChars",
    denylist: "denylist",
  };

  const DEFAULTS = {
    autoCapture: true,
    dwellSeconds: 8,
    minChars: 600,
    denylist: [
      "mail.google.com",
      "accounts.google.com",
      "login.microsoftonline.com",
      "localhost",
      "127.0.0.1",
    ],
  };

  // host suffixes that always count as sensitive even if the user didn't list them.
  const ALWAYS_DENY = [/\.bank$/i, /(^|\.)bankofamerica\.com$/i];

  let settings = { ...DEFAULTS };

  // ---- settings ----
  function parseDenylist(raw) {
    if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
    return String(raw || "")
      .split(/[\n,]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  async function loadSettings() {
    const s = await chrome.storage.sync.get({
      [STORAGE_KEYS.autoCapture]: DEFAULTS.autoCapture,
      [STORAGE_KEYS.dwellSeconds]: DEFAULTS.dwellSeconds,
      [STORAGE_KEYS.minChars]: DEFAULTS.minChars,
      [STORAGE_KEYS.denylist]: DEFAULTS.denylist,
    });
    settings = {
      autoCapture: Boolean(s[STORAGE_KEYS.autoCapture]),
      dwellSeconds: Math.max(1, Number(s[STORAGE_KEYS.dwellSeconds]) || DEFAULTS.dwellSeconds),
      minChars: Math.max(0, Number(s[STORAGE_KEYS.minChars]) || DEFAULTS.minChars),
      denylist: parseDenylist(s[STORAGE_KEYS.denylist]),
    };
  }

  function hostDenied() {
    const host = location.hostname.toLowerCase();
    if (ALWAYS_DENY.some((re) => re.test(host))) return true;
    return settings.denylist.some((d) => {
      if (!d) return false;
      if (d.includes("*")) {
        const re = new RegExp("^" + d.replace(/[.]/g, "\\.").replace(/\*/g, ".*") + "$", "i");
        return re.test(host);
      }
      return host === d || host.endsWith("." + d);
    });
  }

  // ---- session dedup (chrome.storage.session) ----
  // We track URLs captured this session and, for chat pages, the last captured transcript size
  // so we only re-upload on meaningful growth.
  function sessionKey() {
    // Drop the hash; keep query (chat ids often live there).
    return location.origin + location.pathname + location.search;
  }

  async function getMark() {
    const key = "ac:" + sessionKey();
    const got = await chrome.storage.session.get(key);
    return got[key] || null; // { len } or null
  }
  async function setMark(len) {
    const key = "ac:" + sessionKey();
    await chrome.storage.session.set({ [key]: { len, at: Date.now() } });
  }

  // ---- login-page heuristic: skip auth screens regardless of length ----
  function looksLikeLogin() {
    if (document.querySelector("input[type=password]")) return true;
    const t = (document.title || "").toLowerCase();
    if (/登录|登入|sign in|log in|login|authenticate/.test(t)) {
      // Only treat as login if there's also a small form-y body (avoid false-positives on
      // articles that merely mention "login").
      const bodyLen = (document.body && document.body.innerText.length) || 0;
      if (bodyLen < 1500) return true;
    }
    return false;
  }

  // ---- capture dispatch ----
  let inFlight = false;

  function chatDetection() {
    try {
      return window.SnowanDetect ? window.SnowanDetect.detect(location.href) : { isChat: false };
    } catch (_) {
      return { isChat: false };
    }
  }

  function scrapeChat(label, known) {
    // Known site -> its dedicated scraper; otherwise the generic one.
    let fn = null;
    if (known && window.SnowanDetect) {
      const site = window.SnowanDetect.siteForUrl(location.href);
      if (site) fn = window[site.scraper] || window.snowanScrapeGeneric;
    }
    if (!fn) fn = window.snowanScrapeGeneric;
    if (!fn) return null;
    try {
      return fn(label);
    } catch (_) {
      return null;
    }
  }

  async function send(payload) {
    try {
      return await chrome.runtime.sendMessage({ type: "autocapture", payload });
    } catch (_) {
      // Service worker asleep or context invalidated — ignore; auto-capture is best-effort.
      return null;
    }
  }

  // Try a web (article) capture. Returns true if it actually sent something.
  async function tryCaptureWeb() {
    if (!window.SnowanExtract) return false;
    let chars = 0;
    try {
      chars = window.SnowanExtract.probeChars();
    } catch (_) {}
    if (chars < settings.minChars) return false;
    if (looksLikeLogin()) return false;

    let r;
    try {
      r = window.SnowanExtract.article(false);
    } catch (_) {
      return false;
    }
    if (!r || !r.ok || !(r.markdown || "").trim()) return false;
    if ((r.markdown || "").length < settings.minChars) return false;

    await send({
      kind: "web",
      url: r.url || location.href,
      title: r.title || document.title || "未命名抓取",
      content: r.markdown,
      captured_at: new Date().toISOString(),
    });
    await setMark((r.markdown || "").length);
    return true;
  }

  // Try an AI-chat capture. growthOnly=true means only re-send if the transcript grew enough.
  async function tryCaptureChat(label, known, growthOnly) {
    const r = scrapeChat(label, known);
    if (!r || !r.ok || !(r.markdown || "").trim()) return false;
    const len = (r.markdown || "").length;

    const mark = await getMark();
    if (mark) {
      // Re-capture only on >20% (and >=200 char) growth, so minor token streaming doesn't spam.
      const grew = len - mark.len >= 200 && len >= mark.len * 1.2;
      if (growthOnly && !grew) return false;
      if (!growthOnly && len <= mark.len) return false;
    }

    await send({
      kind: "ai_chat",
      site: label,
      url: r.url || location.href,
      title: r.title || label + " 对话",
      content: r.markdown,
      captured_at: new Date().toISOString(),
    });
    await setMark(len);
    return true;
  }

  // ---- dwell timing: count only while visible AND focused ----
  let dwellMs = 0;
  let lastTick = Date.now();
  let timer = null;
  let dwellSatisfied = false;

  function active() {
    return document.visibilityState === "visible" && document.hasFocus();
  }

  async function onDwellReached() {
    if (inFlight) return;
    inFlight = true;
    try {
      const det = chatDetection();
      if (det.isChat) {
        // First chat capture for this URL this session (or fresh if not marked).
        const mark = await getMark();
        await tryCaptureChat(det.label, det.known, Boolean(mark));
      } else {
        const mark = await getMark();
        if (!mark) await tryCaptureWeb();
      }
    } finally {
      inFlight = false;
    }
  }

  function tick() {
    const now = Date.now();
    if (active()) dwellMs += now - lastTick;
    lastTick = now;

    if (!settings.autoCapture || hostDenied()) return;

    if (!dwellSatisfied && dwellMs >= settings.dwellSeconds * 1000) {
      dwellSatisfied = true;
      onDwellReached();
    } else if (dwellSatisfied) {
      // After the first capture, keep polling chat pages for growth.
      const det = chatDetection();
      if (det.isChat && !inFlight) {
        inFlight = true;
        tryCaptureChat(det.label, det.known, true).finally(() => {
          inFlight = false;
        });
      }
    }
  }

  // SPA route changes (chat apps swap conversations without reload): reset dwell + mark scope.
  let lastUrl = location.href;
  function onMaybeNavigated() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    dwellMs = 0;
    dwellSatisfied = false;
    lastTick = Date.now();
  }

  // Flush a final chat snapshot when leaving the page.
  async function flushOnLeave() {
    if (!settings.autoCapture || hostDenied()) return;
    const det = chatDetection();
    if (det.isChat) {
      const mark = await getMark();
      await tryCaptureChat(det.label, det.known, Boolean(mark));
    }
  }

  // ---- wiring ----
  function start() {
    lastTick = Date.now();
    timer = setInterval(() => {
      onMaybeNavigated();
      tick();
    }, 1000);

    document.addEventListener("visibilitychange", () => {
      lastTick = Date.now();
      if (document.visibilityState === "hidden") flushOnLeave();
    });
    window.addEventListener("beforeunload", () => {
      flushOnLeave();
    });
    window.addEventListener("focus", () => {
      lastTick = Date.now();
    });
    window.addEventListener("blur", () => {
      lastTick = Date.now();
    });

    // React to settings changes immediately.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      if (Object.keys(STORAGE_KEYS).some((k) => STORAGE_KEYS[k] in changes)) {
        loadSettings();
      }
    });
  }

  loadSettings().then(start);
})();
