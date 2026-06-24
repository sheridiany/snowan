// Snowan 剪藏 — service worker (classic). Orchestrates context menus, popup messages, and
// on-demand injection of the right extractor for the active tab, then POSTs to local Snowan.

importScripts(
  "lib/api.js",
  "lib/extract.js",
  "content/aichat/chatgpt.js",
  "content/aichat/claude.js",
  "content/aichat/gemini.js",
  "content/aichat/doubao.js",
  "content/aichat/generic.js",
  "content/detect.js"
);

// Resolve the AI-chat site for a URL via the shared detector. Returns { label, scrape } where
// `scrape` is the self-contained scraper function to inject, or null for non-chat URLs.
function detectAiSite(url) {
  const site = self.SnowanDetect.siteForUrl(url);
  if (!site) return null;
  const scrape = self[site.scraper] || self.snowanScrapeGeneric;
  return scrape ? { label: site.label, scrape } : null;
}

function isInjectableUrl(url) {
  return /^https?:\/\//i.test(url || "");
}

// ---- Injection helpers ----
async function runInTab(tabId, func, args) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    func,
    args: args || [],
  });
  return res && res.result;
}

// Resolve {kind, payload} from a tab. mode: 'auto' | 'page' | 'selection'.
async function buildCapture(tab, mode) {
  if (!tab || !isInjectableUrl(tab.url)) {
    throw new SnowanError("当前页面不支持剪藏(仅支持 http/https 页面)。");
  }
  const settings = await self.SnowanApi.getSettings();

  if (mode === "selection") {
    const r = await runInTab(tab.id, self.SnowanExtract.selection);
    if (!r || !r.ok) throw new SnowanError("没有检测到选中的文字。");
    return {
      kind: "selection",
      payload: {
        kind: "selection",
        url: r.url,
        title: r.title || "选中内容",
        content: r.markdown,
        captured_at: new Date().toISOString(),
      },
    };
  }

  const aiSite = mode === "page" ? null : detectAiSite(tab.url);
  if (aiSite) {
    const r = await runInTab(tab.id, aiSite.scrape, [aiSite.label]);
    if (r && r.ok && r.turns && r.turns.length) {
      return {
        kind: "ai_chat",
        site: aiSite.label,
        payload: {
          kind: "ai_chat",
          url: r.url,
          title: r.title || aiSite.label + " 对话",
          content: r.markdown,
          captured_at: new Date().toISOString(),
        },
      };
    }
    // Degrade to article extraction if the AI page couldn't be parsed.
  }

  const r = await runInTab(tab.id, self.SnowanExtract.article, [settings.captureHtml]);
  if (!r || !r.ok) throw new SnowanError("无法从该页面抽取正文。");
  const payload = {
    kind: "web",
    url: r.url,
    title: r.title || tab.title || "未命名抓取",
    content: r.markdown,
    captured_at: new Date().toISOString(),
  };
  if (settings.captureHtml && r.html) payload.html = r.html;
  return { kind: "web", payload };
}

// ---- Feedback (badge + notification) ----
function flashBadge(text, color) {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 4000);
}

function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "../icons/icon-128.png",
    title,
    message,
  });
}

const KIND_LABEL = { web: "网页", ai_chat: "AI 对话", selection: "划词" };

// Shared capture pipeline used by both menu clicks and popup requests.
async function doCapture(tab, mode) {
  const built = await buildCapture(tab, mode);
  const result = await self.SnowanApi.capture(built.payload);
  return { built, result };
}

function handleCaptureSuccess({ built, result }, { notifyUser }) {
  const cat = result.category || "未分类";
  flashBadge("✓", "#16a34a");
  if (notifyUser) {
    const kindLabel = KIND_LABEL[result.kind] || KIND_LABEL[built.kind] || "内容";
    const tags = (result.tags || []).slice(0, 4).join(" · ");
    notify(
      `已剪藏 · ${cat}`,
      `${kindLabel}「${result.title || "未命名"}」已存入 Snowan${tags ? "\n标签:" + tags : ""}`
    );
  }
}

function handleCaptureError(err, { notifyUser }) {
  flashBadge("!", "#dc2626");
  if (notifyUser) {
    const offline = err && err.offline;
    notify(
      offline ? "Snowan 未运行" : "剪藏失败",
      offline ? "无法连接 Snowan 桌面端,请先启动 Snowan 后重试。" : (err && err.message) || "未知错误"
    );
  }
}

// ---- Context menus ----
const MENU = { page: "snowan-page", selection: "snowan-selection" };

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU.page,
      title: "用 Snowan 剪藏本页",
      contexts: ["page"],
    });
    chrome.contextMenus.create({
      id: MENU.selection,
      title: "用 Snowan 剪藏选中内容",
      contexts: ["selection"],
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const mode = info.menuItemId === MENU.selection ? "selection" : "auto";
  try {
    const r = await doCapture(tab, mode);
    handleCaptureSuccess(r, { notifyUser: true });
  } catch (err) {
    handleCaptureError(err, { notifyUser: true });
  }
});

