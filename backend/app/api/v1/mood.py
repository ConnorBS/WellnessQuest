from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.mood_entry import MoodEntry
from app.models.user import User
from app.schemas.mood import (
    MoodEntryIn,
    MoodEntryOut,
    MoodEntryPatch,
    MoodSummaryOut,
)
from app.services import mood_service
from app.services.time_utils import utcnow
from app.telemetry.recorder import audit

router = APIRouter(prefix="/mood", tags=["mood"])


def _to_out(row: MoodEntry) -> MoodEntryOut:
    return MoodEntryOut(
        id=row.id,
        mood=row.mood,
        energy=row.energy,
        occurred_at=row.occurred_at,
        note=row.note,
    )


@router.get("/summary", response_model=MoodSummaryOut)
async def mood_summary(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> MoodSummaryOut:
    latest = await mood_service.latest(db, user=user)
    count = await mood_service.today_count(db, user=user)
    return MoodSummaryOut(
        latest=_to_out(latest) if latest is not None else None,
        today_count=count,
    )


@router.get("", response_model=list[MoodEntryOut])
async def list_history(
    limit: int = 90,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MoodEntryOut]:
    limit = max(1, min(limit, 366))
    rows = await mood_service.list_history(db, user=user, limit=limit)
    return [_to_out(r) for r in rows]


@router.post("", response_model=MoodEntryOut, status_code=status.HTTP_201_CREATED)
async def add_mood(
    payload: MoodEntryIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> MoodEntryOut:
    row = await mood_service.add(
        db,
        user=user,
        mood=payload.mood,
        energy=payload.energy,
        occurred_at=payload.occurred_at or utcnow(),
        note=payload.note,
    )
    await audit(
        db,
        actor=f"user:{user.id}",
        action="mood.add",
        user_id=user.id,
        target_type="mood_entry",
        target_id=str(row.id),
        meta={"mood": row.mood, "energy": row.energy},
    )
    return _to_out(row)


@router.patch("/{entry_id}", response_model=MoodEntryOut)
async def update_mood(
    entry_id: int,
    payload: MoodEntryPatch,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> MoodEntryOut:
    row = await mood_service.update_entry(
        db, user=user, entry_id=entry_id, patch=payload
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await audit(
        db,
        actor=f"user:{user.id}",
        action="mood.update",
        user_id=user.id,
        target_type="mood_entry",
        target_id=str(row.id),
        meta={"fields": list(payload.model_dump(exclude_unset=True).keys())},
    )
    return _to_out(row)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mood(
    entry_id: int,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await mood_service.delete(db, user=user, entry_id=entry_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await audit(
        db,
        actor=f"user:{user.id}",
        action="mood.delete",
        user_id=user.id,
        target_type="mood_entry",
        target_id=str(entry_id),
    )
