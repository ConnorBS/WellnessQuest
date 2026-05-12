from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.activity_preset import ActivityPreset
from app.models.user import User
from app.schemas.activity_preset import ActivityPresetIn, ActivityPresetOut
from app.services.time_utils import utcnow
from app.telemetry.recorder import audit

router = APIRouter(prefix="/activity/presets", tags=["activity"])


def _to_out(p: ActivityPreset) -> ActivityPresetOut:
    return ActivityPresetOut(
        id=p.id,
        label=p.label,
        minutes=p.minutes,
        exercise_type=p.exercise_type,
        icon_kind=p.icon_kind,  # type: ignore[arg-type]
        icon_key=p.icon_key,
        sort_order=p.sort_order,
    )


async def _get_owned(
    db: AsyncSession, *, user: User, preset_id: uuid.UUID
) -> ActivityPreset:
    row = (
        await db.execute(
            select(ActivityPreset).where(
                ActivityPreset.id == preset_id, ActivityPreset.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    return row


@router.get("", response_model=list[ActivityPresetOut])
async def list_presets(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> list[ActivityPresetOut]:
    stmt = (
        select(ActivityPreset)
        .where(ActivityPreset.user_id == user.id)
        .order_by(ActivityPreset.sort_order, ActivityPreset.created_at)
    )
    return [_to_out(p) for p in (await db.execute(stmt)).scalars().all()]


@router.post("", response_model=ActivityPresetOut, status_code=status.HTTP_201_CREATED)
async def create_preset(
    payload: ActivityPresetIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> ActivityPresetOut:
    preset = ActivityPreset(
        user_id=user.id,
        label=payload.label,
        minutes=payload.minutes,
        exercise_type=(payload.exercise_type.strip() or None) if payload.exercise_type else None,
        icon_kind=payload.icon_kind,
        icon_key=payload.icon_key,
        sort_order=payload.sort_order,
    )
    db.add(preset)
    await db.flush()
    await audit(
        db,
        actor=f"user:{user.id}",
        action="activity.preset.create",
        user_id=user.id,
        target_type="activity_preset",
        target_id=str(preset.id),
        meta={"minutes": preset.minutes, "label": preset.label},
    )
    return _to_out(preset)


@router.patch("/{preset_id}", response_model=ActivityPresetOut)
async def update_preset(
    preset_id: uuid.UUID,
    payload: ActivityPresetIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> ActivityPresetOut:
    preset = await _get_owned(db, user=user, preset_id=preset_id)
    preset.label = payload.label
    preset.minutes = payload.minutes
    preset.exercise_type = (
        payload.exercise_type.strip() if payload.exercise_type and payload.exercise_type.strip() else None
    )
    preset.icon_kind = payload.icon_kind
    preset.icon_key = payload.icon_key
    preset.sort_order = payload.sort_order
    preset.updated_at = utcnow()
    await db.flush()
    await audit(
        db,
        actor=f"user:{user.id}",
        action="activity.preset.update",
        user_id=user.id,
        target_type="activity_preset",
        target_id=str(preset.id),
    )
    return _to_out(preset)


@router.delete("/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_preset(
    preset_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    preset = await _get_owned(db, user=user, preset_id=preset_id)
    await db.delete(preset)
    await audit(
        db,
        actor=f"user:{user.id}",
        action="activity.preset.delete",
        user_id=user.id,
        target_type="activity_preset",
        target_id=str(preset_id),
    )
