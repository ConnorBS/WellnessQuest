from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.integrations.base import channels
from app.models.integration import Integration
from app.models.user import User
from app.schemas.integration import IntegrationCreateIn, IntegrationOut
from app.security.crypto import encrypt_secrets
from app.telemetry.recorder import audit

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("/kinds")
async def list_kinds(_user: User = Depends(current_user)) -> dict[str, list[dict[str, str]]]:
    return {"channels": [{"kind": k, "label": k} for k in channels.kinds()]}


@router.post("", response_model=IntegrationOut, status_code=status.HTTP_201_CREATED)
async def create_integration(
    payload: IntegrationCreateIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> IntegrationOut:
    try:
        cls = channels.get(payload.kind)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"unknown_kind:{payload.kind}"
        ) from exc
    try:
        cls.config_schema.model_validate(payload.config)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"invalid_config:{exc}"
        ) from exc
    if cls.secrets_schema is not None and payload.secrets:
        try:
            cls.secrets_schema.model_validate(payload.secrets)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"invalid_secrets:{exc}"
            ) from exc

    row = Integration(
        user_id=user.id,
        kind=payload.kind,
        name=payload.name,
        config=payload.config,
        secrets=encrypt_secrets(payload.secrets),
        enabled=True,
    )
    db.add(row)
    await db.flush()
    await audit(
        db,
        actor=f"user:{user.id}",
        action="integration.create",
        user_id=user.id,
        target_type="integration",
        target_id=str(row.id),
        meta={"kind": payload.kind, "name": payload.name},
    )
    return _out(row)


@router.get("", response_model=list[IntegrationOut])
async def list_integrations(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> list[IntegrationOut]:
    rows = (
        await db.execute(
            select(Integration).where(Integration.user_id == user.id).order_by(Integration.created_at.desc())
        )
    ).scalars().all()
    return [_out(r) for r in rows]


@router.delete("/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_integration(
    integration_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    row = (
        await db.execute(
            select(Integration).where(
                Integration.id == integration_id, Integration.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await db.delete(row)
    await audit(
        db,
        actor=f"user:{user.id}",
        action="integration.delete",
        user_id=user.id,
        target_type="integration",
        target_id=str(integration_id),
    )


def _out(row: Integration) -> IntegrationOut:
    return IntegrationOut(
        id=row.id,
        kind=row.kind,
        name=row.name,
        config=row.config,
        enabled=row.enabled,
        created_at=row.created_at,
    )
