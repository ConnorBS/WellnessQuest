from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.invites import hash_code
from app.auth.jwt import make_access_token
from app.auth.passwords import hash_password, verify_password
from app.config import settings
from app.deps import current_user, get_db
from app.models.invite import Invite
from app.models.session import Session as RefreshSession
from app.models.user import User
from app.schemas.auth import (
    LoginIn,
    MeOut,
    RefreshIn,
    SignupIn,
    SignupOut,
    TokenPair,
)
from app.services.time_utils import utcnow
from app.telemetry.recorder import audit

router = APIRouter(prefix="/auth", tags=["auth"])


def _hash_refresh(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _new_refresh_token() -> str:
    return secrets.token_urlsafe(32)


async def _issue_tokens(db: AsyncSession, user: User, request: Request) -> TokenPair:
    access, exp = make_access_token(user.id, user.role)
    raw_refresh = _new_refresh_token()
    refresh_session = RefreshSession(
        user_id=user.id,
        refresh_hash=_hash_refresh(raw_refresh),
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
        expires_at=utcnow() + timedelta(seconds=settings.refresh_token_ttl_seconds),
    )
    db.add(refresh_session)
    await db.flush()
    return TokenPair(access_token=access, refresh_token=raw_refresh, access_expires_at=exp)


@router.post("/signup", response_model=SignupOut, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupIn, request: Request, db: AsyncSession = Depends(get_db)) -> SignupOut:
    invite = (
        await db.execute(select(Invite).where(Invite.code_hash == hash_code(payload.invite_code)))
    ).scalar_one_or_none()
    if invite is None or invite.consumed_at is not None or invite.expires_at <= utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_invite")
    if invite.email and invite.email.lower() != payload.email.lower():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invite_email_mismatch")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
        timezone=payload.timezone or "UTC",
        role="user",
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="email_taken"
        ) from exc

    invite.consumed_at = utcnow()
    invite.consumed_by = user.id

    tokens = await _issue_tokens(db, user, request)
    await audit(
        db,
        actor=f"user:{user.id}",
        action="auth.signup",
        user_id=user.id,
        ip=request.client.host if request.client else None,
    )
    return SignupOut(user=_me_out(user), tokens=tokens)


@router.post("/login", response_model=TokenPair)
async def login(payload: LoginIn, request: Request, db: AsyncSession = Depends(get_db)) -> TokenPair:
    user = (
        await db.execute(select(User).where(User.email == payload.email))
    ).scalar_one_or_none()
    if user is None or user.disabled_at is not None or not verify_password(
        payload.password, user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials"
        )
    tokens = await _issue_tokens(db, user, request)
    await audit(
        db,
        actor=f"user:{user.id}",
        action="auth.login",
        user_id=user.id,
        ip=request.client.host if request.client else None,
    )
    return tokens


@router.post("/refresh", response_model=TokenPair)
async def refresh(
    payload: RefreshIn, request: Request, db: AsyncSession = Depends(get_db)
) -> TokenPair:
    refresh_hash = _hash_refresh(payload.refresh_token)
    sess = (
        await db.execute(select(RefreshSession).where(RefreshSession.refresh_hash == refresh_hash))
    ).scalar_one_or_none()
    if sess is None or sess.revoked_at is not None or sess.expires_at <= utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_refresh"
        )
    user = (
        await db.execute(select(User).where(User.id == sess.user_id))
    ).scalar_one_or_none()
    if user is None or user.disabled_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user_inactive")

    sess.revoked_at = utcnow()
    tokens = await _issue_tokens(db, user, request)
    await audit(db, actor=f"user:{user.id}", action="auth.refresh", user_id=user.id)
    return tokens


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    payload: RefreshIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> None:
    refresh_hash = _hash_refresh(payload.refresh_token)
    sess = (
        await db.execute(select(RefreshSession).where(RefreshSession.refresh_hash == refresh_hash))
    ).scalar_one_or_none()
    if sess is not None and sess.user_id == user.id and sess.revoked_at is None:
        sess.revoked_at = utcnow()
        await audit(db, actor=f"user:{user.id}", action="auth.logout", user_id=user.id)


def _me_out(user: User) -> MeOut:
    return MeOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        xp_total=user.xp_total,
        level=user.level,
        timezone=user.timezone,
    )
