"""Web search + fetch tools (Claude Code's two-tool split). Search uses the user's
chosen provider — Tavily / Brave with a BYO key, else keyless DuckDuckGo so first
run works with zero config. Fetch uses local trafilatura, falling back to r.jina.ai
for JS-heavy pages (no headless browser). Returns are compact + capped to bound
tokens; results cache per query/URL for 15 min. web_fetch refuses non-public hosts
(basic SSRF guard)."""
import ipaddress
import re
import socket
import time
from urllib.parse import quote, urlparse

import httpx

from ...config import load_prefs

_CACHE: dict[str, tuple[float, str]] = {}
_TTL = 900  # 15 minutes
_MAX_CHARS = 100_000


def _cached(key: str) -> str | None:
    hit = _CACHE.get(key)
    return hit[1] if hit and time.time() - hit[0] < _TTL else None


def _store(key: str, val: str) -> None:
    _CACHE[key] = (time.time(), val)


# --- search providers ------------------------------------------------------

def _tavily(query: str, n: int, key: str) -> list[dict]:
    r = httpx.post(
        "https://api.tavily.com/search",
        json={"api_key": key, "query": query, "max_results": n, "search_depth": "basic", "include_answer": False},
        timeout=20,
    )
    r.raise_for_status()
    return [
        {"title": x.get("title", ""), "url": x.get("url", ""), "snippet": (x.get("content") or "")[:300]}
        for x in r.json().get("results", [])
    ]


def _brave(query: str, n: int, key: str) -> list[dict]:
    r = httpx.get(
        "https://api.search.brave.com/res/v1/web/search",
        params={"q": query, "count": n},
        headers={"X-Subscription-Token": key, "Accept": "application/json"},
        timeout=20,
    )
    r.raise_for_status()
    return [
        {"title": x.get("title", ""), "url": x.get("url", ""), "snippet": (x.get("description") or "")[:300]}
        for x in r.json().get("web", {}).get("results", [])[:n]
    ]


def _exa(query: str, n: int, key: str) -> list[dict]:
    # Exa neural/semantic search; request a short text excerpt so each hit has a snippet.
    r = httpx.post(
        "https://api.exa.ai/search",
        json={"query": query, "numResults": n, "contents": {"text": {"maxCharacters": 400}}},
        headers={"x-api-key": key, "Content-Type": "application/json"},
        timeout=20,
    )
    r.raise_for_status()
    return [
        {
            "title": x.get("title") or x.get("url", ""),
            "url": x.get("url", ""),
            "snippet": (x.get("text") or x.get("summary") or "")[:300],
        }
        for x in r.json().get("results", [])[:n]
    ]


def _ddg(query: str, n: int) -> list[dict]:
    from ddgs import DDGS

    with DDGS() as d:
        rows = d.text(query, max_results=n)
    return [
        {"title": x.get("title", ""), "url": x.get("href") or x.get("url", ""), "snippet": (x.get("body") or "")[:300]}
        for x in rows
    ]


def web_search(query: str, max_results: int = 5) -> str:
    """联网搜索网页,返回标题、网址和摘要。需要某条的全文时,用 web_fetch 抓它的网址。"""
    n = max(1, min(max_results, 8))
    prefs = load_prefs()
    provider = prefs.get("web_search_provider") or "duckduckgo"
    # The EFFECTIVE provider: a keyless tavily/brave silently falls back to ddg, so
    # the cache must key on what actually ran — else adding a key later serves a
    # stale ddg result cached under "tavily".
    if provider == "exa" and prefs.get("exa_api_key"):
        effective = "exa"
    elif provider == "tavily" and prefs.get("tavily_api_key"):
        effective = "tavily"
    elif provider == "brave" and prefs.get("brave_api_key"):
        effective = "brave"
    else:
        effective = "duckduckgo"
    key = f"search:{effective}:{n}:{query}"
    if (c := _cached(key)) is not None:
        return c
    try:
        if effective == "exa":
            results = _exa(query, n, prefs["exa_api_key"])
        elif effective == "tavily":
            results = _tavily(query, n, prefs["tavily_api_key"])
        elif effective == "brave":
            results = _brave(query, n, prefs["brave_api_key"])
        else:
            results = _ddg(query, n)
    except Exception as e:  # noqa: BLE001 — surface the failure to the model, don't crash the turn
        return f"搜索失败:{type(e).__name__}: {e}"
    results = [r for r in results if r["url"]]
    if not results:
        return "没有搜到相关结果。"
    out = "\n\n".join(f"[{i}] {r['title']}\n{r['url']}\n{r['snippet']}" for i, r in enumerate(results, 1))
    _store(key, out)
    return out


# --- fetch -----------------------------------------------------------------

