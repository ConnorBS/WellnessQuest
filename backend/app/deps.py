from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.api_tokens import hash_token, is_token_format
from app.auth.jwt import TokenError, decode_access_token
from app.db.session import async_session
from app.models.api_token import ApiToken
from app.models.user import User
from app.services.time_utils import utcnow

bearer_scheme = HTTPBearer(auto_error=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_bearer_token")
    try:
        claims = decode_access_token(creds.credentials)
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token"
        ) from exc
    user_id = uuid.UUID(claims["sub"])
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None or user.disabled_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user_inactive")
    return user


async def current_admin(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin_only")
    return user


def current_ha_token(required_scope: str):  # type: ignore[no-untyped-def]
    """Dependency factory: enforces a long-lived HA token with `required_scope`."""

    async def _dep(
        request: Request,
        db: AsyncSession = Depends(get_db),
        x_wq_token: str | None = Header(default=None, alias="X-WQ-Token"),
    ) -> User:
        if not x_wq_token or not is_token_format(x_wq_token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_or_malformed_ha_token"
            )
        token_hash = hash_token(x_wq_token)
        row = (
            await db.execute(select(ApiToken).where(ApiToken.token_hash == token_hash))
        ).scalar_one_or_none()
        if row is None or row.revoked_at is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_ha_token"
            )
        if required_scope not in (row.scopes or []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=f"missing_scope:{required_scope}"
            )
        row.last_used_at = utcnow()
        user = (
            await db.execute(select(User).where(User.id == row.user_id))
        ).scalar_one_or_none()
        if user is None or user.disabled_at is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="user_inactive"
            )
        request.state.api_token_id = str(row.id)
        return user

    return _dep
