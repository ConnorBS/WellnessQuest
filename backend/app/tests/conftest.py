from __future__ import annotations

import asyncio
import os
import uuid
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Ensure config is loaded with test-friendly defaults BEFORE any app modules import settings.
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://wq:wq@postgres:5432/wellnessquest_test",
)
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
# A real Fernet key (32 url-safe base64 bytes). Generated once at import so every
# test run shares the same key without bundling secrets in the repo. Required
# now that `app.main.lifespan` calls `ensure_fernet_key_valid()` on startup.
from cryptography.fernet import Fernet  # noqa: E402

os.environ.setdefault("FERNET_KEY", Fernet.generate_key().decode("ascii"))
os.environ.setdefault("WQ_DISABLE_TITLE_SYNC", "1")

import app.db.session as session_mod  # noqa: E402
from app import models  # noqa: F401,E402  -- register models with Base.metadata
from app.config import settings  # noqa: E402
from app.db import base as db_base  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture()
async def engine():
    eng = create_async_engine(settings.database_url, future=True, pool_pre_ping=True)
    async with eng.begin() as conn:
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "citext"'))
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "pgcrypto"'))
        await conn.run_sync(db_base.Base.metadata.drop_all)
        await conn.run_sync(db_base.Base.metadata.create_all)
    factory = async_sessionmaker(eng, expire_on_commit=False, class_=AsyncSession)
    # Point the app's global session factory at the test engine.
    original = session_mod.async_session
    session_mod.async_session = factory
    try:
        yield eng
    finally:
        session_mod.async_session = original
        await eng.dispose()


@pytest_asyncio.fixture()
async def db(engine) -> AsyncIterator[AsyncSession]:
    async with session_mod.async_session() as session:
        yield session


@pytest_asyncio.fixture()
async def client(engine):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest.fixture
def unique_email() -> str:
    return f"u-{uuid.uuid4().hex[:8]}@example.com"
