"""Private call recordings. Files stay on disk and are never removed by a job."""
import os
import re
import uuid

from fastapi import HTTPException

from app.config import get_settings

RECORDING_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "uploads",
    "call-recordings",
)
SAFE_NAME = re.compile(r"^[a-f0-9]{32}\.(mp3|m4a|wav|ogg|webm)$")


def sniff_audio(content: bytes) -> tuple[str, str] | None:
    if content.startswith(b"ID3") or (
        len(content) >= 2 and content[0] == 0xFF and (content[1] & 0xE0) == 0xE0
    ):
        return ".mp3", "audio/mpeg"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WAVE":
        return ".wav", "audio/wav"
    if content.startswith(b"OggS"):
        return ".ogg", "audio/ogg"
    if content.startswith(b"\x1a\x45\xdf\xa3") and b"webm" in content[:128]:
        return ".webm", "audio/webm"
    if len(content) >= 12 and content[4:8] == b"ftyp":
        brand = content[8:32]
        if b"M4A" in brand or b"mp42" in brand or b"M4B" in brand:
            return ".m4a", "audio/mp4"
    return None


def store_recording(content: bytes) -> tuple[str, str, str]:
    limit = int(get_settings().CALL_RECORDING_MAX_BYTES)
    if len(content) > limit:
        raise HTTPException(400, "File too large (max 25MB)")
    sniffed = sniff_audio(content)
    if not sniffed:
        raise HTTPException(400, "Only mp3, m4a, wav, ogg, or webm audio is allowed")
    ext, mime = sniffed
    filename = f"{uuid.uuid4().hex}{ext}"
    os.makedirs(RECORDING_DIR, exist_ok=True)
    path = os.path.join(RECORDING_DIR, filename)
    with open(path, "wb") as handle:
        handle.write(content)
    return filename, mime, path


def recording_path(filename: str) -> str:
    name = os.path.basename(filename or "")
    if not SAFE_NAME.match(name):
        raise HTTPException(400, "Invalid file name")
    path = os.path.join(RECORDING_DIR, name)
    if not os.path.isfile(path):
        raise HTTPException(404, "Recording not found")
    return path
