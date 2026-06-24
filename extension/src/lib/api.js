// Snowan backend client. Runs in the service worker (classic script, loaded via importScripts).
// Reads the configured backend base URL from chrome.storage and POSTs captures to the
// local Snowan desktop app. All network traffic goes only to the user's machine.

const SNOWAN_DEFAULT_BASE = "http://127.0.0.1:8787";

// chrome.storage keys, shared with options.js / popup.js.
const SNOWAN_STORAGE_KEYS = {
  base: "backendBase",
  captureHtml: "captureHtml",
};

function snowanNormalizeBase(raw) {
  let base = (raw || "").trim();
  if (!base) base = SNOWAN_DEFAULT_BASE;
  if (!/^https?:\/\//i.test(base)) base = "http://" + base;
  return base.replace(/\/+$/, "");
}

async function snowanGetSettings() {
  const stored = await chrome.storage.sync.get({
    [SNOWAN_STORAGE_KEYS.base]: SNOWAN_DEFAULT_BASE,
    [SNOWAN_STORAGE_KEYS.captureHtml]: false,
  });
  return {
    base: snowanNormalizeBase(stored[SNOWAN_STORAGE_KEYS.base]),
    captureHtml: Boolean(stored[SNOWAN_STORAGE_KEYS.captureHtml]),
  };
}

// Distinguish "backend unreachable" (desktop app not running) from real HTTP errors so
// the UI can show the right hint.
class SnowanError extends Error {
  constructor(message, { offline = false, status = 0 } = {}) {
    super(message);
    this.name = "SnowanError";
    this.offline = offline;
    this.status = status;
  }
}

function snowanFetchWithTimeout(url, opts, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

// POST /api/capture. payload: {kind, url, title, content, html?, captured_at}
// Returns the backend's JSON {id, title, category, tags, kind}.
async function snowanCapture(payload, { base } = {}) {
  const settings = await snowanGetSettings();
  const target = (base ? snowanNormalizeBase(base) : settings.base) + "/api/capture";

  let res;
  try {
    res = await snowanFetchWithTimeout(
      target,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      15000
    );
  } catch (err) {
    throw new SnowanError("无法连接 Snowan 桌面端,请先启动 Snowan。", {
      offline: true,
    });
  }

  if (res.status === 422) {
    let detail = "抓取内容为空";
    try {
      detail = (await res.json()).detail || detail;
    } catch (_) {}
    throw new SnowanError(detail, { status: 422 });
  }
  if (!res.ok) {
    throw new SnowanError(`后端返回错误 (HTTP ${res.status})`, {
      status: res.status,
    });
  }
  return res.json();
}

// Lightweight health probe used by the popup status line and options "测试连接".
// GET /api/capture is cheap and always present.
async function snowanPing({ base } = {}) {
  const settings = await snowanGetSettings();
  const target = (base ? snowanNormalizeBase(base) : settings.base) + "/api/capture";
  try {
    const res = await snowanFetchWithTimeout(target, { method: "GET" }, 4000);
    return { ok: res.ok, status: res.status };
  } catch (_) {
    return { ok: false, offline: true };
  }
}

// Export for both service-worker (self) and any module-style consumer.
if (typeof self !== "undefined") {
  self.SnowanApi = {
    DEFAULT_BASE: SNOWAN_DEFAULT_BASE,
    STORAGE_KEYS: SNOWAN_STORAGE_KEYS,
    normalizeBase: snowanNormalizeBase,
    getSettings: snowanGetSettings,
    capture: snowanCapture,
    ping: snowanPing,
    SnowanError,
  };
}
