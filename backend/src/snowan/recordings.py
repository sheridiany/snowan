"""Voice memos: each recording is a folder under ~/.snowan/recordings/<id>/ holding
the original audio plus a meta.json (mirrors how notes live under ~/.snowan). On
create we transcribe locally (transcribe.py) and distill a title + key-points
summary from the transcript via the active LLM, with a local fallback so saving a
memo never hard-fails."""
import asyncio
import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from . import config, transcribe
from .agent.providers import build_model
from .config import load_settings

# audio MIME -> file extension for the stored blob; default .webm (the recorder
# produces audio/webm), and the extension is what /audio echoes back as media_type.
_EXT = {
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
}
_MIME_BY_EXT = {v: k for k, v in _EXT.items()}

_SYSTEM = """你是录音整理助手。根据下面这段录音转写文本,产出一个简短标题和要点摘要。
严格只输出 JSON,格式为 {"title": "…", "summary": "…"}:
- title:不超过 20 字的中文短标题,概括这段录音讲了什么,不要书名号、不要标点结尾。
- summary:用「· 」开头的几条要点(每条一行),凝练录音里的关键信息,以第一人称陈述事实。
不要输出 JSON 以外的任何内容。"""

_FENCE = re.compile(r"^```(?:json)?\s*\n(.*)\n```\s*$", re.S)
_TIMEOUT = 30.0


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _dir() -> Path:
    return config.SNOWAN_HOME / "recordings"


def _rec_dir(rec_id: str) -> Path:
    return _dir() / rec_id


def _meta_path(rec_id: str) -> Path:
    return _rec_dir(rec_id) / "meta.json"


def _audio_path(rec_id: str) -> Path | None:
    d = _rec_dir(rec_id)
    if not d.exists():
        return None
    return next((p for p in d.iterdir() if p.name != "meta.json" and p.is_file()), None)


def _public(meta: dict, *, with_transcript: bool) -> dict:
    return {
        "id": meta["id"],
        "title": meta["title"],
        "created_at": meta["created_at"],
        "duration_ms": meta.get("duration_ms", 0),
        "summary": meta.get("summary", ""),
        "transcript": meta.get("transcript", "") if with_transcript else "",
    }


def _read_meta(rec_id: str) -> dict | None:
    p = _meta_path(rec_id)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _fallback(transcript: str) -> tuple[str, str]:
    """Title + summary without a model: first line as the title, the transcript
    itself as the body. Keeps a memo usable even with no LLM configured."""
    first = next((ln.strip() for ln in transcript.splitlines() if ln.strip()), "")
    title = (first[:20] or "语音备忘")
    summary = f"· {transcript.strip()}" if transcript.strip() else "(无转写内容)"
    return title, summary


async def _summarize(transcript: str) -> tuple[str, str]:
    """Distill a short title + key-points summary from the transcript via the active
    model. Never raises — any failure/timeout falls back to the local heuristic."""
    if not transcript.strip():
        return "空录音", "(无转写内容)"
    s = load_settings()
    if s.provider == "test" or not s.api_key:
        return _fallback(transcript)
    try:
        from pydantic_ai import Agent

        agent = Agent(build_model(s), instructions=_SYSTEM)
        res = await asyncio.wait_for(agent.run(f"录音转写:\n{transcript[:6000]}"), timeout=_TIMEOUT)
        out = res.output if isinstance(res.output, str) else str(res.output)
        m = _FENCE.match(out.strip())
        data = json.loads((m.group(1) if m else out).strip())
        title = str(data.get("title", "")).strip()
        summary = str(data.get("summary", "")).strip()
        if not title or not summary:
            return _fallback(transcript)
        return title, summary
    except Exception:  # noqa: BLE001 — never lose the memo over a model failure
        return _fallback(transcript)


# --- public API ------------------------------------------------------------

def create_recording(audio_bytes: bytes, mime: str, duration_ms: int) -> dict:
    """Save the audio, transcribe it locally, generate a title + key-points summary,
    write meta.json, and return the finished Recording."""
    rec_id = f"rec_{uuid.uuid4().hex}"
    d = _rec_dir(rec_id)
    d.mkdir(parents=True, exist_ok=True)
    ext = _EXT.get((mime or "").split(";")[0].strip(), ".webm")
    audio_path = d / f"audio{ext}"
    audio_path.write_bytes(audio_bytes)

    transcript = transcribe.transcribe(audio_path)
    title, summary = asyncio.run(_summarize(transcript))

    meta = {
        "id": rec_id,
        "title": title,
        "created_at": _now(),
        "duration_ms": int(duration_ms or 0),
        "summary": summary,
        "transcript": transcript,
        "audio_file": audio_path.name,
    }
    _meta_path(rec_id).write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return _public(meta, with_transcript=True)


def list_recordings() -> list[dict]:
    d = _dir()
    if not d.exists():
        return []
    metas = [m for p in d.iterdir() if p.is_dir() and (m := _read_meta(p.name))]
    metas.sort(key=lambda m: m["created_at"], reverse=True)
    return [_public(m, with_transcript=False) for m in metas]


def get_recording(rec_id: str) -> dict | None:
    meta = _read_meta(rec_id)
    return _public(meta, with_transcript=True) if meta else None


def delete_recording(rec_id: str) -> bool:
    d = _rec_dir(rec_id)
    if not d.exists():
        return False
    for p in d.iterdir():
        p.unlink(missing_ok=True)
    d.rmdir()
    return True


def recording_audio(rec_id: str) -> tuple[Path, str] | None:
    """The stored audio file path + its media type, or None if there's no audio."""
    p = _audio_path(rec_id)
    if p is None:
        return None
    return p, _MIME_BY_EXT.get(p.suffix, "application/octet-stream")
