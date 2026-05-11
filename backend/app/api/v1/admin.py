from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.invites import generate_invite_code
from app.deps import current_admin, get_db
from app.models.invite import Invite
from app.models.user import User
from app.schemas.auth import InviteCreateOut, MeOut
from app.services.time_utils import utcnow
from app.telemetry.recorder import audit

router = APIRouter(prefix="/admin", tags=["admin"])


class InviteCreateIn(BaseModel):
    email: EmailStr | None = None
    ttl_hours: int = 72


@router.post("/invites", response_model=InviteCreateOut, status_code=status.HTTP_201_CREATED)
async def create_invite(
    payload: InviteCreateIn,
    admin: User = Depends(current_admin),
    db: AsyncSession = Depends(get_db),
) -> InviteCreateOut:
    raw, code_hash = generate_invite_code()
    expires = utcnow() + timedelta(hours=max(1, min(payload.ttl_hours, 24 * 30)))
    invite = Invite(
        email=payload.email,
        code_hash=code_hash,
        created_by=admin.id,
        expires_at=expires,
    )
    db.add(invite)
    await db.flush()
    await audit(
        db,
        actor=f"user:{admin.id}",
        action="admin.invite_create",
        user_id=admin.id,
        target_type="invite",
        target_id=str(invite.id),
        meta={"email": payload.email},
    )
    return InviteCreateOut(code=raw, expires_at=expires)


@router.get("/users", response_model=list[MeOut])
async def list_users(
    _admin: User = Depends(current_admin), db: AsyncSession = Depends(get_db)
) -> list[MeOut]:
    rows = (await db.execute(select(User).order_by(User.created_at))).scalars().all()
    return [
        MeOut(
            id=u.id,
            email=u.email,
            display_name=u.display_name,
            role=u.role,
            xp_total=u.xp_total,
            level=u.level,
            timezone=u.timezone,
        )
        for u in rows
    ]
