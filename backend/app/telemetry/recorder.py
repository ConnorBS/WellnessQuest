from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.error_log import ErrorLog


async def audit(
    db: AsyncSession,
    *,
    actor: str,
    action: str,
    user_id: uuid.UUID | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    meta: dict[str, Any] | None = None,
    ip: str | None = None,
) -> AuditLog:
    row = AuditLog(
        user_id=user_id,
        actor=actor,
        action=action,
        target_type=target_type,
        target_id=target_id,
        meta=meta or {},
        ip=ip,
    )
    db.add(row)
    await db.flush()
    return row


async def capture_error(
    db: AsyncSession,
    *,
    source: str,
    level: str,
    message: str,
    stack: str | None = None,
    context: dict[str, Any] | None = None,
    user_id: uuid.UUID | None = None,
    request_id: str | None = None,
) -> ErrorLog:
    row = ErrorLog(
        user_id=user_id,
        source=source,
        level=level,
        message=message,
        stack=stack,
        context=context or {},
        request_id=request_id,
    )
    db.add(row)
    await db.flush()
    return row
