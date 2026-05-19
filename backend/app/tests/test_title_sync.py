from __future__ import annotations

import json
from pathlib import Path

import pytest
from sqlalchemy import select

from app.models.title import Title
from app.services.title_sync import sync_catalog


def _write_catalog(tmp_path: Path, rows: list[dict]) -> Path:
    tmp_path.mkdir(parents=True, exist_ok=True)
    p = tmp_path / "catalog.json"
    p.write_text(json.dumps(rows), encoding="utf-8")
    return p


@pytest.mark.asyncio
async def test_sync_inserts_new_rows(db, tmp_path):
    path = _write_catalog(
        tmp_path,
        [
            {
                "slug": "alpha",
                "name": "Alpha",
                "description": "First.",
                "category": "test",
                "rarity": "common",
                "condition_kind": "signup",
                "condition_params": {},
                "opt_out_group": None,
                "is_secret": False,
                "sort_order": 0,
            }
        ],
    )
    result = await sync_catalog(db, path=path)
    await db.commit()
    assert result == {"inserted": 1, "updated": 0, "archived": 0}
    row = (
        await db.execute(select(Title).where(Title.slug == "alpha"))
    ).scalar_one()
    assert row.name == "Alpha"


@pytest.mark.asyncio
async def test_sync_is_idempotent(db, tmp_path):
    path = _write_catalog(
        tmp_path,
        [
            {
                "slug": "iso",
                "name": "Idempotent",
                "category": "test",
                "rarity": "common",
                "condition_kind": "signup",
            }
        ],
    )
    await sync_catalog(db, path=path)
    await db.commit()
    result = await sync_catalog(db, path=path)
    await db.commit()
    assert result == {"inserted": 0, "updated": 0, "archived": 0}


@pytest.mark.asyncio
async def test_sync_updates_existing_rows(db, tmp_path):
    path1 = _write_catalog(
        tmp_path / "v1",
        [
            {
                "slug": "upd",
                "name": "Original Name",
                "category": "test",
                "rarity": "common",
                "condition_kind": "level",
                "condition_params": {"threshold": 5},
            }
        ],
    )
    await sync_catalog(db, path=path1)
    await db.commit()

    path2 = _write_catalog(
        tmp_path / "v2",
        [
            {
                "slug": "upd",
                "name": "New Name",
                "category": "test",
                "rarity": "rare",
                "condition_kind": "level",
                "condition_params": {"threshold": 10},
            }
        ],
    )
    result = await sync_catalog(db, path=path2)
    await db.commit()
    assert result == {"inserted": 0, "updated": 1, "archived": 0}
    row = (
        await db.execute(select(Title).where(Title.slug == "upd"))
    ).scalar_one()
    assert row.name == "New Name"
    assert row.rarity == "rare"
    assert row.condition_params == {"threshold": 10}


@pytest.mark.asyncio
async def test_sync_archives_missing_rows(db, tmp_path):
    path1 = _write_catalog(
        tmp_path / "v1",
        [
            {"slug": "keep", "name": "Keep", "category": "t", "condition_kind": "signup"},
            {"slug": "retire", "name": "Retire", "category": "t", "condition_kind": "signup"},
        ],
    )
    await sync_catalog(db, path=path1)
    await db.commit()

    path2 = _write_catalog(
        tmp_path / "v2",
        [{"slug": "keep", "name": "Keep", "category": "t", "condition_kind": "signup"}],
    )
    result = await sync_catalog(db, path=path2)
    await db.commit()
    assert result["archived"] == 1
    retired = (
        await db.execute(select(Title).where(Title.slug == "retire"))
    ).scalar_one()
    assert retired.archived_at is not None
    kept = (
        await db.execute(select(Title).where(Title.slug == "keep"))
    ).scalar_one()
    assert kept.archived_at is None


@pytest.mark.asyncio
async def test_sync_unarchives_revived_slug(db, tmp_path):
    path1 = _write_catalog(
        tmp_path / "v1",
        [{"slug": "x", "name": "X", "category": "t", "condition_kind": "signup"}],
    )
    await sync_catalog(db, path=path1)
    await db.commit()
    path2 = _write_catalog(tmp_path / "v2", [])
    await sync_catalog(db, path=path2)
    await db.commit()
    archived = (
        await db.execute(select(Title).where(Title.slug == "x"))
    ).scalar_one()
    assert archived.archived_at is not None

    path3 = _write_catalog(
        tmp_path / "v3",
        [{"slug": "x", "name": "X-revived", "category": "t", "condition_kind": "signup"}],
    )
    await sync_catalog(db, path=path3)
    await db.commit()
    row = (
        await db.execute(select(Title).where(Title.slug == "x"))
    ).scalar_one()
    assert row.archived_at is None
    assert row.name == "X-revived"


@pytest.mark.asyncio
async def test_sync_missing_file_is_noop(db, tmp_path):
    result = await sync_catalog(db, path=tmp_path / "does_not_exist.json")
    assert result == {"inserted": 0, "updated": 0, "archived": 0}


@pytest.mark.asyncio
async def test_real_catalog_loads(db):
    """Sanity check: the committed catalog at app/data/titles_catalog.json
    actually parses and applies. The catalog dropped from ~2,500 generic
    tier titles to ~500 curated + rank-backfill ones in the May 2026
    rework; floor is set at 300 to catch a real curated regression
    without rejecting reasonable resizes."""
    result = await sync_catalog(db)
    await db.commit()
    assert result["inserted"] >= 300
    assert result["updated"] == 0
    assert result["archived"] == 0
