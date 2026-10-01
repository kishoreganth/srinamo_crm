import os
import uuid

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/upload", tags=["Upload"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "id-documents")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"}
MAX_SIZE = 10 * 1024 * 1024


@router.post("/id-document")
async def upload_id_document(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    if not file.content_type or file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Only image or PDF files are allowed")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "File too large (max 10MB)")

    ext = os.path.splitext(file.filename or "doc")[1] or ".bin"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    return {"url": f"/uploads/id-documents/{filename}", "filename": file.filename}
