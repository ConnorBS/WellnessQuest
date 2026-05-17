from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.passwords import hash_password
from app.deps import current_admin, get_db
from app.models.session import Session as RefreshSession
from app.models.user import User
from app.schemas.auth import (
    AdminPasswordResetIn,
    AdminUserCreateIn,
    AdminUserPatchIn,
    MeOut,
)
from app.services.time_utils import utcnow
from app.services.user_bootstrap import bootstrap_user_assets
from app.telemetry.recorder import audit

router = APIRouter(prefix="/admin", tags=["admin"])


def _to_me_out(user: User) -> MeOut:
    return MeOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        xp_total=user.xp_total,
        level=user.level,
        timezone=user.timezone,
        show_weight_card=user.show_weight_card,
        show_bp_card=user.show_bp_card,
        weight_unit=user.weight_unit,
        must_change_password=user.must_change_password,
        disabled=user.disabled_at is not None,
    )


async def _count_active_admins(db: AsyncSession, *, excluding: uuid.UUID | None = None) -> int:
    stmt = (
        select(func.count())
        .select_from(User)
        .where(User.role == "admin", User.disabled_at.is_(None))
    )
    if excluding is not None:
        stmt = stmt.where(User.id != excluding)
    return (await db.execute(stmt)).scalar_one()


async def _load_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user_not_found")
    return user


@router.get("/users", response_model=list[MeOut])
async def list_users(
    _admin: User = Depends(current_admin), db: AsyncSession = Depends(get_db)
) -> list[MeOut]:
    rows = (await db.execute(select(User).order_by(User.created_at))).scalars().all()
    return [_to_me_out(u) for u in rows]


@router.post("/users", response_model=MeOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: AdminUserCreateIn,
    admin: User = Depends(current_admin),
    db: AsyncSession = Depends(get_db),
) -> MeOut:
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
        role=payload.role,
        timezone=payload.timezone or "UTC",
        must_change_password=True,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="email_taken"
        ) from exc

    await bootstrap_user_assets(db, user)
    await audit(
        db,
        actor=f"user:{admin.id}",
        action="admin.user_create",
        user_id=admin.id,
        target_type="user",
        target_id=str(user.id),
        meta={"email": payload.email, "role": payload.role},
    )
    return _to_me_out(user)


@router.patch("/users/{user_id}", response_model=MeOut)
async def patch_user(
    user_id: uuid.UUID,
    payload: AdminUserPatchIn,
    admin: User = Depends(current_admin),
    db: AsyncSession = Depends(get_db),
) -> MeOut:
    user = await _load_user(db, user_id)

    changes: dict[str, object] = {}
    if payload.display_name is not None and payload.display_name != user.display_name:
        user.display_name = payload.display_name
        changes["display_name"] = payload.display_name

    if payload.role is not None and payload.role != user.role:
        if (
            user.role == "admin"
            and payload.role != "admin"
            and await _count_active_admins(db, excluding=user.id) == 0
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="last_admin"
            )
        user.role = payload.role
        changes["role"] = payload.role

    if payload.disabled is not None:
        currently_disabled = user.disabled_at is not None
        if payload.disabled and not currently_disabled:
            if user.role == "admin" and await _count_active_admins(db, excluding=user.id) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="last_admin"
                )
            user.disabled_at = utcnow()
            changes["disabled"] = True
            await db.execute(
                update(RefreshSession)
                .where(
                    RefreshSession.user_id == user.id,
                    RefreshSession.revoked_at.is_(None),
                )
                .values(revoked_at=utcnow())
            )
        elif not payload.disabled and currently_disabled:
            user.disabled_at = None
            changes["disabled"] = False

    if changes:
        await audit(
            db,
            actor=f"user:{admin.id}",
            action="admin.user_update",
            user_id=admin.id,
            target_type="user",
            target_id=str(user.id),
            meta=changes,
        )
    return _to_me_out(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disable_user(
    user_id: uuid.UUID,
    admin: User = Depends(current_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    user = await _load_user(db, user_id)
    if user.disabled_at is not None:
        return
    if user.role == "admin" and await _count_active_admins(db, excluding=user.id) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="last_admin")
    user.disabled_at = utcnow()
    await db.execute(
        update(RefreshSession)
        .where(
            RefreshSession.user_id == user.id,
            RefreshSession.revoked_at.is_(None),
        )
        .values(revoked_at=utcnow())
    )
    await audit(
        db,
        actor=f"user:{admin.id}",
        action="admin.user_disable",
        user_id=admin.id,
        target_type="user",
        target_id=str(user.id),
    )


@router.post("/users/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    user_id: uuid.UUID,
    payload: AdminPasswordResetIn,
    admin: User = Depends(current_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    user = await _load_user(db, user_id)
    user.password_hash = hash_password(payload.password)
    user.must_change_password = True
    await db.execute(
        update(RefreshSession)
        .where(
            RefreshSession.user_id == user.id,
            RefreshSession.revoked_at.is_(None),
        )
        .values(revoked_at=utcnow())
    )
    await audit(
        db,
        actor=f"user:{admin.id}",
        action="admin.password_reset",
        user_id=admin.id,
        target_type="user",
        target_id=str(user.id),
    )
