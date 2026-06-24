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
  function textLen(el) {
    return (el.innerText || el.textContent || "").trim().length;
  }

  function isHidden(el) {
    const s = window.getComputedStyle(el);
    return s.display === "none" || s.visibility === "hidden" || s.opacity === "0";
  }

  // Clone so we can mutate freely without touching the live page.
  const doc = document.cloneNode(true);

  const STRIP = [
    "script", "style", "noscript", "template", "iframe", "svg", "canvas",
    "nav", "aside", "footer", "header", "form", "button", "input", "select",
    "[role=navigation]", "[role=banner]", "[role=complementary]",
    "[aria-hidden=true]", ".ad", ".ads", ".advert", ".advertisement",
    ".sidebar", ".comment", ".comments", ".social", ".share", ".newsletter",
    ".cookie", ".popup", ".modal", ".promo", ".related", ".nav", ".menu",
  ];
  STRIP.forEach((sel) => {
    doc.querySelectorAll(sel).forEach((n) => n.remove());
  });

  // Score candidate containers; prefer semantic article/main, else the densest block.
  const candidates = Array.from(
    doc.querySelectorAll("article, main, [role=main], .post, .article, .content, #content, .entry-content, .markdown-body, section, div")
  );

  let best = null;
  let bestScore = 0;
  for (const el of candidates) {
    const len = (el.textContent || "").trim().length;
    if (len < 200) continue;
    const paragraphs = el.querySelectorAll("p").length;
    let score = len + paragraphs * 80;
    const tag = el.tagName.toLowerCase();
    if (tag === "article" || tag === "main") score *= 1.5;
    const cls = (el.className || "") + " " + (el.id || "");
    if (/article|content|post|entry|markdown|body|main/i.test(cls)) score *= 1.2;
    if (/comment|sidebar|footer|nav|menu|aside/i.test(cls)) score *= 0.3;
    // Penalize containers that are mostly links (menus, related lists).
    const linkLen = Array.from(el.querySelectorAll("a")).reduce(
      (a, n) => a + (n.textContent || "").length,
      0
    );
    if (len > 0 && linkLen / len > 0.5) score *= 0.4;
    if (score > bestScore) {
      bestScore = score;
      best = el;
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

  // Title: prefer <h1> in content, then og:title, then document.title.
  let title =
    (document.querySelector("meta[property='og:title']") || {}).content ||
    (root.querySelector("h1") && root.querySelector("h1").innerText) ||
    document.title ||
    "";
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

if (typeof self !== "undefined") {
  self.SnowanExtract = {
    article: snowanExtractArticle,
    selection: snowanExtractSelection,
  };
}