// ---- Auto-capture settings + status (shared keys with options.js / autocapture.js) ----
const AUTO_DEFAULTS = {
  autoCapture: true,
  dwellSeconds: 8,
  minChars: 600,
  denylist: ["mail.google.com", "accounts.google.com", "login.microsoftonline.com", "localhost", "127.0.0.1"],
};

async function getAutoSettings() {
  const s = await chrome.storage.sync.get({
    autoCapture: AUTO_DEFAULTS.autoCapture,
    dwellSeconds: AUTO_DEFAULTS.dwellSeconds,
    minChars: AUTO_DEFAULTS.minChars,
    denylist: AUTO_DEFAULTS.denylist,
  });
  const denylist = Array.isArray(s.denylist)
    ? s.denylist
    : String(s.denylist || "")
        .split(/[\n,]+/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean);
  return { autoCapture: Boolean(s.autoCapture), denylist };
}

// Lightweight popup status: is auto-capture on, and would this host pass the denylist gate?
// (Dwell/length gates are evaluated in the page; popup just shows the high-level state.)
async function autoStatusFor(url) {
  const s = await getAutoSettings();
  if (!s.autoCapture) return { enabled: false, eligible: false, reason: "disabled" };
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch (_) {}
  const denied = s.denylist.some((d) => {
    if (!d) return false;
    if (d.includes("*")) {
      const re = new RegExp("^" + d.replace(/[.]/g, "\\.").replace(/\*/g, ".*") + "$", "i");
      return re.test(host);
    }
    return host === d || host.endsWith("." + d);
  });
  if (denied) return { enabled: true, eligible: false, reason: "denylist" };
  return { enabled: true, eligible: true };
}

// ---- Auto-capture (from content script) ----
// The content script already gates + dedups, but messages can arrive twice (e.g. dwell flush +
// visibilitychange). Keep a tiny in-memory guard keyed by url+kind+length so we don't double-POST
// the exact same snapshot within a short window. Auto-capture failures are silent (badge only).
const autoCaptureSeen = new Map(); // key -> { len, at }

function autoKey(p) {
  return (p.kind || "web") + " " + (p.url || "");
}

async function handleAutoCapture(payload) {
  if (!payload || !payload.content) return;
  const key = autoKey(payload);
  const len = payload.content.length;
  const prev = autoCaptureSeen.get(key);
  // Skip if we just sent an equal-or-larger snapshot for this url+kind.
  if (prev && len <= prev.len && Date.now() - prev.at < 5 * 60 * 1000) return;
  autoCaptureSeen.set(key, { len, at: Date.now() });
  try {
    await self.SnowanApi.capture(payload);
    flashBadge("✓", "#16a34a"); // quiet success: badge only, no notification
  } catch (_) {
    // Silent: don't interrupt browsing. Roll back the guard so a later retry can go through.
    autoCaptureSeen.delete(key);
    flashBadge("·", "#9aa0a6");
  }
}

// ---- Popup messaging ----
// Protocol (popup -> background):
//   { type: "detect", tabId }            -> { kind, site? } describing what the active tab is
//   { type: "capture", tabId, mode }     -> { ok:true, ...backendResult } | { ok:false, error, offline }
//   { type: "ping" }                     -> { ok, offline? }
//   { type: "autocapture", payload }     -> fire-and-forget; POSTs payload, badge-only feedback
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "ping") {
        sendResponse(await self.SnowanApi.ping());
        return;
      }

      if (msg.type === "autocapture") {
        // Fire-and-forget from the content script; reply immediately so it isn't blocked.
        handleAutoCapture(msg.payload);
        sendResponse({ ok: true });
        return;
      }
      const tab = msg.tabId
        ? await chrome.tabs.get(msg.tabId)
        : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

      if (msg.type === "detect") {
        const injectable = Boolean(tab && isInjectableUrl(tab.url));
        const site = injectable ? detectAiSite(tab.url) : null;
        const auto = injectable ? await autoStatusFor(tab.url) : { enabled: false, eligible: false };
        sendResponse({
          ok: true,
          injectable,
          kind: site ? "ai_chat" : "web",
          site: site ? site.label : null,
          title: tab ? tab.title : "",
          url: tab ? tab.url : "",
          autoEnabled: auto.enabled,
          autoEligible: auto.eligible,
          autoReason: auto.reason || null,
        });
        return;
      }

      if (msg.type === "capture") {
        const r = await doCapture(tab, msg.mode || "auto");
        // Popup shows its own inline result, so don't double-notify here.
        flashBadge("✓", "#16a34a");
        sendResponse({
          ok: true,
          id: r.result.id,
          title: r.result.title,
          category: r.result.category,
          tags: r.result.tags || [],
          kind: r.result.kind || r.built.kind,
          site: r.built.site || null,
        });
        return;
      }

      sendResponse({ ok: false, error: "未知请求类型" });
    } catch (err) {
      flashBadge("!", "#dc2626");
      sendResponse({
        ok: false,
        error: (err && err.message) || "未知错误",
        offline: Boolean(err && err.offline),
      });
    }
  })();
  return true; // keep the message channel open for the async response
});
