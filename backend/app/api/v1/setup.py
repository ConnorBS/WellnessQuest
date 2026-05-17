"""First-run setup: create the very first admin when the database is empty.

Public endpoints — gated by "no active admin exists". Once an admin is in place
the create endpoint returns 409 and the only way to add more users is the
authenticated admin user-management API.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.passwords import hash_password
from app.auth.tokens import issue_tokens
from app.deps import get_db
from app.models.user import User
from app.schemas.auth import AuthOut, MeOut, SetupAdminIn, SetupStatusOut
from app.services.user_bootstrap import bootstrap_user_assets
from app.telemetry.recorder import audit

# Fixed key for pg_advisory_xact_lock; serialises concurrent setup attempts so
# only one connection can run the "no admin yet → create admin" check at a time.
_SETUP_LOCK_KEY = 7427183091020001


router = APIRouter(prefix="/setup", tags=["setup"])


async def _has_active_admin(db: AsyncSession) -> bool:
    count = (
        await db.execute(
            select(func.count()).select_from(User).where(
                User.role == "admin", User.disabled_at.is_(None)
            )
        )
    ).scalar_one()
    return count > 0


@router.get("/status", response_model=SetupStatusOut)
async def setup_status(db: AsyncSession = Depends(get_db)) -> SetupStatusOut:
    return SetupStatusOut(setup_required=not await _has_active_admin(db))


@router.post("/admin", response_model=AuthOut, status_code=status.HTTP_201_CREATED)
async def setup_admin(
    payload: SetupAdminIn, request: Request, db: AsyncSession = Depends(get_db)
) -> AuthOut:
    await db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _SETUP_LOCK_KEY})

    if await _has_active_admin(db):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="setup_already_complete"
        )

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
        role="admin",
        timezone=payload.timezone or "UTC",
        must_change_password=False,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="email_taken"
        ) from exc

    await bootstrap_user_assets(db, user)
    tokens = await issue_tokens(db, user, request)
    await audit(
        db,
        actor=f"user:{user.id}",
        action="setup.complete",
        user_id=user.id,
        ip=request.client.host if request.client else None,
    )
    return AuthOut(
        user=MeOut(
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
        ),
        tokens=tokens,
    )
