import httpx
from fastapi import APIRouter, Depends, Query
from app.dependencies import require_admin

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.post("/test", dependencies=[Depends(require_admin)])
async def test_webhook():
    from datetime import datetime, timezone
    from app.config import get_settings
    settings = get_settings()
    url = f"{settings.N8N_WEBHOOK_BASE.rstrip('/')}/test"
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(url, json={
                "event": "test",
                "data": {"message": "Test webhook from SriNamo Farms PMS"},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }, headers={"X-Webhook-Secret": settings.N8N_WEBHOOK_SECRET} if settings.N8N_WEBHOOK_SECRET else None)
            return {"success": resp.is_success, "status": resp.status_code, "url": url}
    except Exception as e:
        return {"success": False, "error": str(e), "url": url}


@router.post("/test-whatsapp", dependencies=[Depends(require_admin)])
async def test_whatsapp(phone: str = Query(..., min_length=10)):
    from app.config import get_settings
    from app.database import get_db
    from app.services.outbox import dispatch_after_commit, enqueue_message
    from fastapi import Depends as Dep
    # Simple path: enqueue + dispatch using a short-lived session via existing get_db is awkward here.
    settings = get_settings()
    url = f"{settings.N8N_WEBHOOK_BASE.rstrip('/')}/booking-confirmed"
    headers = {"X-Webhook-Secret": settings.N8N_WEBHOOK_SECRET} if settings.N8N_WEBHOOK_SECRET else {}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json={
                "event": "booking-confirmed",
                "phone": phone,
                "guestName": "Test",
                "bookingCode": "SNF-TEST",
                "templateKey": "booking-confirmed",
            }, headers=headers)
            return {"success": resp.is_success, "status": resp.status_code, "body": resp.text[:300]}
    except Exception as e:
        return {"success": False, "error": str(e)}
