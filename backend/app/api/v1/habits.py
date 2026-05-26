from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.habit import Habit
from app.models.user import User
from app.schemas.habit import HabitIn, HabitOut, HabitWithStatusOut
from app.services import habit_service
from app.services.time_utils import day_for_user, utcnow
from app.telemetry.recorder import audit

router = APIRouter(prefix="/habits", tags=["habits"])


class HabitReorderIn(BaseModel):
    ids: list[uuid.UUID]


def _to_out(h: Habit) -> HabitOut:
    return HabitOut(
        id=h.id,
        name=h.name,
        icon_kind=h.icon_kind,
        icon_key=h.icon_key,
        cadence_kind=h.cadence_kind,
        weekly_target=h.weekly_target,
        monthly_target=h.monthly_target,
        interval_days=h.interval_days,
        sort_order=h.sort_order,
    )


@router.get("", response_model=list[HabitWithStatusOut])
async def list_habits(
    date_: date | None = Query(default=None, alias="date"),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[HabitWithStatusOut]:
    return await habit_service.list_with_status(db, user=user, as_of=date_)


@router.post("", response_model=HabitOut, status_code=status.HTTP_201_CREATED)
async def create_habit(
    payload: HabitIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> HabitOut:
    habit = Habit(
        user_id=user.id,
        name=payload.name,
        icon_kind=payload.icon_kind,
        icon_key=payload.icon_key,
        cadence_kind=payload.cadence_kind,
        weekly_target=payload.weekly_target if payload.cadence_kind == "weekly" else None,
        monthly_target=payload.monthly_target if payload.cadence_kind == "monthly" else None,
        interval_days=payload.interval_days if payload.cadence_kind == "interval" else None,
        sort_order=payload.sort_order,
    )
    db.add(habit)
    await db.flush()
    await audit(
        db,
        actor=f"user:{user.id}",
        action="habit.create",
        user_id=user.id,
        target_type="habit",
        target_id=str(habit.id),
        meta={"cadence_kind": habit.cadence_kind, "name": habit.name},
    )
    return _to_out(habit)


@router.patch("/{habit_id}", response_model=HabitOut)
async def update_habit(
    habit_id: uuid.UUID,
    payload: HabitIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> HabitOut:
    habit = await habit_service.get_owned(db, user=user, habit_id=habit_id)
    if habit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    habit.name = payload.name
    habit.icon_kind = payload.icon_kind
    habit.icon_key = payload.icon_key
    habit.cadence_kind = payload.cadence_kind
    habit.weekly_target = payload.weekly_target if payload.cadence_kind == "weekly" else None
    habit.monthly_target = payload.monthly_target if payload.cadence_kind == "monthly" else None
    habit.interval_days = payload.interval_days if payload.cadence_kind == "interval" else None
    habit.sort_order = payload.sort_order
    habit.updated_at = utcnow()
    await db.flush()
    await audit(
        db,
        actor=f"user:{user.id}",
        action="habit.update",
        user_id=user.id,
        target_type="habit",
        target_id=str(habit.id),
    )
    return _to_out(habit)


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habit(
    habit_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    habit = await habit_service.get_owned(db, user=user, habit_id=habit_id)
    if habit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    habit.archived_at = utcnow()
    await audit(
        db,
        actor=f"user:{user.id}",
        action="habit.delete",
        user_id=user.id,
        target_type="habit",
        target_id=str(habit.id),
    )


@router.post("/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_habits(
    payload: HabitReorderIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await habit_service.reorder(db, user=user, ordered_ids=payload.ids)
    await audit(
        db,
        actor=f"user:{user.id}",
        action="habit.reorder",
        user_id=user.id,
        target_type="habit",
        meta={"count": len(payload.ids)},
    )


@router.post("/{habit_id}/checkins/toggle", response_model=HabitWithStatusOut)
async def toggle_today(
    habit_id: uuid.UUID,
    date_: date | None = Query(default=None, alias="date"),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> HabitWithStatusOut:
    habit = await habit_service.get_owned(db, user=user, habit_id=habit_id)
    if habit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    if date_ is not None and date_ > day_for_user(user.timezone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="future_date"
        )
    now_done, result = await habit_service.toggle_checkin(
        db, user=user, habit=habit, for_date=date_
    )
    if now_done:
        # A new check-in may cross a habit-checkin-count title threshold; flag
        # for a re-scan on the next /me so the unlock surfaces immediately.
        user.titles_last_scan_at = None
    await audit(
        db,
        actor=f"user:{user.id}",
        action="habit.checkin" if now_done else "habit.uncheckin",
        user_id=user.id,
        target_type="habit",
        target_id=str(habit.id),
        meta={"date": (date_ or day_for_user(user.timezone)).isoformat()},
    )
    return result
