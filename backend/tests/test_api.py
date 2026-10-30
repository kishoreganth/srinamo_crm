import asyncio
import uuid

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
async def client():
    from app.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        yield http


@pytest.fixture(autouse=True)
def _clear_login_limit():
    from app.services.safety import _buckets
    _buckets.clear()
    yield


async def _login(client: AsyncClient) -> dict:
    res = await client.post("/api/auth/login", json={"email": "admin@srinamo.com", "password": "admin123"})
    if res.status_code != 200:
        pytest.skip(f"seeded admin login is not available ({res.status_code})")
    return {"Authorization": f"Bearer {res.json()['accessToken']}"}


async def test_login_and_bad_password(client):
    bad = await client.post("/api/auth/login", json={"email": "admin@srinamo.com", "password": "wrong-password"})
    assert bad.status_code == 401
    ok = await client.post("/api/auth/login", json={"email": "admin@srinamo.com", "password": "admin123"})
    if ok.status_code != 200:
        pytest.skip("seeded admin is not in this database")
    assert "accessToken" in ok.json()


async def _stay(client, headers, room_id, package_id, adults, when):
    guest = await client.post("/api/guests", headers=headers, json={
        "firstName": "Folio",
        "lastName": "Test",
        "phone": f"9198{uuid.uuid4().int % 10**8:08d}",
    })
    assert guest.status_code in (200, 201), guest.text
    booking = await client.post("/api/bookings", headers=headers, json={
        "guestId": guest.json()["id"],
        "roomId": room_id,
        "packageId": package_id,
        "checkIn": f"{when}T10:00:00",
        "checkOut": f"{when}T18:00:00",
        "adults": adults,
        "source": "WALK_IN",
    })
    return booking


async def test_two_guest_package_total_and_invoice_numbers(client):
    headers = await _login(client)
    packages = (await client.get("/api/packages", headers=headers)).json()
    package = next((row for row in packages if row.get("isActive", True)), None)
    types = await client.get("/api/room-types", headers=headers)
    assert types.status_code == 200 and types.json(), types.text
    room_type_id = types.json()[0]["id"]
    number = f"T{uuid.uuid4().hex[:6]}"
    room = await client.post("/api/rooms", headers=headers, json={"roomTypeId": room_type_id, "roomNumber": number, "floor": 9})
    assert room.status_code in (200, 201), room.text
    booking = await _stay(client, headers, room.json()["id"], package["id"], 2, "2027-08-01")
    assert booking.status_code in (200, 201), booking.text
    booking_id = booking.json()["id"]
    summary = await client.get(f"/api/billing/summary/{booking_id}", headers=headers)
    price = float(package["pricePerPerson"])
    assert summary.json()["totalCharges"] == pytest.approx(price * 2)
    first = await client.post(f"/api/billing/invoices/{booking_id}", headers=headers, json={"isGstInvoice": True})
    second = await client.post(f"/api/billing/invoices/{booking_id}", headers=headers, json={"isGstInvoice": True})
    assert first.status_code in (200, 201), first.text
    assert second.status_code in (200, 201), second.text
    assert first.json()["invoiceNumber"] != second.json()["invoiceNumber"]
    from app.config import get_settings
    half_rate = float(get_settings().GST_TOTAL_PERCENT or 0) / 100 / 2
    assert first.json()["cgst"] == pytest.approx(price * 2 * half_rate)
    assert first.json()["sgst"] == pytest.approx(price * 2 * half_rate)
    pay = await client.post("/api/billing/payments", headers=headers, json={
        "bookingId": booking_id, "amount": 100, "method": "CASH", "transactionId": "TEST-PAY",
    })
    assert pay.status_code in (200, 201), pay.text
    after = await client.get(f"/api/billing/summary/{booking_id}", headers=headers)
    assert after.json()["totalPaid"] == pytest.approx(100)


