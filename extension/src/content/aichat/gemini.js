// Gemini (gemini.google.com) transcript scraper. Self-contained for executeScript injection.
// Returns { ok, title, url, turns: [{role,text}], markdown }.
function snowanScrapeGemini() {
  function clean(s) {
    return (s || "").replace(/ /g, " ").replace(/\s+\n/g, "\n").trim();
  }

  const title = clean(document.title || "Gemini 对话").replace(/\s*[-|]\s*Gemini$/i, "");
  const url = location.href;
  const fail = { ok: false, title, url, turns: [], markdown: "" };

  // Gemini renders each turn with Angular custom elements: <user-query> for the prompt and
  // <model-response> for the answer (usually paired inside <conversation-container>). We anchor
  // on these tag names as the primary selectors — they are semantic and stable across class
  // hashing. Selecting the custom elements (not their inner .user-query-container /
  // .model-response-text) avoids double-counting, since those classes are descendants.
  let blocks = Array.from(document.querySelectorAll("user-query, model-response"));

  // Fallback for layout drift: if the custom tags are gone, use the container classes, then
  // a generic conversation-turn hook. Keep selectors at the same nesting level to avoid dupes.
  if (!blocks.length) {
    blocks = Array.from(
      document.querySelectorAll(".user-query-container, .model-response-text")
    );
  }
  if (!blocks.length) {
    blocks = Array.from(document.querySelectorAll("[data-test-id='conversation-turn']"));
  }
  if (!blocks.length) return fail;

  const turns = [];
  for (const b of blocks) {
    const tag = b.tagName.toLowerCase();
    let role = null;
    if (tag === "user-query" || b.matches(".user-query-container")) role = "user";
    else if (tag === "model-response" || b.matches(".model-response-text")) role = "assistant";
    else {
      // Generic conversation-turn hook: infer role from its content.
      if (b.querySelector("user-query, .user-query-container, .query-text")) role = "user";
      else if (b.querySelector("model-response, .model-response-text, message-content")) role = "assistant";
    }
    if (!role) continue;

    // Prefer the rendered answer/prompt body so we skip toolbar/footer chrome; fall back to
    // the whole block when the inner body class isn't found.
    let body = b;
    if (role === "user") {
      body = b.querySelector(".query-text, .user-query-bubble-with-background, .horizontal-content-container") || b;
    } else {
      body = b.querySelector("message-content, .model-response-text, .markdown") || b;
    }

    const text = clean(body.innerText || body.textContent || "");
    if (text) turns.push({ role, text });
  }

  const markdown = turns
    .map((t) => (t.role === "user" ? "## 🧑 用户\n\n" : "## 🤖 Gemini\n\n") + t.text)
    .join("\n\n");

  return { ok: turns.length > 0, title, url, turns, markdown };
}

if (typeof self !== "undefined") self.snowanScrapeGemini = snowanScrapeGemini;
