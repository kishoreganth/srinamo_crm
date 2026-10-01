import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel, EmailStr
from enum import Enum
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User
from app.dependencies import require_admin
from app.serialize import row_to_dict


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    RECEPTIONIST = "RECEPTIONIST"


class CreateUserRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None


router = APIRouter(prefix="/api/users", tags=["Users"])


@router.post("", dependencies=[Depends(require_admin)])
async def create_user(body: CreateUserRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "User with this email already exists")
    password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    user = User(name=body.name, email=body.email, passwordHash=password_hash, role=body.role)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role, "isActive": user.isActive, "createdAt": user.createdAt.isoformat() if user.createdAt else None}


@router.get("", dependencies=[Depends(require_admin)])
async def get_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.createdAt.desc()))
    users = result.scalars().all()
    return [
        {"id": u.id, "name": u.name, "email": u.email, "role": u.role, "isActive": u.isActive, "createdAt": u.createdAt.isoformat() if u.createdAt else None}
        for u in users
    ]


@router.get("/{id}", dependencies=[Depends(require_admin)])
async def get_user(id: str, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, id)
    if not user:
        raise HTTPException(404, "User not found")
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role, "isActive": user.isActive, "createdAt": user.createdAt.isoformat() if user.createdAt else None, "updatedAt": user.updatedAt.isoformat() if user.updatedAt else None}


@router.patch("/{id}", dependencies=[Depends(require_admin)])
async def update_user(id: str, body: UpdateUserRequest, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, id)
    if not user:
        raise HTTPException(404, "User not found")
    if body.name:
        user.name = body.name
    if body.email:
        user.email = body.email
    if body.role:
        user.role = body.role
    if body.password:
        user.passwordHash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    await db.commit()
    await db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role, "isActive": user.isActive}


@router.patch("/{id}/deactivate", dependencies=[Depends(require_admin)])
async def deactivate_user(id: str, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, id)
    if not user:
        raise HTTPException(404, "User not found")
    user.isActive = False
    await db.commit()
    await db.refresh(user)
    return row_to_dict(user)