async def test_parallel_booking_one_conflict(client):
    headers = await _login(client)
    packages = (await client.get("/api/packages", headers=headers)).json()
    package = packages[0]
    types = (await client.get("/api/room-types", headers=headers)).json()
    number = f"O{uuid.uuid4().hex[:6]}"
    room = await client.post("/api/rooms", headers=headers, json={"roomTypeId": types[0]["id"], "roomNumber": number, "floor": 9})
    assert room.status_code in (200, 201), room.text
    room_id = room.json()["id"]

    async def once():
        return await _stay(client, headers, room_id, package["id"], 1, "2027-09-02")

    first, second = await asyncio.gather(once(), once())
    statuses = sorted([first.status_code, second.status_code])
    assert statuses == [201, 409] or statuses == [200, 409]


async def _reception(client: AsyncClient) -> dict:
    res = await client.post("/api/auth/login", json={"email": "reception@srinamo.com", "password": "reception123"})
    if res.status_code != 200:
        pytest.skip("seeded reception login is not available")
    return {"Authorization": f"Bearer {res.json()['accessToken']}"}


async def test_reception_dashboard_omits_revenue(client):
    rec = await _reception(client)
    dash = await client.get("/api/reports/dashboard", headers=rec)
    assert dash.status_code == 200, dash.text
    body = dash.json()
    assert "revenueToday" not in body
    assert "revenueWeek" not in body
    assert "revenueMonth" not in body
    assert "bookingsToday" in body
    revenue = await client.get("/api/reports/revenue", headers=rec, params={"from": "2027-01-01", "to": "2027-12-31"})
    assert revenue.status_code == 403
    admin = await _login(client)
    admin_dash = await client.get("/api/reports/dashboard", headers=admin)
    assert admin_dash.status_code == 200
    assert "revenueToday" in admin_dash.json()


async def test_reception_cannot_view_id_after_booking_saved(client):
    admin = await _login(client)
    rec = await _reception(client)
    jpeg = b"\xff\xd8\xff" + b"\x00" * 32
    uploaded = await client.post(
        "/api/upload/id-document",
        headers=rec,
        files={"file": ("id.jpg", jpeg, "image/jpeg")},
    )
    assert uploaded.status_code in (200, 201), uploaded.text
    filename = uploaded.json()["filename"]
    url = uploaded.json()["url"]
    draft = await client.get(f"/api/upload/id-document/{filename}", headers=rec)
    assert draft.status_code == 200
    packages = (await client.get("/api/packages", headers=admin)).json()
    types = (await client.get("/api/room-types", headers=admin)).json()
    room = await client.post("/api/rooms", headers=admin, json={"roomTypeId": types[0]["id"], "roomNumber": f"I{uuid.uuid4().hex[:6]}", "floor": 9})
    guest = await client.post("/api/guests", headers=rec, json={
        "firstName": "Id",
        "lastName": "Lock",
        "phone": f"9197{uuid.uuid4().int % 10**8:08d}",
    })
    assert guest.status_code in (200, 201), guest.text
    patched = await client.patch(f"/api/guests/{guest.json()['id']}", headers=rec, json={"idDocumentUrl": url})
    assert patched.status_code == 200, patched.text
    booking = await client.post("/api/bookings", headers=rec, json={
        "guestId": guest.json()["id"],
        "roomId": room.json()["id"],
        "packageId": packages[0]["id"],
        "checkIn": "2027-10-01T10:00:00",
        "checkOut": "2027-10-01T18:00:00",
        "adults": 1,
        "source": "WALK_IN",
    })
    assert booking.status_code in (200, 201), booking.text
    blocked = await client.get(f"/api/upload/id-document/{filename}", headers=rec)
    assert blocked.status_code == 403
    delete = await client.delete(f"/api/upload/id-document/{filename}", headers=rec)
    assert delete.status_code == 403
    admin_view = await client.get(f"/api/upload/id-document/{filename}", headers=admin)
    assert admin_view.status_code == 200


