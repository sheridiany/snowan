// Options page. Reads/writes chrome.storage.sync and probes the backend directly
// (it has host_permissions for the local Snowan origins).

const DEFAULT_BASE = "http://127.0.0.1:8787";
const KEYS = { base: "backendBase", captureHtml: "captureHtml" };

const $ = (id) => document.getElementById(id);

function normalizeBase(raw) {
  let base = (raw || "").trim();
  if (!base) base = DEFAULT_BASE;
  if (!/^https?:\/\//i.test(base)) base = "http://" + base;
  return base.replace(/\/+$/, "");
}

async function load() {
  const s = await chrome.storage.sync.get({
    [KEYS.base]: DEFAULT_BASE,
    [KEYS.captureHtml]: false,
  });
  $("base").value = s[KEYS.base];
  $("capture-html").checked = Boolean(s[KEYS.captureHtml]);
}

async function save() {
  const base = normalizeBase($("base").value);
  $("base").value = base;
  await chrome.storage.sync.set({
    [KEYS.base]: base,
    [KEYS.captureHtml]: $("capture-html").checked,
  });
  const saved = $("saved");
  saved.classList.add("show");
  setTimeout(() => saved.classList.remove("show"), 1500);
}

function setStatus(text, cls) {
  const el = $("status");
  el.textContent = text;
  el.className = "status " + (cls || "");
}

async function test() {
  const base = normalizeBase($("base").value);
  $("base").value = base;
  setStatus("正在测试…", "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(base + "/api/capture", {
      method: "GET",
      signal: controller.signal,
    });
    if (res.ok) setStatus("连接成功,Snowan 桌面端在线。", "ok");
    else setStatus(`已连上但返回 HTTP ${res.status}。`, "err");
  } catch (_) {
    setStatus("连接失败,请确认 Snowan 桌面端已启动且端口正确。", "err");
  } finally {
    clearTimeout(timer);
  }
}

$("save").addEventListener("click", save);
$("test").addEventListener("click", test);
load();
