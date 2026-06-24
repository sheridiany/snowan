"""Voice memos (录音) API: list, upload + transcribe + summarize, detail, audio
playback, and delete. Upload is multipart/form-data (an audio blob recorded in the
browser); the heavy local transcription runs off the event loop so the request
worker isn't blocked while Whisper churns."""
import threading

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response, StreamingResponse

from .. import recordings, transcribe

router = APIRouter(prefix="/api/recordings")


@router.get("")
def list_recordings() -> dict:
    return {"recordings": recordings.list_recordings()}


@router.post("")
async def create_recording(
    file: UploadFile = File(...), duration_ms: int = Form(0)
) -> dict:
    audio = await file.read()
    if not audio:
        raise HTTPException(422, "录音文件为空")
    # Whisper transcription is CPU-bound and blocks; run it in a worker thread.
    return await run_in_threadpool(
        recordings.create_recording, audio, file.content_type or "audio/webm", duration_ms
    )


# Registered before /{rec_id} so "asr" / "transcribe" aren't captured as recording ids.
@router.get("/asr")
def asr_status() -> dict:
    return {
        "model": f"faster-whisper {transcribe.MODEL_NAME}",
        "size_mb": transcribe.SIZE_MB,
        "ready": transcribe.is_ready(),
        "downloading": transcribe.is_downloading(),
    }


@router.post("/asr/download")
def asr_download() -> dict:
    if transcribe.is_ready():
        return {"ready": True, "downloading": False}
    if not transcribe.is_downloading():
        threading.Thread(target=transcribe.download, daemon=True).start()
    return {"ready": False, "downloading": True}


@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)) -> dict:
    """One-off transcription for voice input — returns text only (no stored memo)."""
    audio = await file.read()
    if not audio:
        raise HTTPException(422, "录音文件为空")
    text = await run_in_threadpool(
        recordings.transcribe_blob, audio, file.content_type or "audio/webm"
    )
    return {"text": text}


@router.get("/{rec_id}")
def get_recording(rec_id: str) -> dict:
    rec = recordings.get_recording(rec_id)
    if rec is None:
        raise HTTPException(404, "recording not found")
    return rec


@router.get("/{rec_id}/audio")
def get_audio(rec_id: str) -> StreamingResponse:
    found = recordings.recording_audio(rec_id)
    if found is None:
        raise HTTPException(404, "audio not found")
    path, media_type = found
    return StreamingResponse(path.open("rb"), media_type=media_type)


@router.delete("/{rec_id}")
def delete_recording(rec_id: str) -> Response:
    if not recordings.delete_recording(rec_id):
        raise HTTPException(404, "recording not found")
    return Response(status_code=204)