async def test_bookings_list_overlap_and_meta(client):
    headers = await _login(client)
    packages = (await client.get("/api/packages", headers=headers)).json()
    types = (await client.get("/api/room-types", headers=headers)).json()
    room = await client.post("/api/rooms", headers=headers, json={"roomTypeId": types[0]["id"], "roomNumber": f"L{uuid.uuid4().hex[:6]}", "floor": 9})
    booking = await _stay(client, headers, room.json()["id"], packages[0]["id"], 1, "2027-11-10")
    assert booking.status_code in (200, 201), booking.text
    listing = await client.get("/api/bookings", headers=headers, params={"from": "2027-11-09", "to": "2027-11-11", "limit": 20, "page": 1})
    assert listing.status_code == 200, listing.text
    body = listing.json()
    assert "meta" in body
    assert body["meta"]["total"] >= 1
    assert body["meta"]["page"] == 1
    ids = [row["id"] for row in body["data"]]
    assert booking.json()["id"] in ids


async def test_guest_search_query(client):
    headers = await _login(client)
    marker = f"Srch{uuid.uuid4().hex[:6]}"
    created = await client.post("/api/guests", headers=headers, json={
        "firstName": marker,
        "lastName": "Guest",
        "phone": f"9196{uuid.uuid4().int % 10**8:08d}",
    })
    assert created.status_code in (200, 201), created.text
    found = await client.get("/api/guests/search", headers=headers, params={"q": marker})
    assert found.status_code == 200, found.text
    names = [row["firstName"] for row in found.json()]
    assert marker in names


async def test_housekeeping_create_task_type(client):
    headers = await _login(client)
    types = (await client.get("/api/room-types", headers=headers)).json()
    room = await client.post("/api/rooms", headers=headers, json={"roomTypeId": types[0]["id"], "roomNumber": f"H{uuid.uuid4().hex[:6]}", "floor": 9})
    assert room.status_code in (200, 201), room.text
    bad = await client.post("/api/housekeeping/tasks", headers=headers, json={
        "roomId": room.json()["id"], "type": "CLEANING", "priority": "HIGH",
    })
    assert bad.status_code == 422
    ok = await client.post("/api/housekeeping/tasks", headers=headers, json={
        "roomId": room.json()["id"], "taskType": "CLEANING", "notes": "pytest",
    })
    assert ok.status_code in (200, 201), ok.text
    assert ok.json()["taskType"] == "CLEANING"
    listed = await client.get("/api/housekeeping/tasks", headers=headers, params={"status": "PENDING"})
    assert listed.status_code == 200
    assert any(row["id"] == ok.json()["id"] for row in listed.json())


async def _review_asks(client, headers, booking_id: str) -> list:
    res = await client.get(
        "/api/actions/messages",
        headers=headers,
        params={"relatedType": "BOOKING", "relatedId": booking_id},
    )
    assert res.status_code == 200, res.text
    return [row for row in res.json() if row.get("templateKey") == "review-ask"]


async def _mark_checked_out(booking_id: str) -> None:
    from app.database import async_session
    from app.models import Booking, BookingStatus

    async with async_session() as session:
        row = await session.get(Booking, booking_id)
        assert row is not None
        row.status = BookingStatus.CHECKED_OUT
        await session.commit()


async def _blank_phone(guest_id: str) -> None:
    from app.database import async_session
    from app.models import Guest

    async with async_session() as session:
        row = await session.get(Guest, guest_id)
        assert row is not None
        row.phone = ""
        await session.commit()


async def _room_and_package(client, headers):
    packages = (await client.get("/api/packages", headers=headers)).json()
    package = next((row for row in packages if row.get("isActive", True)), None)
    assert package, "need an active day package"
    types = (await client.get("/api/room-types", headers=headers)).json()
    assert types
    number = f"R{uuid.uuid4().hex[:6]}"
    room = await client.post(
        "/api/rooms",
        headers=headers,
        json={"roomTypeId": types[0]["id"], "roomNumber": number, "floor": 8},
    )
    assert room.status_code in (200, 201), room.text
    return room.json()["id"], package["id"]


