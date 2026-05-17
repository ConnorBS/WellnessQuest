from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.user import User
from app.schemas.auth import MeOut, MePatchIn
from app.telemetry.recorder import audit

router = APIRouter(tags=["users"])


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
    )


@router.get("/me", response_model=MeOut)
async def get_me(user: User = Depends(current_user)) -> MeOut:
    return _to_me_out(user)


@router.patch("/me", response_model=MeOut)
async def patch_me(
    payload: MePatchIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> MeOut:
    if payload.show_weight_card is not None:
        user.show_weight_card = payload.show_weight_card
    if payload.show_bp_card is not None:
        user.show_bp_card = payload.show_bp_card
    if payload.weight_unit is not None:
        if payload.weight_unit not in ("kg", "lb"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="weight_unit must be 'kg' or 'lb'",
            )
        user.weight_unit = payload.weight_unit
    await db.flush()
    await audit(
        db,
        actor=f"user:{user.id}",
        action="user.preferences.update",
        user_id=user.id,
        meta=payload.model_dump(exclude_none=True),
    )
    return _to_me_out(user)
