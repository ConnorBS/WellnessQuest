from __future__ import annotations

import asyncio
import contextlib
import os
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app import integrations as _integrations  # noqa: F401 - register channels
from app import providers as _providers  # noqa: F401 - register providers
from app.api.v1 import api_v1
from app.config import settings
from app.integrations.home_assistant import pull_worker as ha_pull_worker
from app.security.crypto import ensure_fernet_key_valid
from app.services import title_sync, webhook_dispatcher
from app.telemetry.logger import configure_logging, get_logger
from app.telemetry.middleware import RequestContextMiddleware

log = get_logger(__name__)

STATIC_DIR = Path(os.environ.get("WQ_STATIC_DIR", "/app/static"))


def html_path_for_rsc(path: str) -> str:
    """Map a Next RSC payload path back to the HTML page it belongs to.

    ``/period/index.txt`` -> ``/period/``, ``/period.txt`` -> ``/period``.
    """
    if path.endswith("/index.txt"):
        return path[: -len("index.txt")]
    return path[: -len(".txt")] or "/"


def is_document_request(request: Request) -> bool:
    """True when the browser is loading this URL as a top-level page."""
    dest = request.headers.get("sec-fetch-dest")
    if dest is not None:
        return dest == "document"
    # Older browsers don't send Sec-Fetch-*. The App Router's RSC fetches always
    # carry an `RSC` header and never ask for HTML, so this stays off their path.
    if "rsc" in request.headers:
        return False
    return "text/html" in request.headers.get("accept", "")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    ensure_fernet_key_valid()
    log.info(
        "startup",
        version="0.1.0",
        static_dir=str(STATIC_DIR),
        static_present=STATIC_DIR.is_dir(),  # noqa: ASYNC240 - one-shot stat at startup, not a hot path
    )
    await title_sync.sync_catalog_at_startup()
    task = webhook_dispatcher.start()
    ha_task = ha_pull_worker.start()
    try:
        yield
    finally:
        for t in (task, ha_task):
            t.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await t
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

    @app.middleware("http")
    async def static_shell_middleware(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Guard rails for the exported Next.js frontend.

        The frontend ships as a static export, so every page has a sibling
        `.txt` RSC payload. When the container is rebuilt under a still-open
        tab (`:edge` republishes on every push), the App Router notices the
        build id no longer matches and falls back to a *browser* navigation to
        that `.txt` URL — the user lands on a page of raw flight payload
        instead of the page they tapped. Bounce those navigations to the real
        HTML page, and keep browsers from holding onto a stale shell in the
        first place.
        """
        path = request.url.path
        if path.startswith("/api/"):
            return await call_next(request)

        if (
            request.method in ("GET", "HEAD")
            and path.endswith(".txt")
            and is_document_request(request)
        ):
            target = html_path_for_rsc(path)
            if request.url.query:
                target = f"{target}?{request.url.query}"
            return RedirectResponse(
                target, status_code=307, headers={"Cache-Control": "no-store"}
            )

        response = await call_next(request)
        if path.startswith("/_next/static/"):
            # Content-hashed filenames — safe to keep forever.
            response.headers.setdefault(
                "Cache-Control", "public, max-age=31536000, immutable"
            )
        elif path.endswith(("/", ".html", ".txt")):
            # Rewritten by every image build; a cached copy is what lets a tab
            # drift out of sync with the server in the first place.
            response.headers["Cache-Control"] = "no-cache"
        return response

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