async def test_review_bulk_checked_out_dedupe_force_and_skips(client):
    admin = await _login(client)
    reception = await _reception(client)
    day = 11

    async def stay(**guest_extra):
        nonlocal day
        day += 1
        room_id, package_id = await _room_and_package(client, admin)
        phone = guest_extra.pop("phone", f"9197{uuid.uuid4().int % 10**8:08d}")
        guest = await client.post("/api/guests", headers=admin, json={
            "firstName": "Review",
            "lastName": f"T{day}",
            "phone": phone,
            **guest_extra,
        })
        assert guest.status_code in (200, 201), guest.text
        booking = await client.post("/api/bookings", headers=admin, json={
            "guestId": guest.json()["id"],
            "roomId": room_id,
            "packageId": package_id,
            "checkIn": f"2027-10-{day:02d}T10:00:00",
            "checkOut": f"2027-10-{day:02d}T18:00:00",
            "adults": 1,
            "source": "WALK_IN",
        })
        assert booking.status_code in (200, 201), booking.text
        return guest.json()["id"], booking.json()["id"]

    _, checked_id = await stay()
    _, confirmed_id = await stay()
    await _mark_checked_out(checked_id)

    denied = await client.post(
        "/api/actions/bookings/review-bulk",
        headers=reception,
        json={"ids": [checked_id], "force": True},
    )
    assert denied.status_code == 403, denied.text
    assert await _review_asks(client, admin, checked_id) == []

    first = await client.post(
        "/api/actions/bookings/review-bulk",
        headers=admin,
        json={"ids": [checked_id, confirmed_id]},
    )
    assert first.status_code == 200, first.text
    by_id = {row["id"]: row for row in first.json()["results"]}
    assert by_id[checked_id]["outcome"] == "queued"
    assert by_id[checked_id]["status"] in ("PENDING", "SENT", "SKIPPED")
    assert by_id[confirmed_id]["outcome"] == "skipped"
    assert by_id[confirmed_id]["reason"] == "not_checked_out"
    assert len(await _review_asks(client, admin, checked_id)) == 1
    assert await _review_asks(client, admin, confirmed_id) == []

    second = await client.post(
        "/api/actions/bookings/review-bulk",
        headers=admin,
        json={"ids": [checked_id]},
    )
    assert second.status_code == 200, second.text
    assert second.json()["results"][0]["outcome"] == "skipped"
    assert second.json()["results"][0]["reason"] == "already_asked"
    assert len(await _review_asks(client, admin, checked_id)) == 1

    resent = await client.post(
        "/api/actions/bookings/review-bulk",
        headers=admin,
        json={"ids": [checked_id], "force": True},
    )
    assert resent.status_code == 200, resent.text
    assert resent.json()["results"][0]["outcome"] == "queued"
    asks = await _review_asks(client, admin, checked_id)
    assert len(asks) == 2
    assert len({row["idempotencyKey"] for row in asks}) == 2

    no_phone_guest, no_phone_id = await stay()
    consent_guest, consent_id = await stay(whatsappConsent=False)
    dnd_guest, dnd_id = await stay()
    await _mark_checked_out(no_phone_id)
    await _mark_checked_out(consent_id)
    await _mark_checked_out(dnd_id)
    await _blank_phone(no_phone_guest)
    patched = await client.patch(f"/api/guests/{dnd_guest}", headers=admin, json={"dnd": True})
    assert patched.status_code == 200, patched.text

    skipped = await client.post(
        "/api/actions/bookings/review-bulk",
        headers=admin,
        json={"ids": [no_phone_id, consent_id, dnd_id]},
    )
    assert skipped.status_code == 200, skipped.text
    reasons = {row["id"]: row for row in skipped.json()["results"]}
    assert reasons[no_phone_id]["outcome"] == "skipped"
    assert reasons[no_phone_id]["reason"] == "no_phone"
    assert reasons[consent_id]["reason"] == "no_consent"
    assert reasons[dnd_id]["reason"] == "dnd"
    assert await _review_asks(client, admin, no_phone_id) == []
    assert await _review_asks(client, admin, consent_id) == []
    assert await _review_asks(client, admin, dnd_id) == []


def _wav_bytes() -> bytes:
    import struct
    pcm = b"\x00\x00" * 8
    fmt = struct.pack("<HHIIHH", 1, 1, 8000, 16000, 2, 16)
    body = b"fmt " + struct.pack("<I", 16) + fmt + b"data" + struct.pack("<I", len(pcm)) + pcm
    return b"RIFF" + struct.pack("<I", 4 + len(body)) + b"WAVE" + body


