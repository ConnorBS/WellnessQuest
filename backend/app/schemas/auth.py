from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class SignupIn(BaseModel):
    invite_code: str = Field(..., min_length=8)
    email: EmailStr
    password: str = Field(..., min_length=10, max_length=200)
    display_name: str = Field(..., min_length=1, max_length=120)
    timezone: str = "UTC"


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=200)


class RefreshIn(BaseModel):
    refresh_token: str = Field(..., min_length=16)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    access_expires_at: datetime
    token_type: str = "Bearer"


class MeOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    display_name: str
    role: str
    xp_total: int
    level: int
    timezone: str
    show_weight_card: bool = True
    weight_unit: str = "kg"


class MePatchIn(BaseModel):
    show_weight_card: bool | None = None
    weight_unit: str | None = None


class SignupOut(BaseModel):
    user: MeOut
    tokens: TokenPair


class InviteCreateOut(BaseModel):
    code: str
    expires_at: datetime
