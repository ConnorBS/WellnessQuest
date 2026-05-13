from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.passwords import hash_password, verify_password
from app.auth.tokens import hash_refresh, issue_tokens
from app.deps import current_user, get_db
from app.models.session import Session as RefreshSession
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordIn,
    LoginIn,
    MeOut,
    RefreshIn,
    TokenPair,
)
from app.services.time_utils import utcnow
from app.telemetry.recorder import audit

router = APIRouter(prefix="/auth", tags=["auth"])


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
    tokens = await issue_tokens(db, user, request)
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
    refresh_hash = hash_refresh(payload.refresh_token)
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
    tokens = await issue_tokens(db, user, request)
    await audit(db, actor=f"user:{user.id}", action="auth.refresh", user_id=user.id)
    return tokens


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    payload: RefreshIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> None:
    refresh_hash = hash_refresh(payload.refresh_token)
    sess = (
        await db.execute(select(RefreshSession).where(RefreshSession.refresh_hash == refresh_hash))
    ).scalar_one_or_none()
    if sess is not None and sess.user_id == user.id and sess.revoked_at is None:
        sess.revoked_at = utcnow()
        await audit(db, actor=f"user:{user.id}", action="auth.logout", user_id=user.id)


@router.post("/change-password", response_model=TokenPair)
async def change_password(
    payload: ChangePasswordIn,
    request: Request,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> TokenPair:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials"
        )
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="password_unchanged"
        )
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    await db.execute(
        update(RefreshSession)
        .where(RefreshSession.user_id == user.id, RefreshSession.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )
    tokens = await issue_tokens(db, user, request)
    await audit(
        db,
        actor=f"user:{user.id}",
        action="auth.password_change",
        user_id=user.id,
        ip=request.client.host if request.client else None,
    )
    return tokens


def _me_out(user: User) -> MeOut:
    return MeOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        xp_total=user.xp_total,
        level=user.level,
        timezone=user.timezone,
        show_weight_card=user.show_weight_card,
        weight_unit=user.weight_unit,
        must_change_password=user.must_change_password,
    )
