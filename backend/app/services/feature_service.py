from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features import FEATURE_KEYS, default_features
from app.models.user_feature_pref import UserFeaturePref


class UnknownFeature(Exception):
    """Raised when a feature key is not in the registry."""

    def __init__(self, key: str) -> None:
        self.key = key
        super().__init__(f"unknown feature: {key}")


async def get_features(db: AsyncSession, user_id: uuid.UUID) -> dict[str, bool]:
    """Return every feature key mapped to its effective enabled state for a user.

    Registry defaults merged with the user's sparse override rows. Stale override
    rows for keys no longer in the registry are ignored.
    """
    result = default_features()
    rows = (
        await db.execute(
            select(UserFeaturePref).where(UserFeaturePref.user_id == user_id)
        )
    ).scalars().all()
    for row in rows:
        if row.feature_key in result:
            result[row.feature_key] = row.enabled
    return result


async def set_feature(
    db: AsyncSession, user_id: uuid.UUID, key: str, enabled: bool
) -> None:
    """Upsert a user's override for one feature. Raises UnknownFeature on bad key."""
    if key not in FEATURE_KEYS:
        raise UnknownFeature(key)
    row = (
        await db.execute(
            select(UserFeaturePref).where(
                UserFeaturePref.user_id == user_id,
                UserFeaturePref.feature_key == key,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        db.add(UserFeaturePref(user_id=user_id, feature_key=key, enabled=enabled))
    else:
        row.enabled = enabled
    await db.flush()
