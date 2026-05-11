from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.api_tokens import generate_token
from app.deps import current_user, get_db
from app.models.api_token import ApiToken
from app.models.user import User
from app.schemas.api_token import ApiTokenCreateIn, ApiTokenCreateOut, ApiTokenOut
from app.services.time_utils import utcnow
from app.telemetry.recorder import audit

router = APIRouter(prefix="/api-tokens", tags=["api-tokens"])

ALLOWED_SCOPES = {"water:read", "water:write"}


@router.post("", response_model=ApiTokenCreateOut, status_code=status.HTTP_201_CREATED)
async def create_token(
    payload: ApiTokenCreateIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiTokenCreateOut:
    bad = set(payload.scopes) - ALLOWED_SCOPES
    if bad:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"unknown_scopes:{sorted(bad)}"
        )
    raw, hashed = generate_token()
    row = ApiToken(user_id=user.id, name=payload.name, token_hash=hashed, scopes=payload.scopes)
    db.add(row)
    await db.flush()
    await audit(
        db,
        actor=f"user:{user.id}",
        action="token.create",
        user_id=user.id,
        target_type="api_token",
        target_id=str(row.id),
        meta={"name": payload.name, "scopes": payload.scopes},
    )
    return ApiTokenCreateOut(
        id=row.id,
        name=row.name,
        scopes=list(row.scopes),
        token=raw,
        created_at=row.created_at,
    )


@router.get("", response_model=list[ApiTokenOut])
async def list_tokens(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> list[ApiTokenOut]:
    rows = (
        await db.execute(
            select(ApiToken).where(ApiToken.user_id == user.id).order_by(ApiToken.created_at.desc())
        )
    ).scalars().all()
    return [
        ApiTokenOut(
            id=r.id,
            name=r.name,
            scopes=list(r.scopes),
            last_used_at=r.last_used_at,
            created_at=r.created_at,
            revoked_at=r.revoked_at,
        )
        for r in rows
    ]


@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_token(
    token_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    row = (
        await db.execute(
            select(ApiToken).where(ApiToken.id == token_id, ApiToken.user_id == user.id)
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    if row.revoked_at is None:
        row.revoked_at = utcnow()
        await audit(
            db,
            actor=f"user:{user.id}",
            action="token.revoke",
            user_id=user.id,
            target_type="api_token",
            target_id=str(row.id),
        )