async def test_enquiries_crud_roles_and_recordings(client):
    open_call = await client.get("/api/enquiries")
    assert open_call.status_code == 401

    admin_login = await client.post("/api/auth/login", json={"email": "admin@srinamo.com", "password": "admin123"})
    rec_login = await client.post("/api/auth/login", json={"email": "reception@srinamo.com", "password": "reception123"})
    if admin_login.status_code != 200 or rec_login.status_code != 200:
        pytest.skip("seeded staff logins are not available")
    admin = {"Authorization": f"Bearer {admin_login.json()['accessToken']}"}
    reception = {"Authorization": f"Bearer {rec_login.json()['accessToken']}"}
    admin_id = admin_login.json()["user"]["id"]
    reception_id = rec_login.json()["user"]["id"]

    phone = f"9196{uuid.uuid4().int % 10**8:08d}"
    bad = await client.post("/api/enquiries", headers=reception, json={"callerName": "No Phone", "phone": "12"})
    assert bad.status_code == 400, bad.text

    created = await client.post("/api/enquiries", headers=reception, json={
        "callerName": "Call Test",
        "phone": phone,
        "enquiryType": "ROOM_STAY",
        "source": "PHONE",
        "adults": 2,
        "children": 1,
        "callDirection": "INCOMING",
        "notes": "Asked about a cottage",
    })
    assert created.status_code in (200, 201), created.text
    enquiry = created.json()
    assert enquiry["takenByUserId"] == reception_id
    assert enquiry["status"] == "NEW"
    enquiry_id = enquiry["id"]

    listed = await client.get("/api/enquiries", headers=admin, params={"q": "Call Test", "status": "NEW"})
    assert listed.status_code == 200, listed.text
    assert any(row["id"] == enquiry_id for row in listed.json()["data"])

    guest = await client.post("/api/guests", headers=admin, json={
        "firstName": "Known",
        "lastName": "Caller",
        "phone": phone,
    })
    assert guest.status_code in (200, 201), guest.text
    lookup = await client.get("/api/enquiries/lookup", headers=reception, params={"phone": phone})
    assert lookup.status_code == 200, lookup.text
    types = {row["type"] for row in lookup.json()["matches"]}
    assert "guest" in types and "enquiry" in types

    other_phone = f"9195{uuid.uuid4().int % 10**8:08d}"
    fresh = await client.post("/api/enquiries", headers=admin, json={
        "callerName": "Fresh Caller",
        "phone": other_phone,
        "enquiryType": "DAY_OUTING",
        "source": "WHATSAPP",
    })
    assert fresh.status_code in (200, 201), fresh.text
    assert fresh.json()["takenByUserId"] == admin_id
    converted = await client.post(f"/api/enquiries/{fresh.json()['id']}/guest", headers=admin)
    assert converted.status_code == 200, converted.text
    assert converted.json()["created"] is True
    again = await client.post(f"/api/enquiries/{fresh.json()['id']}/guest", headers=reception)
    assert again.status_code == 200, again.text
    assert again.json()["created"] is False
    assert again.json()["guestId"] == converted.json()["guestId"]

    own = await client.post(
        f"/api/enquiries/{enquiry_id}/recordings",
        headers=reception,
        files={"file": ("call.wav", _wav_bytes(), "application/octet-stream")},
    )
    assert own.status_code in (200, 201), own.text
    own_id = own.json()["id"]
    play_own = await client.get(f"/api/enquiries/{enquiry_id}/recordings/{own_id}", headers=reception)
    assert play_own.status_code == 200, play_own.text
    assert play_own.content.startswith(b"RIFF")
    admin_play = await client.get(f"/api/enquiries/{enquiry_id}/recordings/{own_id}", headers=admin)
    assert admin_play.status_code == 200

    fake = await client.post(
        f"/api/enquiries/{enquiry_id}/recordings",
        headers=admin,
        files={"file": ("call.mp3", b"\xff\xd8\xff" + b"\x00" * 16, "audio/mpeg")},
    )
    assert fake.status_code == 400, fake.text

    from app.config import get_settings
    settings = get_settings()
    previous = settings.CALL_RECORDING_MAX_BYTES
    settings.CALL_RECORDING_MAX_BYTES = 8
    try:
        huge = await client.post(
            f"/api/enquiries/{enquiry_id}/recordings",
            headers=admin,
            files={"file": ("big.wav", _wav_bytes(), "audio/wav")},
        )
        assert huge.status_code == 400, huge.text
    finally:
        settings.CALL_RECORDING_MAX_BYTES = previous

    blocked = await client.get(f"/api/enquiries/{fresh.json()['id']}/recordings/{own_id}", headers=reception)
    assert blocked.status_code in (403, 404)

    admin_rec = await client.post(
        f"/api/enquiries/{fresh.json()['id']}/recordings",
        headers=admin,
        files={"file": ("desk.wav", _wav_bytes(), "audio/wav")},
    )
    assert admin_rec.status_code in (200, 201), admin_rec.text
    denied = await client.get(
        f"/api/enquiries/{fresh.json()['id']}/recordings/{admin_rec.json()['id']}",
        headers=reception,
    )
    assert denied.status_code == 403, denied.text
    no_token = await client.get(f"/api/enquiries/{fresh.json()['id']}/recordings/{admin_rec.json()['id']}")
    assert no_token.status_code == 401

    rec_delete = await client.delete(
        f"/api/enquiries/{enquiry_id}/recordings/{own_id}",
        headers=reception,
    )
    assert rec_delete.status_code == 403
    removed = await client.delete(
        f"/api/enquiries/{enquiry_id}/recordings/{own_id}",
        headers=admin,
    )
    assert removed.status_code == 200, removed.text
    gone = await client.get(f"/api/enquiries/{enquiry_id}/recordings/{own_id}", headers=admin)
    assert gone.status_code == 404

    from app.database import async_session
    from app.models import AuditEvent
    from sqlalchemy import select
    async with async_session() as session:
        rows = (await session.execute(
            select(AuditEvent).where(AuditEvent.entity == "EnquiryRecording", AuditEvent.entityId == own_id)
        )).scalars().all()
    actions = {row.action for row in rows}
    assert {"UPLOAD", "PLAY", "DELETE"} <= actions


