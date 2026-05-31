from __future__ import annotations

import asyncpg
import pytest

from app.db import wait_for_db


@pytest.fixture(autouse=True)
def _fast_waits(monkeypatch):
    # No real sleeping between attempts in tests.
    async def _noop(_seconds):
        return None

    monkeypatch.setattr(wait_for_db.asyncio, "sleep", _noop)


async def test_returns_once_db_is_reachable(monkeypatch):
    calls = {"n": 0}

    async def _connect(_timeout):
        calls["n"] += 1

    monkeypatch.setattr(wait_for_db, "_try_connect", _connect)
    await wait_for_db.wait_for_db()
    assert calls["n"] == 1


async def test_retries_transient_then_succeeds(monkeypatch):
    attempts = {"n": 0}

    async def _connect(_timeout):
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise ConnectionRefusedError(111, "Connection refused")

    monkeypatch.setattr(wait_for_db, "_try_connect", _connect)
    await wait_for_db.wait_for_db()
    assert attempts["n"] == 3


async def test_fatal_auth_error_exits_immediately(monkeypatch):
    attempts = {"n": 0}

    async def _connect(_timeout):
        attempts["n"] += 1
        raise asyncpg.InvalidPasswordError("password authentication failed")

    monkeypatch.setattr(wait_for_db, "_try_connect", _connect)
    with pytest.raises(SystemExit) as exc:
        await wait_for_db.wait_for_db()
    assert exc.value.code == 1
    assert attempts["n"] == 1  # did not retry


async def test_missing_database_is_fatal(monkeypatch):
    async def _connect(_timeout):
        raise asyncpg.InvalidCatalogNameError('database "nope" does not exist')

    monkeypatch.setattr(wait_for_db, "_try_connect", _connect)
    with pytest.raises(SystemExit) as exc:
        await wait_for_db.wait_for_db()
    assert exc.value.code == 1


async def test_gives_up_after_max_seconds(monkeypatch):
    monkeypatch.setenv("DB_WAIT_MAX_SECONDS", "0.01")
    monkeypatch.setenv("DB_WAIT_INTERVAL", "0")

    async def _connect(_timeout):
        raise ConnectionRefusedError(111, "Connection refused")

    monkeypatch.setattr(wait_for_db, "_try_connect", _connect)
    with pytest.raises(SystemExit) as exc:
        await wait_for_db.wait_for_db()
    assert exc.value.code == 1


def test_dsn_strips_asyncpg_dialect(monkeypatch):
    monkeypatch.setattr(
        wait_for_db.settings,
        "database_url",
        "postgresql+asyncpg://u:p@host:5432/db",
    )
    assert wait_for_db._dsn() == "postgresql://u:p@host:5432/db"
