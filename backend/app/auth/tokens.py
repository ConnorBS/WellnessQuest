from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import make_access_token
from app.config import settings
from app.models.session import Session as RefreshSession
from app.models.user import User
from app.schemas.auth import TokenPair
from app.services.time_utils import utcnow


def hash_refresh(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def new_refresh_token() -> str:
    return secrets.token_urlsafe(32)


async def issue_tokens(db: AsyncSession, user: User, request: Request) -> TokenPair:
    access, exp = make_access_token(user.id, user.role)
    raw_refresh = new_refresh_token()
    refresh_session = RefreshSession(
        user_id=user.id,
        refresh_hash=hash_refresh(raw_refresh),
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
        expires_at=utcnow() + timedelta(seconds=settings.refresh_token_ttl_seconds),
    )
    db.add(refresh_session)
    await db.flush()
    return TokenPair(access_token=access, refresh_token=raw_refresh, access_expires_at=exp)
