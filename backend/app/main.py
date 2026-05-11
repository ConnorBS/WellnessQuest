from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import integrations as _integrations  # noqa: F401 - register channels
from app import providers as _providers  # noqa: F401 - register providers
from app.api.v1 import api_v1
from app.config import settings
from app.services import webhook_dispatcher
from app.telemetry.logger import configure_logging, get_logger
from app.telemetry.middleware import RequestContextMiddleware

log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    log.info("startup", version="0.1.0")
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
    return app


app = create_app()
