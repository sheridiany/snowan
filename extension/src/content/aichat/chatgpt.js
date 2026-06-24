// ChatGPT transcript scraper. Self-contained for chrome.scripting.executeScript injection:
// no imports, no outer-scope references. Returns the agreed shape:
//   { ok, title, url, turns: [{role:'user'|'assistant', text}], markdown }
// Covers chatgpt.com and chat.openai.com.
function snowanScrapeChatGPT() {
  function clean(s) {
    return (s || "")
      .replace(/ /g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function readText(root) {
    if (!root) return "";
    // Prefer the rendered-markdown body; fall back to plain prose containers, then the node.
    const body =
      root.querySelector(".markdown") ||
      root.querySelector(".prose") ||
      root.querySelector(".whitespace-pre-wrap") ||
      root;
    return clean(body.innerText || body.textContent || "");
  }

  function buildResult(turns) {
    const title = clean(document.title || "ChatGPT 对话").replace(
      /\s*[-|]\s*ChatGPT$/i,
      ""
    ) || "ChatGPT 对话";
    const markdown = turns
      .map(
        (t) =>
          (t.role === "user" ? "## 🧑 用户\n\n" : "## 🤖 ChatGPT\n\n") + t.text
      )
      .join("\n\n");
    return { ok: turns.length > 0, title, url: location.href, turns, markdown };
  }

  try {
    // Primary strategy: ChatGPT tags every message with data-message-author-role
    // on the message wrapper. This attribute has been stable across redesigns and
    // is the most reliable signal of role + boundaries.
    let nodes = Array.from(
      document.querySelectorAll("[data-message-author-role]")
    );

    let turns = [];
    for (const n of nodes) {
      const role = n.getAttribute("data-message-author-role");
      if (role !== "user" && role !== "assistant") continue;
      const text = readText(n);
      if (text) turns.push({ role, text });
    }

    if (turns.length) return buildResult(turns);

    // Fallback strategy: newer layouts wrap each turn in
    // <article data-testid="conversation-turn-N">. Derive role from a nested
    // [data-message-author-role], an h5/h6 sr-only label ("You said:" /
    // "ChatGPT said:"), or position parity as a last resort.
    const articles = Array.from(
      document.querySelectorAll(
        "article[data-testid^='conversation-turn'], [data-testid^='conversation-turn']"
      )
    );

    turns = [];
    let idx = 0;
    for (const art of articles) {
      let role = null;
      const roleEl = art.querySelector("[data-message-author-role]");
      if (roleEl) {
        const r = roleEl.getAttribute("data-message-author-role");
        if (r === "user" || r === "assistant") role = r;
      }
      if (!role) {
        const label = (
          art.querySelector("h5, h6, .sr-only")?.textContent || ""
        ).toLowerCase();
        if (/you said|你说/.test(label)) role = "user";
        else if (/chatgpt said|chatgpt 说/.test(label)) role = "assistant";
      }
      if (!role) role = idx % 2 === 0 ? "user" : "assistant";

      const text = readText(art);
      if (text) {
        turns.push({ role, text });
        idx += 1;
      }
    }

    return buildResult(turns);
  } catch (e) {
    // Never throw from an injected scraper — degrade so background falls back to web extract.
    return {
      ok: false,
      title: clean(document.title || "ChatGPT 对话") || "ChatGPT 对话",
      url: location.href,
      turns: [],
      markdown: "",
    };
  }
}

if (typeof self !== "undefined") self.snowanScrapeChatGPT = snowanScrapeChatGPT;
