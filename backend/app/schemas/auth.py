from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    isActive: bool
    createdAt: str
    updatedAt: str


class AuthResponse(BaseModel):
    user: UserResponse
    accessToken: str
    refreshToken: str
