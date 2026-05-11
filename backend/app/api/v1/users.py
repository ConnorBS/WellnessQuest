from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import current_user
from app.models.user import User
from app.schemas.auth import MeOut

router = APIRouter(tags=["users"])


@router.get("/me", response_model=MeOut)
async def get_me(user: User = Depends(current_user)) -> MeOut:
    return MeOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        xp_total=user.xp_total,
        level=user.level,
        timezone=user.timezone,
    )
