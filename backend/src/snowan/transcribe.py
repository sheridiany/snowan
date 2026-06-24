"""Local speech-to-text via faster-whisper. Like the embedding model, the weights are
a deliberate, user-controlled download from Settings (~hundreds of MB) into
~/.snowan/models — never fetched implicitly mid-recording. transcribe() gates on
is_ready(); the only place that triggers a download is the explicit download()."""
import threading
from pathlib import Path

from .config import SNOWAN_HOME

MODEL_NAME = "small"  # multilingual; good on Chinese, CPU int8
SIZE_MB = 480
CACHE_DIR = SNOWAN_HOME / "models"  # shared, user-visible app model dir

_model = None  # WhisperModel singleton
_downloading = False
_lock = threading.Lock()


def _build():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        _model = WhisperModel(
            MODEL_NAME, device="cpu", compute_type="int8", download_root=str(CACHE_DIR)
        )
    return _model


def is_ready() -> bool:
    """Whether the Whisper weights are fully present locally — no network call. False
    while a download is in flight, so a recording never loads a half-written model."""
    if _downloading or not CACHE_DIR.exists():
        return False
    return any(CACHE_DIR.rglob("model.bin"))


def is_downloading() -> bool:
    return _downloading


def download() -> None:
    """Explicitly fetch the model (blocks until done). Safe to call when ready."""
    global _downloading
    with _lock:
        if _downloading:
            return
        _downloading = True
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        _build()  # instantiating downloads the weights into CACHE_DIR
    finally:
        _downloading = False


def transcribe(audio_path: str | Path) -> str:
    """Transcribe an audio file to text (language auto-detected). Returns a clear
    Chinese message instead of raising if the model isn't downloaded yet or the engine
    is missing — callers surface it to the user."""
    if not is_ready():
        return "语音模型未下载——在 设置 → 语音 里下载后即可转写"
    try:
        m = _build()
    except ImportError:
        return "转写引擎未安装(faster-whisper)"
    segments, _info = m.transcribe(str(audio_path))
    return "".join(seg.text for seg in segments).strip()