async def test_resort_profile_admin_only(client):
    open_call = await client.get("/api/settings/resort")
    assert open_call.status_code == 401

    reception = await _reception(client)
    denied = await client.get("/api/settings/resort", headers=reception)
    assert denied.status_code == 403

    admin = await _login(client)
    before = await client.get("/api/settings/resort", headers=admin)
    assert before.status_code == 200, before.text
    assert before.json()["name"] == "SriNamo Farms Resort"
    assert before.json()["gstin"] == ""
    assert before.json()["address"] == ""
    assert before.json()["phone"] == ""
    assert before.json()["email"] == ""

    saved = await client.put("/api/settings/resort", headers=admin, json={
        "name": "Lake House",
        "gstin": "22AAAAA0000A1Z5",
        "address": "Farm road",
        "phone": "919800000000",
        "email": "desk@example.com",
    })
    assert saved.status_code == 200, saved.text
    again = await client.get("/api/settings/resort", headers=admin)
    assert again.json()["name"] == "Lake House"
    assert again.json()["gstin"] == "22AAAAA0000A1Z5"
    assert again.json()["address"] == "Farm road"
    assert again.json()["phone"] == "919800000000"
    assert again.json()["email"] == "desk@example.com"

    blank = await client.put("/api/settings/resort", headers=admin, json={"name": "  "})
    assert blank.status_code == 400

    restored = await client.put("/api/settings/resort", headers=admin, json={
        "name": "SriNamo Farms Resort",
        "gstin": "",
        "address": "",
        "phone": "",
        "email": "",
    })
    assert restored.status_code == 200, restored.text
    final = await client.get("/api/settings/resort", headers=admin)
    assert final.json()["name"] == "SriNamo Farms Resort"
    assert final.json()["email"] == ""
