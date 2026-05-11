from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app import integrations as _integrations  # noqa: F401 - register channels
from app import providers as _providers  # noqa: F401 - register providers
from app.api.v1 import api_v1
from app.config import settings
from app.services import webhook_dispatcher
from app.telemetry.logger import configure_logging, get_logger
from app.telemetry.middleware import RequestContextMiddleware

log = get_logger(__name__)

STATIC_DIR = Path(os.environ.get("WQ_STATIC_DIR", "/app/static"))


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    log.info(
        "startup",
        version="0.1.0",
        static_dir=str(STATIC_DIR),
        static_present=STATIC_DIR.is_dir(),
    )
    task = webhook_dispatcher.start()
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass
        log.info("shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title="WellnessQuest API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url=None,
        openapi_url="/openapi.json",
    )

    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["x-request-id"],
    )

    app.include_router(api_v1)

    if STATIC_DIR.is_dir():
        sw_path = STATIC_DIR / "sw.js"
        if sw_path.is_file():
            @app.get("/sw.js", include_in_schema=False)
            async def service_worker() -> FileResponse:
                return FileResponse(
                    sw_path,
                    media_type="application/javascript",
                    headers={
                        "Cache-Control": "no-cache, no-store, must-revalidate",
                        "Service-Worker-Allowed": "/",
                    },
                )

        app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")

    return app


app = create_app()
