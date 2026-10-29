from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    CallDirection,
    Enquiry,
    EnquiryRecording,
    EnquirySource,
    EnquiryStatus,
    EnquiryType,
    Guest,
    GuestSource,
    Lead,
)
from app.serialize import row_to_dict
from app.services.audit import record_audit
from app.services.phone import normalize_phone
from app.services.recordings import recording_path, store_recording

router = APIRouter(prefix="/api/enquiries", tags=["Enquiries"])

_GUEST_SOURCE = {
    "PHONE": GuestSource.PHONE,
    "WHATSAPP": GuestSource.WHATSAPP,
    "WALK_IN": GuestSource.WALK_IN,
    "REFERRAL": GuestSource.REFERRAL,
}


def _role(user) -> str:
    role = getattr(user, "role", "")
    return role.value if hasattr(role, "value") else str(role)


def _enum(kind, value: str, label: str):
    try:
        return kind(value)
    except ValueError:
        allowed = ", ".join(item.value for item in kind)
        raise HTTPException(400, f"{label} must be one of: {allowed}")


def _phone(raw: str | None, required: bool) -> str | None:
    if raw is None or str(raw).strip() == "":
        if required:
            raise HTTPException(400, "Enter a phone number with country code")
        return None
    phone = normalize_phone(raw)
    if not phone or not 8 <= len(phone) <= 15:
        raise HTTPException(400, "Enter a phone number with country code")
    return phone


