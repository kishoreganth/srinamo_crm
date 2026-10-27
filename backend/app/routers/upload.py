import os
import re
import uuid

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import BookingGuest, Guest

router = APIRouter(prefix="/api/upload", tags=["Upload"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "id-documents")
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_SIZE = 10 * 1024 * 1024
SAFE_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$")


def sniff_extension(content: bytes) -> str | None:
    if content.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if content.startswith(b"%PDF"):
        return ".pdf"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return ".webp"
    return None


def user_role(user) -> str:
    role = getattr(user, "role", "")
    return role.value if hasattr(role, "value") else str(role)


def id_path(filename: str) -> str:
    name = os.path.basename(filename or "")
    if not SAFE_NAME.match(name) or ".." in name:
        raise HTTPException(400, "Invalid file name")
    path = os.path.join(UPLOAD_DIR, name)
    if not os.path.isfile(path):
        raise HTTPException(404, "Document not found")
    return path


async def file_is_attached(db: AsyncSession, filename: str) -> bool:
    guest = await db.execute(
        select(Guest.id).where(Guest.idDocumentUrl.is_not(None), Guest.idDocumentUrl.contains(filename)).limit(1)
    )
    if guest.first():
        return True
    companion = await db.execute(
        select(BookingGuest.id).where(BookingGuest.idDocumentUrl.is_not(None), BookingGuest.idDocumentUrl.contains(filename)).limit(1)
    )
    return companion.first() is not None


async def assert_reception_draft(user, db: AsyncSession, filename: str) -> None:
    if user_role(user) == "ADMIN":
        return
    if await file_is_attached(db, filename):
        raise HTTPException(403, "Reception cannot open or delete an ID after the booking is saved")


@router.post("/id-document")
async def upload_id_document(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "File too large (max 10MB)")
    ext = sniff_extension(content)
    if not ext:
        raise HTTPException(400, "Only JPEG, PNG, WEBP, or PDF files are allowed")

    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as handle:
        handle.write(content)

    return {"url": f"/api/upload/id-document/{filename}", "filename": filename}


@router.get("/id-document/{filename}")
async def download_id_document(filename: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await assert_reception_draft(user, db, filename)
    path = id_path(filename)
    media = "application/pdf" if path.endswith(".pdf") else "application/octet-stream"
    if path.endswith(".jpg"):
        media = "image/jpeg"
    elif path.endswith(".png"):
        media = "image/png"
    elif path.endswith(".webp"):
        media = "image/webp"
    return FileResponse(path, media_type=media, filename=filename)


@router.delete("/id-document/{filename}")
async def delete_id_document(filename: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user_role(user) != "ADMIN" and await file_is_attached(db, filename):
        raise HTTPException(403, "Reception cannot open or delete an ID after the booking is saved")
    if user_role(user) == "ADMIN" and await file_is_attached(db, filename):
        raise HTTPException(403, "Saved ID files are kept")
    path = id_path(filename)
    os.remove(path)
    return {"ok": True}
