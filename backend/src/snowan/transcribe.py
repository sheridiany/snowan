"""Local speech-to-text via faster-whisper. The model is a module-level singleton
built on first use (lazy, ~a few hundred MB), so importing this module is cheap and
the engine only loads when a recording is actually transcribed."""
from pathlib import Path

_model = None  # WhisperModel singleton; built on first transcribe()


def transcribe(audio_path: str | Path) -> str:
    """Transcribe an audio file to text (language auto-detected). Returns a clear
    Chinese message instead of raising if faster-whisper isn't installed."""
    global _model
    if _model is None:
        try:
            from faster_whisper import WhisperModel
        except ImportError:
            return "转写引擎未安装(faster-whisper)"
        _model = WhisperModel("small", device="cpu", compute_type="int8")
    segments, _info = _model.transcribe(str(audio_path))
    return "".join(seg.text for seg in segments).strip()
