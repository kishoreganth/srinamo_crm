from contextlib import asynccontextmanager
from decimal import Decimal
from datetime import datetime, date
import json as stdlib_json
from typing import Any
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.database import disconnect_db, get_db
from app.dependencies import get_current_user
from app.routers.upload import download_id_document
from app.services.safety import assert_production_secrets, node_env
from app.config import get_settings
from app.routers import (
    auth,
    rooms,
    room_types,
    guests,
    bookings,
    pricing,
    billing,
    restaurant,
    housekeeping,
    activities,
    amenities,
    packages,
    reports,
    notifications,
    users,
    upload,
    leads,
    partners,
    events,
    actions,
    inventory,
    webhooks,
    ical,
    feedback,
    enquiries,
)


class AppJSONResponse(JSONResponse):
    def render(self, content: Any) -> bytes:
        return stdlib_json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            default=self._default,
        ).encode("utf-8")

    @staticmethod
    def _default(obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


@asynccontextmanager
async def lifespan(app: FastAPI):
    assert_production_secrets(node_env(), get_settings().JWT_SECRET)
    yield
    await disconnect_db()


app = FastAPI(
    title="SriNamo Farms PMS API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
    default_response_class=AppJSONResponse,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(rooms.router)
app.include_router(room_types.router)
app.include_router(guests.router)
app.include_router(bookings.router)
app.include_router(pricing.router)
app.include_router(billing.router)
app.include_router(restaurant.router)
app.include_router(housekeeping.router)
app.include_router(activities.router)
app.include_router(amenities.router)
app.include_router(packages.router)
app.include_router(reports.router)
app.include_router(notifications.router)
app.include_router(users.router)
app.include_router(upload.router)
app.include_router(leads.router)
app.include_router(partners.router)
app.include_router(events.router)
app.include_router(actions.router)
app.include_router(inventory.router)
app.include_router(webhooks.router)
app.include_router(ical.router)
app.include_router(feedback.router)
app.include_router(enquiries.router)


@app.get("/uploads/id-documents/{filename}")
async def legacy_id_download(filename: str, user=Depends(get_current_user), db=Depends(get_db)):
    return await download_id_document(filename, user, db)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    from fastapi import HTTPException
    from starlette.exceptions import HTTPException as StarletteHTTPException
    if isinstance(exc, (HTTPException, StarletteHTTPException)):
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
        return AppJSONResponse(status_code=exc.status_code, content={"detail": detail})
    import traceback
    traceback.print_exc()
    return AppJSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "SriNamo Farms PMS"}
