// Generic AI-chat transcript scraper for sites without a dedicated scraper (Grok, DeepSeek,
// Kimi, 元宝, Perplexity, …) and for unknown hosts the heuristic flags as a chat.
// Self-contained for chrome.scripting.executeScript injection: no imports, no outer-scope refs.
// Returns { ok, title, url, turns: [{role,text}], markdown }.
function snowanScrapeGeneric(siteLabel) {
  function clean(s) {
    return (s || "")
      .replace(/ /g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const label = siteLabel || "AI";

  function roleOf(el) {
    // Walk up a few levels looking for any stable role signal.
    let node = el;
    for (let i = 0; node && i < 8; i++, node = node.parentElement) {
      const get = (a) => (node.getAttribute && node.getAttribute(a)) || "";
      const r =
        get("data-message-author-role") ||
        get("data-message-role") ||
        get("data-role") ||
        get("data-author-role");
      if (/^user$/i.test(r) || /human/i.test(r)) return "user";
      if (/^(assistant|bot|model|ai)$/i.test(r)) return "assistant";
      const tid = get("data-testid") + " " + get("data-test-id");
      if (/user|send_?message|human|query/i.test(tid)) return "user";
      if (/assistant|bot|model|receive_?message|response|answer/i.test(tid)) return "assistant";
      const cls =
        node.className && typeof node.className === "string" ? node.className : "";
      if (/(^|[-_ ])(user|human|send|query)([-_ ]|$)/i.test(cls)) return "user";
      if (/(^|[-_ ])(assistant|bot|model|receive|response|answer)([-_ ]|$)/i.test(cls))
        return "assistant";
    }
    return null;
  }

  const turns = [];
  const seen = new Set();
  function push(role, el) {
    const text = clean((el && (el.innerText || el.textContent)) || "");
    if (!text || text.length < 2) return;
    const key = (role || "?") + " " + text.slice(0, 120);
    if (seen.has(key)) return;
    seen.add(key);
    turns.push({ role: role || "assistant", text });
  }

  // Strategy 1: explicit role-bearing nodes (most chat UIs expose at least one).
  let nodes = Array.from(
    document.querySelectorAll(
      "[data-message-author-role], [data-message-role], [data-role='user'], [data-role='assistant']"
    )
  );
  // Keep outermost only.
  let blocks = [];
  for (const n of nodes) if (!blocks.some((k) => k.contains(n))) blocks.push(n);
  for (const b of blocks) push(roleOf(b), b);

  // Strategy 2: testid/class message containers, alternating role inference.
  if (!turns.length) {
    let cands = Array.from(
      document.querySelectorAll(
        "[data-testid*='message' i], [data-testid*='turn' i], " +
          "[class*='message-' i], [class*='-message' i], [class*='chat-turn' i], " +
          "[class*='conversation-turn' i], [class*='bubble' i]"
      )
    );
    const outer = [];
    for (const n of cands) if (!outer.some((k) => k.contains(n))) outer.push(n);
    let idx = 0;
    for (const b of outer) {
      const text = clean(b.innerText || b.textContent || "");
      if (!text || text.length < 2) continue;
      const role = roleOf(b) || (idx % 2 === 0 ? "user" : "assistant");
      push(role, b);
      idx += 1;
    }
  }

  const title =
    clean(document.title || "")
      .replace(new RegExp("\\s*[-|—]\\s*" + label + ".*$", "i"), "")
      .trim() || label + " 对话";

  const markdown = turns
    .map(
      (t) =>
        (t.role === "user" ? "## 🧑 用户\n\n" : "## 🤖 " + label + "\n\n") + t.text
    )
    .join("\n\n");

  return { ok: turns.length > 0, title, url: location.href, turns, markdown };
}

if (typeof self !== "undefined") self.snowanScrapeGeneric = snowanScrapeGeneric;
