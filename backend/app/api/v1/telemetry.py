from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.user import User
from app.schemas.telemetry import TelemetryBatchIn, TelemetryBatchOut
from app.telemetry.recorder import capture_error

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


@router.post("/events", response_model=TelemetryBatchOut)
async def ingest_events(
    payload: TelemetryBatchIn,
    request: Request,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> TelemetryBatchOut:
    request_id = getattr(request.state, "request_id", None)
    for ev in payload.events:
        await capture_error(
            db,
            source="frontend",
            level=ev.level,
            message=ev.message,
            stack=ev.stack,
            context=ev.context,
            user_id=user.id,
            request_id=request_id,
        )
    return TelemetryBatchOut(accepted=len(payload.events))
