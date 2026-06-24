// Claude.ai transcript scraper. Self-contained for executeScript injection.
// Returns { ok, title, url, turns: [{role,text}], markdown }.
function snowanScrapeClaude() {
  function clean(s) {
    return (s || "")
      .replace(/ /g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // Claude renders human turns with data-testid="user-message" and assistant turns inside
  // .font-claude-message (also seen as .font-claude-response). Class names drift, so prefer
  // the data-testid for users and treat the claude-font block as the assistant unit, with
  // data-testid fallbacks. We collect candidate blocks, then drop any block nested inside
  // another already-collected block so overlapping selectors don't double-count a turn.
  const userSel = '[data-testid="user-message"]';
  const asstSel =
    ".font-claude-message, .font-claude-response, [data-testid='assistant-message'], [data-testid='claude-message']";

  let candidates = Array.from(document.querySelectorAll(userSel + ", " + asstSel));

  // Fallback: some layouts wrap each turn in a row keyed by an explicit role attribute.
  if (candidates.length === 0) {
    candidates = Array.from(
      document.querySelectorAll("[data-message-author-role], [data-testid$='-message']")
    );
  }

  // Keep only the outermost matches in document order (drop nested duplicates).
  const blocks = [];
  for (const b of candidates) {
    if (!blocks.some((kept) => kept.contains(b))) blocks.push(b);
  }
  // querySelectorAll is already document order; the nesting filter preserves it.

  const turns = [];
  for (const b of blocks) {
    let role;
    if (b.matches(userSel) || /user/i.test(b.getAttribute("data-message-author-role") || "")) {
      role = "user";
    } else {
      role = "assistant";
    }
    const text = clean(b.innerText || b.textContent || "");
    if (text) turns.push({ role, text });
  }

  const title =
    clean(document.title || "").replace(/\s*[-|]\s*Claude.*$/i, "") || "Claude 对话";
  const url = location.href;

  const markdown = turns
    .map((t) => (t.role === "user" ? "## 🧑 用户\n\n" : "## 🤖 Claude\n\n") + t.text)
    .join("\n\n");

  return { ok: turns.length > 0, title, url, turns, markdown };
}

if (typeof self !== "undefined") self.snowanScrapeClaude = snowanScrapeClaude;
