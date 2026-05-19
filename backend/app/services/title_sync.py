"""Idempotent upsert of the title catalog from JSON.

Reads `app/data/titles_catalog.json` (committed alongside the code) and
syncs each row into the `titles` table on every FastAPI startup. New
slugs are inserted; existing slugs get name/description/condition_params
updates; DB rows whose slug has disappeared from the JSON are
soft-archived (never hard-deleted, so existing `user_titles` rows remain
valid).

This is the only mechanism that populates the catalog in prod — there's no
admin endpoint and no migration data, intentionally. New titles ship as
code-deploys: the JSON file changes, the next deploy syncs, and users see
unlocks on their next `/me` retro-scan.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.title import Title
from app.services.time_utils import utcnow
from app.telemetry.logger import get_logger

log = get_logger(__name__)

DEFAULT_CATALOG_PATH = (
    Path(__file__).resolve().parent.parent / "data" / "titles_catalog.json"
)


def _load_catalog(path: Path | None = None) -> list[dict[str, Any]] | None:
    """Returns the catalog rows, or None if the file is absent.

    The distinction matters: a missing file means "nothing to do" (e.g.
    dev environment without a built catalog), whereas an empty array
    means "archive everything I have."
    """
    p = path or DEFAULT_CATALOG_PATH
    if not p.is_file():
        return None
    data: list[dict[str, Any]] = json.loads(p.read_text(encoding="utf-8"))
    return data


async def sync_catalog(
    db: AsyncSession, *, path: Path | None = None
) -> dict[str, int]:
    """Apply the JSON catalog to the `titles` table.

    - Insert rows whose slug doesn't yet exist.
    - Update mutable fields on existing rows (name, description,
      condition_params, etc.).
    - Set `archived_at` on DB rows whose slug is missing from the JSON.
    - Returns counts `{inserted, updated, archived}`.

    Safe to call repeatedly. A missing JSON file is a no-op.
    """
    catalog = _load_catalog(path)
    if catalog is None:
        return {"inserted": 0, "updated": 0, "archived": 0}

    existing_rows = list((await db.execute(select(Title))).scalars().all())
    by_slug = {t.slug: t for t in existing_rows}
    catalog_slugs = {row["slug"] for row in catalog}

    inserted = 0
    updated = 0
    now = utcnow()

    mutable_fields = (
        "name",
        "description",
        "category",
        "rarity",
        "condition_kind",
        "opt_out_group",
        "is_secret",
        "sort_order",
    )

    for row in catalog:
        existing = by_slug.get(row["slug"])
        if existing is None:
            db.add(
                Title(
                    slug=row["slug"],
                    name=row["name"],
                    description=row.get("description", ""),
                    category=row["category"],
                    rarity=row.get("rarity", "common"),
                    condition_kind=row["condition_kind"],
                    condition_params=row.get("condition_params") or {},
                    opt_out_group=row.get("opt_out_group"),
                    is_secret=row.get("is_secret", False),
                    sort_order=row.get("sort_order", 0),
                )
            )
            inserted += 1
            continue

        changed = False
        for field in mutable_fields:
            new_value = row.get(field, getattr(existing, field))
            if getattr(existing, field) != new_value:
                setattr(existing, field, new_value)
                changed = True
        new_params = row.get("condition_params") or {}
        if (existing.condition_params or {}) != new_params:
            existing.condition_params = new_params
            changed = True
        if existing.archived_at is not None:
            # JSON brought it back — unarchive.
            existing.archived_at = None
            changed = True
        if changed:
            updated += 1

    archived = 0
    for slug, existing in by_slug.items():
        if slug not in catalog_slugs and existing.archived_at is None:
            existing.archived_at = now
            archived += 1

    await db.flush()
    return {"inserted": inserted, "updated": updated, "archived": archived}


async def sync_catalog_at_startup() -> dict[str, int]:
    """Open a fresh session and call `sync_catalog`. Called from the
    FastAPI lifespan hook.

    Skipped when `WQ_DISABLE_TITLE_SYNC=1` is set (used by tests so each
    test starts with an empty catalog and seeds its own).
    """
    if os.environ.get("WQ_DISABLE_TITLE_SYNC") == "1":
        return {"inserted": 0, "updated": 0, "archived": 0, "skipped": 1}

    from app.db.session import async_session

    async with async_session() as session:
        try:
            result = await sync_catalog(session)
            await session.commit()
            log.info("title_catalog_synced", **result)
            return result
        except Exception as exc:  # noqa: BLE001
            await session.rollback()
            log.error("title_catalog_sync_failed", error=str(exc))
            # Don't crash the app on sync failure — the catalog can be
            # empty or partially populated and the app still works.
            return {"inserted": 0, "updated": 0, "archived": 0, "error": 1}
