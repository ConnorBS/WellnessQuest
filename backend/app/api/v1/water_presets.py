from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.user import User
from app.models.water_preset import WaterPreset
from app.schemas.water_preset import WaterPresetIn, WaterPresetOut
from app.services.time_utils import utcnow
from app.telemetry.recorder import audit

router = APIRouter(prefix="/water/presets", tags=["water"])


def _to_out(p: WaterPreset) -> WaterPresetOut:
    return WaterPresetOut(
        id=p.id,
        label=p.label,
        volume_ml=p.volume_ml,
        icon_kind=p.icon_kind,  # type: ignore[arg-type]
        icon_key=p.icon_key,
        sort_order=p.sort_order,
    )


async def _get_owned(
    db: AsyncSession, *, user: User, preset_id: uuid.UUID
) -> WaterPreset:
    row = (
        await db.execute(
            select(WaterPreset).where(
                WaterPreset.id == preset_id, WaterPreset.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    return row


@router.get("", response_model=list[WaterPresetOut])
async def list_presets(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> list[WaterPresetOut]:
    stmt = (
        select(WaterPreset)
        .where(WaterPreset.user_id == user.id)
        .order_by(WaterPreset.sort_order, WaterPreset.created_at)
    )
    return [_to_out(p) for p in (await db.execute(stmt)).scalars().all()]


@router.post("", response_model=WaterPresetOut, status_code=status.HTTP_201_CREATED)
async def create_preset(
    payload: WaterPresetIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> WaterPresetOut:
    preset = WaterPreset(
        user_id=user.id,
        label=payload.label,
        volume_ml=payload.volume_ml,
        icon_kind=payload.icon_kind,
        icon_key=payload.icon_key,
        sort_order=payload.sort_order,
    )
    db.add(preset)
    await db.flush()
    await audit(
        db,
        actor=f"user:{user.id}",
        action="water.preset.create",
        user_id=user.id,
        target_type="water_preset",
        target_id=str(preset.id),
        meta={"volume_ml": preset.volume_ml, "label": preset.label},
    )
    return _to_out(preset)


@router.patch("/{preset_id}", response_model=WaterPresetOut)
async def update_preset(
    preset_id: uuid.UUID,
    payload: WaterPresetIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> WaterPresetOut:
    preset = await _get_owned(db, user=user, preset_id=preset_id)
    preset.label = payload.label
    preset.volume_ml = payload.volume_ml
    preset.icon_kind = payload.icon_kind
    preset.icon_key = payload.icon_key
    preset.sort_order = payload.sort_order
    preset.updated_at = utcnow()
    await db.flush()
    await audit(
        db,
        actor=f"user:{user.id}",
        action="water.preset.update",
        user_id=user.id,
        target_type="water_preset",
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
        action="water.preset.delete",
        user_id=user.id,
        target_type="water_preset",
        target_id=str(preset_id),
    )
