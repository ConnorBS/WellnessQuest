from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.integration import Integration
from app.models.user import User
from app.models.webhook import WebhookSubscription
from app.schemas.integration import WebhookSubscribeIn, WebhookSubscriptionOut

router = APIRouter(prefix="/integrations/{integration_id}/webhooks", tags=["integrations"])


@router.post("", response_model=WebhookSubscriptionOut, status_code=status.HTTP_201_CREATED)
async def subscribe(
    integration_id: uuid.UUID,
    payload: WebhookSubscribeIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> WebhookSubscriptionOut:
    integration = (
        await db.execute(
            select(Integration).where(
                Integration.id == integration_id, Integration.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if integration is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    sub = WebhookSubscription(
        integration_id=integration.id, event=payload.event, url=payload.url, active=True
    )
    db.add(sub)
    await db.flush()
    return WebhookSubscriptionOut(
        id=sub.id, integration_id=sub.integration_id, event=sub.event, url=sub.url, active=sub.active
    )


@router.get("", response_model=list[WebhookSubscriptionOut])
async def list_subs(
    integration_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[WebhookSubscriptionOut]:
    integration = (
        await db.execute(
            select(Integration).where(
                Integration.id == integration_id, Integration.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if integration is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    rows = (
        await db.execute(
            select(WebhookSubscription).where(WebhookSubscription.integration_id == integration.id)
        )
    ).scalars().all()
    return [
        WebhookSubscriptionOut(
            id=r.id, integration_id=r.integration_id, event=r.event, url=r.url, active=r.active
        )
        for r in rows
    ]


@router.delete("/{sub_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(
    integration_id: uuid.UUID,
    sub_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    row = (
        await db.execute(
            select(WebhookSubscription)
            .join(Integration, Integration.id == WebhookSubscription.integration_id)
            .where(
                WebhookSubscription.id == sub_id,
                WebhookSubscription.integration_id == integration_id,
                Integration.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    await db.delete(row)
