// Generic AI-chat detection, shared by background.js (via importScripts) and content scripts
// (via being listed in the same content_scripts.js array — both expose it on `self`, which is
// `window` in a content script and the global in the worker).
//
// Two layers:
//   1. Known-host map: hostname regex -> { label, scrape } where scrape is one of the
//      site-specific scrapers (snowanScrape*). Looked up first; most reliable.
//   2. Heuristic: for unknown hosts, sniff the DOM for paired user/assistant message blocks
//      plus a chat-style composer. Returns a generic label so we still capture the transcript
//      with snowanScrapeGeneric.
//
// Exposes: self.SnowanDetect = { siteForUrl, detect, scrapeFor }
// `detect` requires a live DOM, so it only does anything useful inside a content script / page.

(function () {
  // Resolve a scraper by name at call time so this file doesn't depend on script load order.
  function scraperByName(name) {
    return (typeof self !== "undefined" && self[name]) || null;
  }

  // host regex -> site label + name of the scraper function to use.
  const KNOWN_SITES = [
    { match: /(^|\.)chatgpt\.com$/i, label: "ChatGPT", scraper: "snowanScrapeChatGPT" },
    { match: /(^|\.)chat\.openai\.com$/i, label: "ChatGPT", scraper: "snowanScrapeChatGPT" },
    { match: /(^|\.)claude\.ai$/i, label: "Claude", scraper: "snowanScrapeClaude" },
    { match: /(^|\.)gemini\.google\.com$/i, label: "Gemini", scraper: "snowanScrapeGemini" },
    { match: /(^|\.)doubao\.com$/i, label: "豆包", scraper: "snowanScrapeDoubao" },
    { match: /(^|\.)grok\.com$/i, label: "Grok", scraper: "snowanScrapeGeneric" },
    { match: /(^|\.)x\.com$/i, label: "Grok", scraper: "snowanScrapeGeneric", path: /\/i\/grok/i },
    { match: /(^|\.)chat\.deepseek\.com$/i, label: "DeepSeek", scraper: "snowanScrapeGeneric" },
    { match: /(^|\.)kimi\.moonshot\.cn$/i, label: "Kimi", scraper: "snowanScrapeGeneric" },
    { match: /(^|\.)kimi\.com$/i, label: "Kimi", scraper: "snowanScrapeGeneric" },
    { match: /(^|\.)yuanbao\.tencent\.com$/i, label: "元宝", scraper: "snowanScrapeGeneric" },
    { match: /(^|\.)tongyi\.aliyun\.com$/i, label: "通义千问", scraper: "snowanScrapeGeneric" },
    { match: /(^|\.)tongyi\.com$/i, label: "通义千问", scraper: "snowanScrapeGeneric" },
    { match: /(^|\.)chatglm\.cn$/i, label: "智谱清言", scraper: "snowanScrapeGeneric" },
    { match: /(^|\.)copilot\.microsoft\.com$/i, label: "Copilot", scraper: "snowanScrapeGeneric" },
    { match: /(^|\.)perplexity\.ai$/i, label: "Perplexity", scraper: "snowanScrapeGeneric" },
    { match: /(^|\.)poe\.com$/i, label: "Poe", scraper: "snowanScrapeGeneric" },
  ];

  function hostOf(url) {
    try {
      return new URL(url).hostname;
    } catch (_) {
      return "";
    }
  }

  // Returns { label, scraper } for a known AI-chat URL, else null. `scraper` is the function name.
  function siteForUrl(url) {
    const host = hostOf(url);
    if (!host) return null;
    let path = "";
    try {
      path = new URL(url).pathname;
    } catch (_) {}
    for (const s of KNOWN_SITES) {
      if (!s.match.test(host)) continue;
      if (s.path && !s.path.test(path)) continue;
      return { label: s.label, scraper: s.scraper };
    }
    return null;
  }

  // Resolve the actual scraper function for a URL (known site or, if heuristics say it's a
  // chat, the generic scraper). Used by background's executeScript path.
  function scrapeFor(url) {
    const site = siteForUrl(url);
    if (site) {
      const fn = scraperByName(site.scraper) || scraperByName("snowanScrapeGeneric");
      return fn ? { label: site.label, scrape: fn } : null;
    }
    return null;
  }

  // DOM heuristic: is this page an AI chat? Only meaningful with a live document.
  // Looks for (a) explicit role markers, or (b) a chat composer + alternating bubbles.
  function detectChatDom() {
    if (typeof document === "undefined") return { isChat: false };

    // (a) Explicit role attributes are a strong signal across many chat UIs.
    const roleNodes = document.querySelectorAll(
      "[data-message-author-role], [data-message-role], [data-role='user'], [data-role='assistant']"
    );
    if (roleNodes.length >= 2) return { isChat: true, reason: "role-attrs" };

    // (b) Composer present? Chat apps have a large multiline input or contenteditable.
    const composer = document.querySelector(
      "textarea, [contenteditable='true'], [role='textbox']"
    );
    if (!composer) return { isChat: false };

    // ...and repeated message-like containers (class/testid containing message/chat/turn/bubble).
    const msgish = document.querySelectorAll(
      "[class*='message' i], [class*='chat' i], [class*='turn' i], [class*='bubble' i], " +
        "[data-testid*='message' i], [data-testid*='turn' i]"
    );
    if (msgish.length >= 4) return { isChat: true, reason: "composer+bubbles" };

    return { isChat: false };
  }

  // Full detection for the current page. Returns:
  //   { isChat, label }  — label is the site name (known) or a generic name.
  function detect(url) {
    const u = url || (typeof location !== "undefined" ? location.href : "");
    const site = siteForUrl(u);
    if (site) return { isChat: true, label: site.label, known: true };
    const dom = detectChatDom();
    if (dom.isChat) {
      const host = hostOf(u).replace(/^www\./, "");
      return { isChat: true, label: host || "AI 对话", known: false };
    }
    return { isChat: false, label: null };
  }

  self.SnowanDetect = { siteForUrl, scrapeFor, detect, detectChatDom };
})();
