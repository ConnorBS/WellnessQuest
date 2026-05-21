from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.user import User
from app.schemas.sleep import SleepEntryOut, SleepLastOut
from app.services import goal_service, sleep_service

router = APIRouter(prefix="/sleep", tags=["sleep"])


@router.get("/last", response_model=SleepLastOut)
async def sleep_last(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> SleepLastOut:
    goal = await goal_service.get_or_create_default_sleep(db, user_id=user.id)
    entry = await sleep_service.last_session(db, user=user)
    return SleepLastOut(
        entry=(
            SleepEntryOut(
                id=entry.id,
                started_at=entry.started_at,
                ended_at=entry.ended_at,
                duration_minutes=entry.duration_minutes,
                quality_score=entry.quality_score,
                source=entry.source,
                client_id=entry.client_id,
            )
            if entry is not None
            else None
        ),
        goal_minutes=int(goal.target),
    )
