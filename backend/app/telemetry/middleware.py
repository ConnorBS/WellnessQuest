from __future__ import annotations

import secrets
import traceback

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.db.session import async_session
from app.telemetry.logger import get_logger
from app.telemetry.recorder import capture_error

log = get_logger(__name__)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assigns a request_id, logs every request, captures unhandled exceptions to error_log."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        request_id = request.headers.get("x-request-id") or secrets.token_hex(8)
        request.state.request_id = request_id
        try:
            response = await call_next(request)
        except Exception as exc:  # noqa: BLE001 - we re-raise as a 500 below
            error_id = secrets.token_hex(8)
            tb = traceback.format_exc()
            try:
                async with async_session() as db:
                    await capture_error(
                        db,
                        source="backend",
                        level="error",
                        message=f"{type(exc).__name__}: {exc}",
                        stack=tb,
                        context={"path": request.url.path, "method": request.method},
                        request_id=request_id,
                    )
                    await db.commit()
            except Exception:  # noqa: BLE001
                log.exception("error_log_write_failed")
            log.error(
                "unhandled_exception",
                request_id=request_id,
                error_id=error_id,
                path=request.url.path,
                method=request.method,
                exc=str(exc),
            )
            return JSONResponse(
                status_code=500,
                content={"detail": "internal_error", "error_id": error_id, "request_id": request_id},
                headers={"x-request-id": request_id},
            )
        response.headers["x-request-id"] = request_id
        return response
