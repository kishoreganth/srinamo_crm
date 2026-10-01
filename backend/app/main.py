from contextlib import asynccontextmanager
from decimal import Decimal
from datetime import datetime, date
import json as stdlib_json
from typing import Any
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.database import disconnect_db
import os
from fastapi.staticfiles import StaticFiles
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

_uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(_uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_uploads_dir), name="uploads")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return AppJSONResponse(status_code=500, content={"detail": str(exc)})


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "SriNamo Farms PMS"}
