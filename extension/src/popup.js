// Popup UI. Talks to the service worker over chrome.runtime.sendMessage only; it never
// injects scripts or hits the network itself.

const $ = (id) => document.getElementById(id);

function send(msg) {
  return chrome.runtime.sendMessage(msg);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function showMessage(text, cls) {
  const el = $("message");
  el.textContent = text;
  el.className = "message " + cls;
  el.hidden = false;
}

function showResult({ title, category, tags, site }) {
  $("result-title").textContent = title || "未命名抓取";
  $("result-cat").textContent = category || "未分类";
  const tagText = (tags || []).length ? "#" + tags.join("  #") : "";
  $("result-tags").textContent = site ? `${site}${tagText ? " · " + tagText : ""}` : tagText;
  $("result").hidden = false;
}

let currentTab = null;
let detected = null;

async function refreshStatus() {
  const res = await send({ type: "ping" });
  const dot = $("status-dot");
  const txt = $("status-text");
  if (res && res.ok) {
    dot.className = "dot ok";
    txt.textContent = "已连接 Snowan";
  } else {
    dot.className = "dot err";
    txt.textContent = "Snowan 未运行";
  }
}

async function init() {
  currentTab = await getActiveTab();
  await refreshStatus();

  detected = await send({ type: "detect", tabId: currentTab && currentTab.id });
  const btn = $("capture-btn");
  const hint = $("kind-hint");

  if (!detected || !detected.injectable) {
    hint.textContent = "当前页面不支持剪藏";
    btn.disabled = true;
    return;
  }

  if (detected.kind === "ai_chat") {
    hint.textContent = `识别为 ${detected.site} 对话页`;
    btn.textContent = "剪藏这段对话";
  } else {
    hint.textContent = "普通网页 · 将抽取正文";
    btn.textContent = "剪藏本页";
  }
  btn.disabled = false;

  // Auto-capture status line.
  const auto = $("auto-status");
  if (!detected.autoEnabled) {
    auto.textContent = "自动剪藏已关闭 · 仅手动";
    auto.className = "auto-status off";
    auto.hidden = false;
  } else if (detected.autoEligible) {
    auto.textContent =
      detected.kind === "ai_chat"
        ? "将自动剪藏:对话页(随对话更新)"
        : "将自动剪藏:停留足够久且正文够长时";
    auto.className = "auto-status";
    auto.hidden = false;
  } else {
    auto.textContent =
      detected.autoReason === "denylist" ? "本站在排除名单 · 仅手动" : "自动剪藏不适用 · 仅手动";
    auto.className = "auto-status off";
    auto.hidden = false;
  }

  // Selection capture is offered opportunistically; the worker reports "no selection" if empty.
  $("capture-selection").hidden = false;
}

async function capture(mode) {
  const btn = $("capture-btn");
  const selBtn = $("capture-selection");
  $("message").hidden = true;
  $("result").hidden = true;
  document.body.classList.add("busy");
  btn.disabled = true;
  selBtn.disabled = true;

  try {
    const res = await send({ type: "capture", tabId: currentTab && currentTab.id, mode });
    if (res && res.ok) {
      showResult(res);
      refreshStatus();
    } else if (res && res.offline) {
      showMessage("无法连接 Snowan 桌面端,请先启动 Snowan 后重试。", "err");
      refreshStatus();
    } else {
      showMessage((res && res.error) || "剪藏失败", "err");
    }
  } catch (err) {
    showMessage((err && err.message) || "剪藏失败", "err");
  } finally {
    document.body.classList.remove("busy");
    btn.disabled = false;
    selBtn.disabled = false;
  }
}

$("capture-btn").addEventListener("click", () => capture("auto"));
$("capture-selection").addEventListener("click", () => capture("selection"));
$("open-options").addEventListener("click", () => chrome.runtime.openOptionsPage());

init();
