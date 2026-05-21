from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.user import User
from app.schemas.steps import StepsTodayOut
from app.services import goal_service, steps_service
from app.services.time_utils import day_for_user

router = APIRouter(prefix="/steps", tags=["steps"])


@router.get("/today", response_model=StepsTodayOut)
async def steps_today(
    date_: date | None = Query(default=None, alias="date"),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> StepsTodayOut:
    day = date_ or day_for_user(user.timezone)
    goal = await goal_service.get_or_create_default_steps(db, user_id=user.id)
    total = await steps_service.total_today(db, user=user, for_date=day)
    goal_target = int(goal.target)
    pct = min(100, round((total / goal_target) * 100)) if goal_target else 0
    return StepsTodayOut(
        date=day.isoformat(),
        total=total,
        goal=goal_target,
        percent=pct,
    )
