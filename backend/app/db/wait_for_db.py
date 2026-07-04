"""Startup preflight: block until Postgres is reachable, then return.

Run as a module before Alembic on container boot:

    python -m app.db.wait_for_db && alembic upgrade head && uvicorn ...

Why this exists
---------------
The container runs ``alembic upgrade head`` on every start. If Postgres is
momentarily unreachable — host reboot, the operator's separate postgres
container still starting, a nightly backup that stops it — Alembic's first
connection raises ``ConnectionRefusedError`` and the whole CMD chain exits.
With ``restart: unless-stopped`` that becomes a crash-loop that buries the
real cause under a wall of asyncpg tracebacks.

This preflight retries the connection with capped backoff and logs one clear
line per attempt, so:

  * a DB that is merely *down* (connection refused / DNS not resolving yet /
    postgres still in recovery) makes us **wait and log**, never crash-loop;
  * a DB that is *up but rejecting us* (wrong password, missing database)
    **fails fast** with an unambiguous message — waiting wouldn't help, and
    the operator needs to see it immediately.

Tunables (env vars)
--------------------
  DB_WAIT_MAX_SECONDS   total budget before giving up. 0 (default) = wait
                        forever, so the container parks instead of exiting.
  DB_WAIT_INTERVAL      seconds between attempts; backoff caps here. Default 5.
  DB_WAIT_TIMEOUT       per-attempt connect timeout in seconds. Default 5.
"""

from __future__ import annotations

import asyncio
import os
import socket
import sys
import time

import asyncpg

from app.config import settings
from app.telemetry.logger import configure_logging, get_logger

log = get_logger(__name__)


def _dsn() -> str:
    """asyncpg wants a plain ``postgresql://`` DSN, not the SQLAlchemy
    ``postgresql+asyncpg://`` dialect form that DATABASE_URL carries."""
    return settings.database_url.replace("postgresql+asyncpg://", "postgresql://", 1)


# Postgres is up but is refusing *this* connection for a reason that retrying
# will never fix. Surface it and exit non-zero so the operator sees the cause.
_FATAL_ERRORS: tuple[type[Exception], ...] = (
    asyncpg.InvalidPasswordError,
    asyncpg.InvalidAuthorizationSpecificationError,
    asyncpg.InvalidCatalogNameError,  # database does not exist
)

# Postgres isn't ready yet (down, still booting, or in recovery). Keep waiting.
_TRANSIENT_ERRORS: tuple[type[Exception], ...] = (
    ConnectionError,  # includes ConnectionRefusedError
    socket.gaierror,  # hostname not resolving yet
    asyncpg.CannotConnectNowError,  # server starting up / shutting down
    asyncpg.TooManyConnectionsError,
    OSError,  # network unreachable, no route to host, etc.
    asyncio.TimeoutError,
)


async def _try_connect(connect_timeout: float) -> None:
    conn = await asyncpg.connect(dsn=_dsn(), timeout=connect_timeout)
    try:
        await conn.execute("SELECT 1")
    finally:
        await conn.close()


async def wait_for_db() -> None:
    max_seconds = float(os.environ.get("DB_WAIT_MAX_SECONDS", "0"))
    interval = float(os.environ.get("DB_WAIT_INTERVAL", "5"))
    timeout = float(os.environ.get("DB_WAIT_TIMEOUT", "5"))

    started = time.monotonic()
    attempt = 0
    while True:
        attempt += 1
        try:
            await _try_connect(timeout)
        except _FATAL_ERRORS as exc:
            # Reachable but rejecting us — retrying is pointless.
            log.error(
                "db_wait_fatal",
                attempt=attempt,
                error=type(exc).__name__,
                detail=str(exc),
                hint="Postgres answered but rejected the connection. Check the "
                "user/password/database in DATABASE_URL against the postgres "
                "container's POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB.",
            )
            sys.exit(1)
        except _TRANSIENT_ERRORS as exc:
            elapsed = time.monotonic() - started
            if max_seconds and elapsed >= max_seconds:
                log.error(
                    "db_wait_timeout",
                    attempts=attempt,
                    waited_seconds=round(elapsed, 1),
                    error=type(exc).__name__,
                    detail=str(exc),
                )
                sys.exit(1)
            log.warning(
                "db_wait_retry",
                attempt=attempt,
                waited_seconds=round(elapsed, 1),
                error=type(exc).__name__,
                detail=str(exc),
                next_retry_seconds=interval,
            )
            await asyncio.sleep(interval)
        else:
            log.info(
                "db_wait_ready",
                attempts=attempt,
                waited_seconds=round(time.monotonic() - started, 1),
            )
            return


def main() -> None:
    configure_logging()
    asyncio.run(wait_for_db())


if __name__ == "__main__":
    main()
