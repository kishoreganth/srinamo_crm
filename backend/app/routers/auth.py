from datetime import datetime, timedelta, timezone
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import get_settings
from app.database import get_db
from app.models import User
from app.dependencies import get_current_user
from app.schemas.auth import LoginRequest, AuthResponse, UserResponse

router = APIRouter(prefix="/api/auth", tags=["Auth"])


def _parse_expires(value: str) -> timedelta:
    num = int(value[:-1])
    unit = value[-1]
    if unit == "d":
        return timedelta(days=num)
    if unit == "h":
        return timedelta(hours=num)
    return timedelta(minutes=num)


def _create_token(user_id: str, secret: str, expires: str) -> str:
    expire = datetime.now(timezone.utc) + _parse_expires(expires)
    return jwt.encode({"sub": user_id, "exp": expire}, secret, algorithm="HS256")


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        isActive=user.isActive,
        createdAt=user.createdAt.isoformat() if user.createdAt else "",
        updatedAt=user.updatedAt.isoformat() if user.updatedAt else "",
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not bcrypt.checkpw(body.password.encode(), user.passwordHash.encode()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if not user.isActive:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    settings = get_settings()
    access_token = _create_token(user.id, settings.JWT_SECRET, settings.JWT_EXPIRES_IN)
    refresh_token = _create_token(user.id, settings.JWT_REFRESH_SECRET, settings.JWT_REFRESH_EXPIRES_IN)

    return AuthResponse(
        user=_user_response(user),
        accessToken=access_token,
        refreshToken=refresh_token,
    )


@router.get("/me", response_model=UserResponse)
async def me(user=Depends(get_current_user)):
    return _user_response(user)
