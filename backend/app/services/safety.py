"""Startup checks and a small in-process rate limit. No threads."""

import asyncio
import os
import time

from fastapi import HTTPException

DEFAULT_JWT_SECRETS = {
    "change-me-to-a-long-random-string-min-32-chars",
    "another-long-random-string-min-32-chars",
}

_lock = asyncio.Lock()
_buckets: dict[str, list[float]] = {}


def assert_production_secrets(node_env: str | None, jwt_secret: str) -> None:
    if (node_env or "").lower() != "production":
        return
    if jwt_secret in DEFAULT_JWT_SECRETS or jwt_secret.startswith("change-me"):
        raise RuntimeError("Refusing to start: set JWT_SECRET before NODE_ENV=production")


async def rate_limit(key: str, limit: int, window_seconds: float) -> None:
    now = time.monotonic()
    async with _lock:
        recent = [stamp for stamp in _buckets.get(key, []) if now - stamp < window_seconds]
        if len(recent) >= limit:
            _buckets[key] = recent
            raise HTTPException(429, "Too many requests. Try again in a minute.")
        recent.append(now)
        _buckets[key] = recent


def client_ip(request) -> str:
    forwarded = request.headers.get("x-forwarded-for") if request else None
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request and request.client:
        return request.client.host
    return "unknown"


def node_env() -> str:
    return os.getenv("NODE_ENV", "development")