# Surge/Clash "fake-ip" proxies resolve EVERY real domain into 198.18.0.0/15,
# which ipaddress flags as private — but it's the proxy's placeholder range, not
# the user's LAN/localhost, so blocking it would reject every fetch behind such a
# proxy. Allow it; the real LAN/loopback/metadata ranges stay blocked.
_FAKE_IP = ipaddress.ip_network("198.18.0.0/15")


def _blocked(ip) -> bool:
    if ip in _FAKE_IP:
        return False
    return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_unspecified


def _resolve_public_ips(host: str) -> list[str] | None:
    """Resolve a hostname and return its IPs only if EVERY one is public. Returns
    None on any resolution failure or if any IP is non-public (FAIL CLOSED) — a
    DNS error must not become an allow, and a single private answer poisons the host."""
    h = host.lower()
    if h == "localhost" or h.endswith((".local", ".internal", ".localhost")):
        return None
    try:
        ip = ipaddress.ip_address(host)  # literal IP
        return None if _blocked(ip) else [host]
    except ValueError:
        pass  # it's a domain name
    try:
        infos = socket.getaddrinfo(host, None)
    except (socket.gaierror, OSError):
        return None  # FAIL CLOSED: can't resolve -> don't allow
    ips: list[str] = []
    for info in infos:
        addr = info[4][0]
        try:
            if _blocked(ipaddress.ip_address(addr)):
                return None  # any private result poisons the whole host
        except ValueError:
            return None
        ips.append(addr)
    return ips or None


def _is_public(url: str) -> bool:
    """Block SSRF targets, FAIL CLOSED. Literal private/loopback IPs and localhost-ish
    names are rejected; real domains are resolved and rejected unless EVERY resolved
    IP is public (a resolution failure is treated as not-public)."""
    host = urlparse(url).hostname
    if not host:
        return False
    return _resolve_public_ips(host) is not None


_UA = "Mozilla/5.0 (compatible; Snowan/0.1)"


def _guarded_get(client: httpx.Client, url: str) -> httpx.Response | None:
    """GET a URL after validating it, connecting to a PINNED validated IP with the
    original Host header so a DNS rebind between check and connect can't redirect us
    to a private address (TOCTOU). Returns None if the host isn't public."""
    parsed = urlparse(url)
    host = parsed.hostname
    if not host:
        return None
    ips = _resolve_public_ips(host)
    if not ips:
        return None
    # Connect to the validated IP; keep the original Host header + SNI so vhosts/TLS work.
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    netloc = f"[{ips[0]}]:{port}" if ":" in ips[0] else f"{ips[0]}:{port}"
    pinned = parsed._replace(netloc=netloc).geturl()
    headers = {"Host": host if not parsed.port else f"{host}:{parsed.port}"}
    extensions = {"sni_hostname": host}
    return client.get(pinned, headers=headers, extensions=extensions)


def _fetch_html(url: str) -> str | None:
    """Fetch a page, following redirects MANUALLY so every hop is SSRF-checked and
    pinned to a validated IP. trafilatura.fetch_url (urllib) would follow a 302 to
    http://127.0.0.1/ or the cloud-metadata IP unguarded; here each hop is re-validated."""
    with httpx.Client(follow_redirects=False, timeout=20, headers={"User-Agent": _UA}) as client:
        for _ in range(4):  # cap redirect chain
            r = _guarded_get(client, url)
            if r is None:
                return None
            if r.is_redirect and r.next_request is not None:
                url = str(r.next_request.url)
                continue
            return r.text if r.status_code == 200 else None
    return None


def _trafilatura(url: str) -> str | None:
    import trafilatura

    html = _fetch_html(url)
    if not html:
        return None
    return trafilatura.extract(html, output_format="markdown", include_links=False) or None


def _jina(url: str) -> str | None:
    headers = {}
    if k := load_prefs().get("jina_api_key"):
        headers["Authorization"] = f"Bearer {k}"
    try:
        r = httpx.get("https://r.jina.ai/" + quote(url, safe=":/?&=#%"), headers=headers, timeout=30)
        return r.text if r.status_code == 200 and r.text.strip() else None
    except httpx.HTTPError:
        return None


def web_fetch(url: str) -> str:
    """抓取一个网址的正文,返回去掉导航/广告后的干净 Markdown(过长会截断)。"""
    if not re.match(r"^https?://", url):
        url = "https://" + url
    if not _is_public(url):
        return "拒绝抓取:目标不是公网地址。"
    if (c := _cached("fetch:" + url)) is not None:
        return c
    text = None
    try:
        text = _trafilatura(url)
    except Exception:  # noqa: BLE001 — fall through to the jina fallback
        text = None
    if not text or len(text) < 200:
        text = _jina(url) or text
    if not text:
        return "抓取失败或页面没有可提取的正文。"
    if len(text) > _MAX_CHARS:
        text = text[:_MAX_CHARS].rstrip() + "\n\n…(内容已截断)"
    _store("fetch:" + url, text)
    return text
