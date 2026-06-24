// Self-contained page extractors. Each function is injected into the target page via
// chrome.scripting.executeScript({ func }). They MUST NOT reference any outer-scope symbol,
// import, or other helper — executeScript serializes only the function body. Anything shared
// is defined as a nested local inside each function.
//
// In the service worker these are loaded via importScripts and read off self.SnowanExtract;
// background.js passes the actual function object to executeScript.

// ---- Web article extraction (lightweight Readability-style) ----
// Returns { ok, title, url, text, markdown, html? }.
function snowanExtractArticle(captureHtml) {
  function isHidden(el) {
    if (!el || el.nodeType !== 1) return false;
    const s = window.getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") return true;
    if (parseFloat(s.opacity) === 0) return true;
    if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return true;
    return false;
  }

  // Per-site rule hooks. If a host matches, `root(doc)` returns the content container to use
  // (skipping generic scoring); `title()` overrides the title. Either may return null to fall
  // back. Extend this list to harden specific sites without touching the generic path.
  const SITE_RULES = [
    {
      match: /(^|\.)zhihu\.com$/i, // 知乎 article / answer
      root: (d) =>
        d.querySelector(".Post-RichText, .RichContent-inner, .AnswerCard .RichText"),
      title: () =>
        (document.querySelector(".Post-Title, .QuestionHeader-title") || {}).innerText,
    },
    {
      match: /(^|\.)mp\.weixin\.qq\.com$/i, // 微信公众号
      root: (d) => d.querySelector("#js_content, .rich_media_content"),
      title: () => (document.querySelector("#activity-name, .rich_media_title") || {}).innerText,
    },
    {
      match: /(^|\.)juejin\.cn$/i, // 掘金
      root: (d) => d.querySelector(".article-content, .markdown-body"),
      title: () => (document.querySelector(".article-title, h1.article-title") || {}).innerText,
    },
    {
      match: /(^|\.)medium\.com$/i, // Medium
      root: (d) => d.querySelector("article section, article"),
      title: () => (document.querySelector("article h1, h1") || {}).innerText,
    },
    {
      match: /(^|\.)github\.com$/i, // GitHub README / markdown / issue
      root: (d) =>
        d.querySelector(
          "article.markdown-body, .markdown-body, #readme .markdown-body, .repository-content"
        ),
    },
    {
      match: /(^|\.)x\.com$|(^|\.)twitter\.com$/i, // X / Twitter thread
      root: (d) => d.querySelector("article[data-testid='tweet']") || d.querySelector("main"),
    },
    {
      match: /(^|\.)bilibili\.com$/i, // B站 视频简介 / 专栏
      root: (d) =>
        d.querySelector(".article-content, .read-article-holder, #v_desc, .basic-desc-info"),
      title: () =>
        (document.querySelector("h1.video-title, h1.title, .article-title") || {}).innerText,
    },
  ];

  function siteRule() {
    const host = location.hostname;
    return SITE_RULES.find((r) => r.match.test(host)) || null;
  }

  // Clone so we can mutate freely without touching the live page.
  const doc = document.cloneNode(true);

  const STRIP = [
    "script", "style", "noscript", "template", "iframe", "svg", "canvas",
    "nav", "aside", "footer", "header", "form", "button", "input", "select",
    "figure figcaption", "[role=navigation]", "[role=banner]", "[role=complementary]",
    "[role=search]", "[role=dialog]", "[role=tablist]", "[role=toolbar]",
    "[aria-hidden=true]", "[hidden]",
    ".ad", ".ads", ".advert", ".advertisement", ".ad-container", "[id*=google_ads]",
    ".sidebar", ".side-bar", ".comment", ".comments", ".comment-list",
    ".social", ".share", ".sharing", ".share-buttons", ".newsletter", ".subscribe",
    ".cookie", ".cookie-banner", ".gdpr", ".popup", ".modal", ".overlay", ".promo",
    ".related", ".related-posts", ".recommend", ".recommendation", ".breadcrumb",
    ".nav", ".navbar", ".menu", ".toc", ".pagination", ".pager", ".author-bio",
    ".paywall", ".banner", ".toolbar", ".skip-link",
  ];
  STRIP.forEach((sel) => {
    try {
      doc.querySelectorAll(sel).forEach((n) => n.remove());
    } catch (_) {}
  });

  // Prefer an explicit per-site container when a rule matches.
  let best = null;
  const rule = siteRule();
  if (rule && rule.root) {
    try {
      const r = rule.root(doc);
      if (r && (r.textContent || "").trim().length > 80) best = r;
    } catch (_) {}
  }

  if (!best) {
    // Score candidate containers; prefer semantic article/main, else the densest block.
    const candidates = Array.from(
      doc.querySelectorAll(
        "article, main, [role=main], [itemprop=articleBody], .post, .article, .post-content, " +
          ".article-content, .content, #content, .entry-content, .markdown-body, section, div"
      )
    );

    let bestScore = 0;
    for (const el of candidates) {
      if (isHidden(el)) continue;
      const len = (el.textContent || "").trim().length;
      if (len < 200) continue;
      const paragraphs = el.querySelectorAll("p").length;
      const headings = el.querySelectorAll("h1,h2,h3,h4").length;
      let score = len + paragraphs * 80 + headings * 30;
      const tag = el.tagName.toLowerCase();
      if (tag === "article" || tag === "main") score *= 1.6;
      const cls = (el.className || "") + " " + (el.id || "");
      if (/article|content|post|entry|markdown|body|main|read|story/i.test(cls)) score *= 1.25;
      if (/comment|sidebar|footer|nav|menu|aside|widget|promo|related|recommend/i.test(cls))
        score *= 0.25;
      // Penalize containers that are mostly links (menus, related lists).
      const linkLen = Array.from(el.querySelectorAll("a")).reduce(
        (a, n) => a + (n.textContent || "").length,
        0
      );
      if (len > 0 && linkLen / len > 0.5) score *= 0.35;
      // Penalize deeply nested wrappers in favor of the tightest container holding the text.
      const childDivs = el.children ? el.children.length : 0;
      if (childDivs === 1 && tag === "div") score *= 0.9;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
  }

  const root = best || doc.body;
  if (!root) {
    return { ok: false, reason: "empty", title: document.title, url: location.href };
  }

  // Convert a small subset of HTML to Markdown — headings, lists, blockquotes, code, links.
  function toMarkdown(node) {
    const out = [];
    function walkInline(n) {
      let s = "";
      n.childNodes.forEach((c) => {
        if (c.nodeType === 3) {
          s += c.textContent;
        } else if (c.nodeType === 1) {
          const t = c.tagName.toLowerCase();
          if (t === "br") s += "\n";
          else if (t === "strong" || t === "b") s += "**" + walkInline(c) + "**";
          else if (t === "em" || t === "i") s += "*" + walkInline(c) + "*";
          else if (t === "code") s += "`" + (c.textContent || "") + "`";
          else if (t === "a") {
            const href = c.getAttribute("href") || "";
            const txt = walkInline(c).trim();
            s += href && txt ? `[${txt}](${href})` : txt;
          } else s += walkInline(c);
        }
      });
      return s;
    }
    function walk(n) {
      n.childNodes.forEach((c) => {
        if (c.nodeType === 3) {
          const t = c.textContent.replace(/\s+/g, " ");
          if (t.trim()) out.push(t.trim());
          return;
        }
        if (c.nodeType !== 1) return;
        if (isHidden(c)) return;
        const tag = c.tagName.toLowerCase();
        if (/^h[1-6]$/.test(tag)) {
          out.push("\n" + "#".repeat(+tag[1]) + " " + walkInline(c).trim() + "\n");
        } else if (tag === "p") {
          const t = walkInline(c).trim();
          if (t) out.push("\n" + t + "\n");
        } else if (tag === "blockquote") {
          const t = (c.innerText || "").trim();
          if (t) out.push("\n" + t.split("\n").map((l) => "> " + l).join("\n") + "\n");
        } else if (tag === "pre") {
          const t = (c.innerText || "").replace(/\s+$/, "");
          if (t) out.push("\n```\n" + t + "\n```\n");
        } else if (tag === "li") {
          out.push("- " + walkInline(c).trim());
        } else if (tag === "ul" || tag === "ol") {
          walk(c);
          out.push("");
        } else if (tag === "img") {
          /* skip images */
        } else {
          walk(c);
        }
      });
    }
    walk(node);
    return out
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // Title: per-site rule, then <h1> in content, then og:title, then document.title.
  let title = "";
  if (rule && rule.title) {
    try {
      title = (rule.title() || "").trim();
    } catch (_) {}
  }
  if (!title) {
    title =
      (root.querySelector("h1") && root.querySelector("h1").innerText) ||
      (document.querySelector("meta[property='og:title']") || {}).content ||
      document.title ||
      "";
  }
  title = (title || "").trim();

  const markdown = toMarkdown(root);
  const text = (root.innerText || root.textContent || "").trim();

  const result = {
    ok: Boolean((markdown || text).trim()),
    reason: (markdown || text).trim() ? "" : "empty",
    title,
    url: location.href,
    text,
    markdown: markdown || text,
  };
  if (captureHtml) result.html = root.innerHTML;
  return result;
}

// ---- Selection extraction ----
// Returns { ok, title, url, text, markdown }. Uses the current window selection.
function snowanExtractSelection() {
  const sel = window.getSelection();
  const text = sel ? sel.toString().trim() : "";
  return {
    ok: Boolean(text),
    reason: text ? "" : "no_selection",
    title: (document.title || "").trim(),
    url: location.href,
    text,
    markdown: text,
  };
}

// Cheap content-size probe for autocapture's gating, so we don't run the full extractor on
// every dwell tick. Approximates the main article text length without cloning the document.
function snowanProbeContentChars() {
  function len(el) {
    return el ? (el.innerText || el.textContent || "").trim().length : 0;
  }
  const main =
    document.querySelector(
      "article, main, [role=main], [itemprop=articleBody], .post-content, .article-content, " +
        ".entry-content, .markdown-body"
    ) || document.body;
  if (!main) return 0;
  // Subtract obvious nav/link-heavy chrome so a link-farm homepage doesn't pass the gate.
  let total = len(main);
  let linkLen = 0;
  main.querySelectorAll("a").forEach((a) => {
    linkLen += (a.textContent || "").length;
  });
  if (total > 0 && linkLen / total > 0.6) total = Math.round(total * 0.3);
  return total;
}

if (typeof self !== "undefined") {
  self.SnowanExtract = {
    article: snowanExtractArticle,
    selection: snowanExtractSelection,
    probeChars: snowanProbeContentChars,
  };
}