def _when(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        raise HTTPException(400, "Enter a valid date")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _can_play(user, enquiry: Enquiry) -> bool:
    return _role(user) == "ADMIN" or enquiry.takenByUserId == getattr(user, "id", None)


def _public(enquiry: Enquiry, user, recordings: list[EnquiryRecording] | None = None) -> dict:
    data = row_to_dict(enquiry, rels=set())
    taken = enquiry.takenBy
    data["takenBy"] = {"id": taken.id, "name": taken.name} if taken else None
    data["canPlay"] = _can_play(user, enquiry)
    data["recordings"] = [
        {
            "id": row.id,
            "originalName": row.originalName,
            "sizeBytes": row.sizeBytes,
            "mime": row.mime,
            "createdAt": row.createdAt.isoformat() if row.createdAt else None,
        }
        for row in (recordings or [])
    ]
    return data


class EnquiryBody(BaseModel):
    callerName: str
    phone: str
    alternatePhone: Optional[str] = None
    email: Optional[EmailStr] = None
    enquiryType: str = "ROOM_STAY"
    source: str = "PHONE"
    preferredCheckIn: Optional[str] = None
    preferredCheckOut: Optional[str] = None
    adults: int = 1
    children: int = 0
    interest: Optional[str] = None
    budget: Optional[float] = None
    heardAbout: Optional[str] = None
    callDirection: str = "INCOMING"
    callAt: Optional[str] = None
    durationSeconds: Optional[int] = None
    status: Optional[str] = None
    nextFollowUpAt: Optional[str] = None
    notes: Optional[str] = None
    bookingId: Optional[str] = None


class EnquiryPatch(BaseModel):
    callerName: Optional[str] = None
    phone: Optional[str] = None
    alternatePhone: Optional[str] = None
    email: Optional[EmailStr] = None
    enquiryType: Optional[str] = None
    source: Optional[str] = None
    preferredCheckIn: Optional[str] = None
    preferredCheckOut: Optional[str] = None
    adults: Optional[int] = None
    children: Optional[int] = None
    interest: Optional[str] = None
    budget: Optional[float] = None
    heardAbout: Optional[str] = None
    callDirection: Optional[str] = None
    callAt: Optional[str] = None
    durationSeconds: Optional[int] = None
    status: Optional[str] = None
    nextFollowUpAt: Optional[str] = None
    notes: Optional[str] = None
    bookingId: Optional[str] = None


def _fill(enquiry: Enquiry, body: EnquiryBody | EnquiryPatch, fields: set[str]) -> None:
    if "callerName" in fields:
        name = (body.callerName or "").strip()
        if not name:
            raise HTTPException(400, "Caller name is required")
        enquiry.callerName = name
    if "phone" in fields:
        enquiry.phone = _phone(body.phone, True)
    if "alternatePhone" in fields:
        enquiry.alternatePhone = _phone(body.alternatePhone, False)
    if "email" in fields:
        enquiry.email = str(body.email) if body.email else None
    if "enquiryType" in fields and body.enquiryType:
        enquiry.enquiryType = _enum(EnquiryType, body.enquiryType, "Enquiry type")
    if "source" in fields and body.source:
        enquiry.source = _enum(EnquirySource, body.source, "Source")
    if "preferredCheckIn" in fields:
        enquiry.preferredCheckIn = _when(body.preferredCheckIn)
    if "preferredCheckOut" in fields:
        enquiry.preferredCheckOut = _when(body.preferredCheckOut)
    if "adults" in fields and body.adults is not None:
        if body.adults < 0:
            raise HTTPException(400, "Adults cannot be negative")
        enquiry.adults = body.adults
    if "children" in fields and body.children is not None:
        if body.children < 0:
            raise HTTPException(400, "Children cannot be negative")
        enquiry.children = body.children
    if "interest" in fields:
        enquiry.interest = body.interest
    if "budget" in fields:
        enquiry.budget = Decimal(str(body.budget)) if body.budget is not None else None
    if "heardAbout" in fields:
        enquiry.heardAbout = body.heardAbout
    if "callDirection" in fields and body.callDirection:
        enquiry.callDirection = _enum(CallDirection, body.callDirection, "Call direction")
    if "callAt" in fields:
        enquiry.callAt = _when(body.callAt)
    if "durationSeconds" in fields and body.durationSeconds is not None:
        if body.durationSeconds < 0:
            raise HTTPException(400, "Duration cannot be negative")
        enquiry.durationSeconds = body.durationSeconds
    if "status" in fields and body.status:
        enquiry.status = _enum(EnquiryStatus, body.status, "Status")
    if "nextFollowUpAt" in fields:
        enquiry.nextFollowUpAt = _when(body.nextFollowUpAt)
    if "notes" in fields:
        enquiry.notes = body.notes
    if "bookingId" in fields:
        enquiry.bookingId = body.bookingId or None


async def _load(db: AsyncSession, enquiry_id: str) -> Enquiry:
    result = await db.execute(
        select(Enquiry).options(selectinload(Enquiry.takenBy)).where(Enquiry.id == enquiry_id)
    )
    enquiry = result.scalar_one_or_none()
    if not enquiry:
        raise HTTPException(404, "Enquiry not found")
    return enquiry


async def _recordings(db: AsyncSession, enquiry_id: str) -> list[EnquiryRecording]:
    result = await db.execute(
        select(EnquiryRecording)
        .where(EnquiryRecording.enquiryId == enquiry_id)
        .order_by(EnquiryRecording.createdAt.desc())
    )
    return list(result.scalars().all())


@router.get("")
async def list_enquiries(
    q: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    due: bool = False,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    when = func.coalesce(Enquiry.callAt, Enquiry.createdAt)
    stmt = select(Enquiry).options(selectinload(Enquiry.takenBy)).order_by(Enquiry.createdAt.desc())
    if q:
        needle = f"%{q.strip()}%"
        stmt = stmt.where(or_(
            Enquiry.callerName.ilike(needle),
            Enquiry.phone.contains(q.strip()),
            Enquiry.alternatePhone.contains(q.strip()),
        ))
    if status and status != "ALL":
        stmt = stmt.where(Enquiry.status == _enum(EnquiryStatus, status, "Status"))
    if source and source != "ALL":
        stmt = stmt.where(Enquiry.source == _enum(EnquirySource, source, "Source"))
    if from_date:
        stmt = stmt.where(when >= _when(from_date))
    if to_date:
        end = _when(to_date)
        if end and len(to_date) == 10:
            end = end.replace(hour=23, minute=59, second=59)
        stmt = stmt.where(when <= end)
    if due:
        stmt = stmt.where(
            Enquiry.nextFollowUpAt.is_not(None),
            Enquiry.nextFollowUpAt <= datetime.now(timezone.utc),
            Enquiry.status.notin_([EnquiryStatus.CONVERTED, EnquiryStatus.LOST]),
        )
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar() or 0
    rows = (await db.execute(stmt.offset((page - 1) * limit).limit(limit))).scalars().all()
    return {
        "data": [_public(row, user) for row in rows],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/lookup")
async def lookup_phone(phone: str = Query(...), user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    number = _phone(phone, True)
    matches = []
    guests = (await db.execute(
        select(Guest).where(Guest.phone == number, Guest.deletedAt.is_(None)).limit(5)
    )).scalars().all()
    for guest in guests:
        matches.append({"type": "guest", "id": guest.id, "name": f"{guest.firstName} {guest.lastName}".strip()})
    leads = (await db.execute(select(Lead).where(Lead.phone == number).limit(5))).scalars().all()
    for lead in leads:
        matches.append({"type": "lead", "id": lead.id, "name": lead.name})
    enquiries = (await db.execute(select(Enquiry).where(Enquiry.phone == number).limit(5))).scalars().all()
    for enquiry in enquiries:
        matches.append({"type": "enquiry", "id": enquiry.id, "name": enquiry.callerName})
    return {"matches": matches}


@router.post("")
async def create_enquiry(body: EnquiryBody, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    enquiry = Enquiry(
        callerName=(body.callerName or "").strip() or "Caller",
        phone=_phone(body.phone, True),
        enquiryType=_enum(EnquiryType, body.enquiryType, "Enquiry type"),
        source=_enum(EnquirySource, body.source, "Source"),
        callDirection=_enum(CallDirection, body.callDirection, "Call direction"),
        takenByUserId=user.id,
        status=EnquiryStatus.NEW,
        callAt=datetime.now(timezone.utc),
        adults=1,
        children=0,
    )
    _fill(enquiry, body, set(body.model_fields_set) | {"callerName", "phone", "enquiryType", "source", "callDirection"})
    if not enquiry.callAt:
        enquiry.callAt = datetime.now(timezone.utc)
    db.add(enquiry)
    await db.commit()
    enquiry = await _load(db, enquiry.id)
    return _public(enquiry, user)


@router.get("/{id}")
async def get_enquiry(id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    enquiry = await _load(db, id)
    return _public(enquiry, user, await _recordings(db, id))


@router.patch("/{id}")
async def update_enquiry(id: str, body: EnquiryPatch, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    enquiry = await _load(db, id)
    _fill(enquiry, body, set(body.model_fields_set))
    await db.commit()
    enquiry = await _load(db, id)
    return _public(enquiry, user, await _recordings(db, id))


@router.post("/{id}/guest")
async def convert_guest(id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    enquiry = await _load(db, id)
    existing = (await db.execute(
        select(Guest).where(Guest.phone == enquiry.phone, Guest.deletedAt.is_(None))
    )).scalar_one_or_none()
    created = False
    if existing:
        guest = existing
    else:
        parts = (enquiry.callerName or "Caller").strip().split(" ", 1)
        source = enquiry.source.value if hasattr(enquiry.source, "value") else str(enquiry.source)
        guest = Guest(
            firstName=parts[0] or "Caller",
            lastName=parts[1] if len(parts) > 1 else ".",
            phone=enquiry.phone,
            email=enquiry.email,
            source=_GUEST_SOURCE.get(source, GuestSource.WALK_IN),
        )
        db.add(guest)
        await db.flush()
        created = True
    enquiry.guestId = guest.id
    await db.commit()
    return {"guestId": guest.id, "created": created}


@router.post("/{id}/recordings")
async def upload_recording(
    id: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    enquiry = await _load(db, id)
    content = await file.read()
    filename, mime, _path = store_recording(content)
    row = EnquiryRecording(
        enquiryId=enquiry.id,
        filename=filename,
        originalName=(file.filename or filename)[:180],
        sizeBytes=len(content),
        mime=mime,
        uploadedByUserId=getattr(user, "id", None),
    )
    db.add(row)
    await db.flush()
    await record_audit(
        db, user_id=getattr(user, "id", None), action="UPLOAD",
        entity="EnquiryRecording", entity_id=row.id, detail=enquiry.id,
    )
    await db.commit()
    return {
        "id": row.id,
        "originalName": row.originalName,
        "sizeBytes": row.sizeBytes,
        "mime": mime,
    }


@router.get("/{id}/recordings/{recording_id}")
async def play_recording(
    id: str,
    recording_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    enquiry = await _load(db, id)
    row = await db.get(EnquiryRecording, recording_id)
    if not row or row.enquiryId != enquiry.id:
        raise HTTPException(404, "Recording not found")
    if not _can_play(user, enquiry):
        raise HTTPException(403, "You can play recordings only for calls you took")
    path = recording_path(row.filename)
    await record_audit(
        db, user_id=getattr(user, "id", None), action="PLAY",
        entity="EnquiryRecording", entity_id=row.id, detail=enquiry.id,
    )
    await db.commit()
    return FileResponse(path, media_type=row.mime, filename=row.originalName, content_disposition_type="inline")


@router.delete("/{id}/recordings/{recording_id}")
async def delete_recording(
    id: str,
    recording_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if _role(user) != "ADMIN":
        raise HTTPException(403, "Only admin can delete a recording")
    enquiry = await _load(db, id)
    row = await db.get(EnquiryRecording, recording_id)
    if not row or row.enquiryId != enquiry.id:
        raise HTTPException(404, "Recording not found")
    await record_audit(
        db, user_id=getattr(user, "id", None), action="DELETE",
        entity="EnquiryRecording", entity_id=row.id, detail=enquiry.id,
    )
    path = os_path(row.filename)
    await db.delete(row)
    await db.commit()
    if path and os_path_exists(path):
        os_remove(path)
    return {"ok": True}


def os_path(filename: str) -> str | None:
    import os
    from app.services.recordings import RECORDING_DIR, SAFE_NAME
    name = os.path.basename(filename or "")
    if not SAFE_NAME.match(name):
        return None
    return os.path.join(RECORDING_DIR, name)


def os_path_exists(path: str) -> bool:
    import os
    return os.path.isfile(path)


def os_remove(path: str) -> None:
    import os
    os.remove(path)
