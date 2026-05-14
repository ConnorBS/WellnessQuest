"""Build info endpoint.

No DB dependency — must remain reachable when Postgres is unavailable so
operators can still confirm which image is running.
"""

from __future__ import annotations

import os

from fastapi import APIRouter

from app import __version__
from app.schemas.version import VersionOut

router = APIRouter(tags=["meta"])


@router.get("/version", response_model=VersionOut)
async def version() -> VersionOut:
    return VersionOut(
        version=__version__,
        git_sha=os.environ.get("WQ_GIT_SHA") or None,
        build_timestamp=os.environ.get("WQ_BUILD_TIMESTAMP") or None,
    )
