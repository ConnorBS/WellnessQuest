from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.food_preset import FoodPreset
from app.models.user import User
from app.schemas.food import FoodPresetIn, FoodPresetOut
from app.services.time_utils import utcnow
from app.telemetry.recorder import audit

router = APIRouter(prefix="/food/presets", tags=["food"])


def _to_out(p: FoodPreset) -> FoodPresetOut:
    return FoodPresetOut(
        id=p.id,
        label=p.label,
        brand=p.brand,
        kcal=p.kcal,
        protein_g=p.protein_g,
        carbs_g=p.carbs_g,
        fat_g=p.fat_g,
        meal_type=p.meal_type,  # type: ignore[arg-type]
        provider=p.provider,
        provider_id=p.provider_id,
        icon_kind=p.icon_kind,  # type: ignore[arg-type]
        icon_key=p.icon_key,
        sort_order=p.sort_order,
    )


async def _get_owned(
    db: AsyncSession, *, user: User, preset_id: uuid.UUID
) -> FoodPreset:
    row = (
        await db.execute(
            select(FoodPreset).where(
                FoodPreset.id == preset_id, FoodPreset.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    return row


@router.get("", response_model=list[FoodPresetOut])
async def list_presets(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> list[FoodPresetOut]:
    stmt = (
        select(FoodPreset)
        .where(FoodPreset.user_id == user.id)
        .order_by(FoodPreset.sort_order, FoodPreset.created_at)
    )
    return [_to_out(p) for p in (await db.execute(stmt)).scalars().all()]


@router.post("", response_model=FoodPresetOut, status_code=status.HTTP_201_CREATED)
async def create_preset(
    payload: FoodPresetIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> FoodPresetOut:
    preset = FoodPreset(
        user_id=user.id,
        label=payload.label,
        brand=payload.brand,
        kcal=payload.kcal,
        protein_g=payload.protein_g,
        carbs_g=payload.carbs_g,
        fat_g=payload.fat_g,
        meal_type=payload.meal_type,
        provider=payload.provider,
        provider_id=payload.provider_id,
        icon_kind=payload.icon_kind,
        icon_key=payload.icon_key,
        sort_order=payload.sort_order,
    )
    db.add(preset)
    await db.flush()
    await audit(
        db,
        actor=f"user:{user.id}",
        action="food.preset.create",
        user_id=user.id,
        target_type="food_preset",
        target_id=str(preset.id),
        meta={"kcal": preset.kcal, "label": preset.label},
    )
    return _to_out(preset)


@router.patch("/{preset_id}", response_model=FoodPresetOut)
async def update_preset(
    preset_id: uuid.UUID,
    payload: FoodPresetIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> FoodPresetOut:
    preset = await _get_owned(db, user=user, preset_id=preset_id)
    preset.label = payload.label
    preset.brand = payload.brand
    preset.kcal = payload.kcal
    preset.protein_g = payload.protein_g
    preset.carbs_g = payload.carbs_g
    preset.fat_g = payload.fat_g
    preset.meal_type = payload.meal_type
    preset.provider = payload.provider
    preset.provider_id = payload.provider_id
    preset.icon_kind = payload.icon_kind
    preset.icon_key = payload.icon_key
    preset.sort_order = payload.sort_order
    preset.updated_at = utcnow()
    await db.flush()
    await audit(
        db,
        actor=f"user:{user.id}",
        action="food.preset.update",
        user_id=user.id,
        target_type="food_preset",
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
        action="food.preset.delete",
        user_id=user.id,
        target_type="food_preset",
        target_id=str(preset_id),
    )
