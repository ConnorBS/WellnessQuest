from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.title import TitleSummary


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=200)


class RefreshIn(BaseModel):
    refresh_token: str = Field(..., min_length=16)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    access_expires_at: datetime
    token_type: str = "Bearer"  # noqa: S105 - OAuth token type literal, not a secret


class MeOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    display_name: str
    role: str
    xp_total: int
    level: int
    timezone: str
    show_weight_card: bool = True
    show_bp_card: bool = True
    weight_unit: str = "kg"
    must_change_password: bool = False
    disabled: bool = False
    equipped_title: TitleSummary | None = None
    title_hidden: bool = False
    weight_titles_opt_out: bool = False
    bp_titles_opt_out: bool = False
    show_raw_weight_delta: bool = False
    pending_title_unlocks: list[TitleSummary] = Field(default_factory=list)
    # True count of un-acknowledged unlocks. `pending_title_unlocks` is
    # capped at PENDING_UNLOCKS_LIMIT (5) so the popup can show one at a
    # time, but the UI needs the real total to label "Accept all (N)"
    # correctly — otherwise after a catalog rollout with 100 retroactive
    # unlocks the count looks frozen at 5.
    pending_title_unlocks_total: int = 0


class MePatchIn(BaseModel):
    show_weight_card: bool | None = None
    show_bp_card: bool | None = None
    weight_unit: str | None = None
    title_hidden: bool | None = None
    weight_titles_opt_out: bool | None = None
    bp_titles_opt_out: bool | None = None
    show_raw_weight_delta: bool | None = None


class SetupStatusOut(BaseModel):
    setup_required: bool


class SetupAdminIn(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=10, max_length=200)
    display_name: str = Field(..., min_length=1, max_length=120)
    timezone: str = "UTC"


class AuthOut(BaseModel):
    """Combined user + tokens response used by setup and (future) login flows."""

    user: MeOut
    tokens: TokenPair


class ChangePasswordIn(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=200)
    new_password: str = Field(..., min_length=10, max_length=200)


class AdminUserCreateIn(BaseModel):
    email: EmailStr
    display_name: str = Field(..., min_length=1, max_length=120)
    password: str = Field(..., min_length=10, max_length=200)
    role: str = Field(default="user", pattern="^(admin|user)$")
    timezone: str = "UTC"


class AdminUserPatchIn(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    role: str | None = Field(default=None, pattern="^(admin|user)$")
    disabled: bool | None = None


class AdminPasswordResetIn(BaseModel):
    password: str = Field(..., min_length=10, max_length=200)
