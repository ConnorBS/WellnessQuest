from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pain_entry import PainEntry
from app.models.pain_location import PainLocation
from app.models.symptom_catalog import SymptomCatalog
from app.models.symptom_log import SymptomLog
from app.models.user import User
from app.schemas.pain import SymptomLogIn
from app.services.time_utils import utcnow


class InvalidPain(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


# --- symptom catalog -------------------------------------------------------

async def list_catalog(
    db: AsyncSession, *, user: User, include_archived: bool = False
) -> list[SymptomCatalog]:
    stmt = select(SymptomCatalog).where(SymptomCatalog.user_id == user.id)
    if not include_archived:
        stmt = stmt.where(SymptomCatalog.archived_at.is_(None))
    stmt = stmt.order_by(SymptomCatalog.sort_order, SymptomCatalog.id)
    return list((await db.execute(stmt)).scalars().all())


async def catalog_names(db: AsyncSession, *, user: User) -> dict[int, str]:
    """id -> name for ALL of the user's catalog rows (archived included), so
    historical symptom logs still render a name."""
    rows = (
        await db.execute(
            select(SymptomCatalog).where(SymptomCatalog.user_id == user.id)
        )
    ).scalars().all()
    return {r.id: r.name for r in rows}


async def add_catalog(db: AsyncSession, *, user: User, name: str) -> SymptomCatalog:
    # Append at the end.
    existing = await list_catalog(db, user=user, include_archived=True)
    next_sort = 1 + max((r.sort_order for r in existing), default=-1)
    row = SymptomCatalog(user_id=user.id, name=name.strip(), sort_order=next_sort)
    db.add(row)
    await db.flush()
    return row


async def rename_catalog(
    db: AsyncSession, *, user: User, catalog_id: int, name: str
) -> SymptomCatalog | None:
    row = await _get_catalog(db, user=user, catalog_id=catalog_id)
    if row is None:
        return None
    row.name = name.strip()
    await db.flush()
    return row


async def archive_catalog(
    db: AsyncSession, *, user: User, catalog_id: int
) -> bool:
    row = await _get_catalog(db, user=user, catalog_id=catalog_id)
    if row is None or row.archived_at is not None:
        return False
    row.archived_at = utcnow()
    await db.flush()
    return True


async def reorder_catalog(
    db: AsyncSession, *, user: User, ids: list[int]
) -> None:
    rows = {r.id: r for r in await list_catalog(db, user=user, include_archived=True)}
    for index, cid in enumerate(ids):
        row = rows.get(cid)
        if row is not None:
            row.sort_order = index
    await db.flush()


async def _get_catalog(
    db: AsyncSession, *, user: User, catalog_id: int
) -> SymptomCatalog | None:
    return (
        await db.execute(
            select(SymptomCatalog).where(
                SymptomCatalog.id == catalog_id,
                SymptomCatalog.user_id == user.id,
            )
        )
    ).scalar_one_or_none()


# --- pain entries ----------------------------------------------------------

async def add_entry(
    db: AsyncSession,
    *,
    user: User,
    pain_level: int,
    occurred_at: datetime | None,
    note: str | None,
    locations: list[str],
    symptoms: list[SymptomLogIn],
) -> PainEntry:
    if symptoms:
        wanted = {s.catalog_id for s in symptoms}
        found = {
            r.id
            for r in (
                await db.execute(
                    select(SymptomCatalog).where(
                        SymptomCatalog.user_id == user.id,
                        SymptomCatalog.id.in_(wanted),
                        SymptomCatalog.archived_at.is_(None),
                    )
                )
            ).scalars()
        }
        if wanted - found:
            raise InvalidPain("unknown_symptom")

    entry = PainEntry(
        user_id=user.id,
        pain_level=pain_level,
        occurred_at=occurred_at or utcnow(),
        note=(note.strip() or None) if isinstance(note, str) else note,
    )
    # De-dup tapped regions while keeping order stable.
    seen: set[str] = set()
    for region in locations:
        if region not in seen:
            seen.add(region)
            entry.locations.append(PainLocation(region_key=region))
    for s in symptoms:
        entry.symptoms.append(
            SymptomLog(
                catalog_id=s.catalog_id,
                severity=s.severity,
                duration_minutes=s.duration_minutes,
            )
        )
    db.add(entry)
    await db.flush()
    return entry


async def latest(db: AsyncSession, *, user: User) -> PainEntry | None:
    return (
        await db.execute(
            select(PainEntry)
            .where(PainEntry.user_id == user.id)
            .order_by(PainEntry.occurred_at.desc(), PainEntry.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def list_history(
    db: AsyncSession, *, user: User, limit: int = 90
) -> list[PainEntry]:
    return list(
        (
            await db.execute(
                select(PainEntry)
                .where(PainEntry.user_id == user.id)
                .order_by(PainEntry.occurred_at.desc(), PainEntry.id.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )


async def delete_entry(db: AsyncSession, *, user: User, entry_id: int) -> bool:
    row = (
        await db.execute(
            select(PainEntry).where(
                PainEntry.id == entry_id, PainEntry.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    await db.delete(row)
    return True
