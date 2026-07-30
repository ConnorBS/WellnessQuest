from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.medication import Medication
from app.models.medication_change import MedicationChange
from app.models.user import User


class MedicationError(Exception):
    """Service-level rejection; `code` is returned verbatim as the 400 detail."""

    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


@dataclass(frozen=True)
class CurrentDose:
    dose_amount: Decimal | None
    dose_unit: str | None
    frequency: str | None


EMPTY_DOSE = CurrentDose(None, None, None)


def fold_current(changes: list[MedicationChange]) -> CurrentDose:
    """Fold a medication's timeline (any order) into its current dose/schedule.

    Each row carries only what changed, so we replay oldest → newest and carry
    the last non-null value of each field forward. `stopped` doesn't clear the
    dose: a past medication should still show what it was on when it ended.
    """
    amount: Decimal | None = None
    unit: str | None = None
    frequency: str | None = None
    for row in sorted(changes, key=lambda c: (c.effective_on, c.id)):
        if row.dose_amount is not None:
            amount = row.dose_amount
            # Unit belongs to the amount — a row that restates the dose without
            # a unit means the unit is unchanged, but a new amount never
            # inherits a *stale* unit from a later-cleared one.
            if row.dose_unit is not None:
                unit = row.dose_unit
        elif row.dose_unit is not None:
            unit = row.dose_unit
        if row.frequency is not None:
            frequency = row.frequency
    return CurrentDose(amount, unit, frequency)


async def list_medications(
    db: AsyncSession, *, user: User, status: str = "all"
) -> list[Medication]:
    """Active medications first (by sort_order), then past ones most-recently
    ended first."""
    stmt = select(Medication).where(Medication.user_id == user.id)
    if status == "active":
        stmt = stmt.where(Medication.ended_on.is_(None))
    elif status == "past":
        stmt = stmt.where(Medication.ended_on.is_not(None))
    # Active rows (ended_on IS NULL) sort first — the boolean is False for
    # them — then the past ones most-recently-ended first.
    stmt = stmt.order_by(
        Medication.ended_on.is_not(None),
        Medication.ended_on.desc(),
        Medication.sort_order,
        Medication.id,
    )
    return list((await db.execute(stmt)).scalars().all())


async def get_medication(
    db: AsyncSession, *, user: User, med_id: int
) -> Medication | None:
    return (
        await db.execute(
            select(Medication).where(
                Medication.id == med_id, Medication.user_id == user.id
            )
        )
    ).scalar_one_or_none()


async def list_changes(
    db: AsyncSession, *, user: User, med_id: int
) -> list[MedicationChange]:
    """Newest first — the order the detail page renders."""
    return list(
        (
            await db.execute(
                select(MedicationChange)
                .where(
                    MedicationChange.medication_id == med_id,
                    MedicationChange.user_id == user.id,
                )
                .order_by(
                    MedicationChange.effective_on.desc(), MedicationChange.id.desc()
                )
            )
        )
        .scalars()
        .all()
    )


async def current_doses(
    db: AsyncSession, *, user: User, med_ids: list[int]
) -> dict[int, CurrentDose]:
    """Folded current dose for many medications in one query — keeps the list
    endpoint at two round-trips regardless of how many medications a user has."""
    if not med_ids:
        return {}
    rows = (
        (
            await db.execute(
                select(MedicationChange).where(
                    MedicationChange.user_id == user.id,
                    MedicationChange.medication_id.in_(med_ids),
                )
            )
        )
        .scalars()
        .all()
    )
    by_med: dict[int, list[MedicationChange]] = {mid: [] for mid in med_ids}
    for row in rows:
        by_med[row.medication_id].append(row)
    return {mid: fold_current(changes) for mid, changes in by_med.items()}


async def change_counts(
    db: AsyncSession, *, user: User, med_ids: list[int]
) -> dict[int, int]:
    if not med_ids:
        return {}
    rows = (
        await db.execute(
            select(MedicationChange.medication_id, func.count())
            .where(
                MedicationChange.user_id == user.id,
                MedicationChange.medication_id.in_(med_ids),
            )
            .group_by(MedicationChange.medication_id)
        )
    ).all()
    counts: dict[int, int] = dict.fromkeys(med_ids, 0)
    counts.update({r[0]: r[1] for r in rows})
    return counts


async def history_feed(
    db: AsyncSession, *, user: User, limit: int = 50
) -> list[tuple[MedicationChange, str]]:
    """Every change across every medication, newest first, paired with the
    medication's name. This is the "what changed and when" view."""
    rows = (
        await db.execute(
            select(MedicationChange, Medication.name)
            .join(Medication, Medication.id == MedicationChange.medication_id)
            .where(MedicationChange.user_id == user.id)
            .order_by(MedicationChange.effective_on.desc(), MedicationChange.id.desc())
            .limit(limit)
        )
    ).all()
    return [(r[0], r[1]) for r in rows]


async def create(
    db: AsyncSession,
    *,
    user: User,
    name: str,
    today: date,
    form: str | None = None,
    reason: str | None = None,
    prescriber: str | None = None,
    notes: str | None = None,
    started_on: date | None = None,
    dose_amount: Decimal | None = None,
    dose_unit: str | None = None,
    frequency: str | None = None,
) -> Medication:
    """Create a medication plus its opening `started` change row."""
    start = started_on or today
    if start > today:
        raise MedicationError("future_date")
    existing = await list_medications(db, user=user)
    next_sort = 1 + max((m.sort_order for m in existing), default=-1)
    med = Medication(
        user_id=user.id,
        name=name.strip(),
        form=form,
        reason=reason,
        prescriber=prescriber,
        notes=notes,
        started_on=start,
        sort_order=next_sort,
    )
    db.add(med)
    await db.flush()
    db.add(
        MedicationChange(
            user_id=user.id,
            medication_id=med.id,
            kind="started",
            effective_on=start,
            dose_amount=dose_amount,
            dose_unit=dose_unit,
            frequency=frequency,
        )
    )
    await db.flush()
    return med


async def add_change(
    db: AsyncSession,
    *,
    user: User,
    med: Medication,
    kind: str,
    today: date,
    effective_on: date | None = None,
    dose_amount: Decimal | None = None,
    dose_unit: str | None = None,
    frequency: str | None = None,
    note: str | None = None,
) -> MedicationChange:
    on = effective_on or today
    if on > today:
        raise MedicationError("future_date")
    row = MedicationChange(
        user_id=user.id,
        medication_id=med.id,
        kind=kind,
        effective_on=on,
        dose_amount=dose_amount,
        dose_unit=dose_unit,
        frequency=frequency,
        note=note,
    )
    db.add(row)
    await db.flush()
    return row


async def stop(
    db: AsyncSession,
    *,
    user: User,
    med: Medication,
    today: date,
    ended_on: date | None = None,
    reason: str | None = None,
) -> Medication:
    """Move a medication to the past list and log the stop."""
    if med.ended_on is not None:
        raise MedicationError("already_stopped")
    end = ended_on or today
    if end > today:
        raise MedicationError("future_date")
    if end < med.started_on:
        raise MedicationError("ended_before_started")
    med.ended_on = end
    med.stopped_reason = reason
    db.add(
        MedicationChange(
            user_id=user.id,
            medication_id=med.id,
            kind="stopped",
            effective_on=end,
            note=reason,
        )
    )
    await db.flush()
    return med


async def resume(
    db: AsyncSession,
    *,
    user: User,
    med: Medication,
    today: date,
    effective_on: date | None = None,
    note: str | None = None,
) -> Medication:
    """Bring a stopped medication back to the active list. The `stopped` row
    stays in the timeline — that gap is the history the user came for."""
    if med.ended_on is None:
        raise MedicationError("not_stopped")
    on = effective_on or today
    if on > today:
        raise MedicationError("future_date")
    med.ended_on = None
    med.stopped_reason = None
    db.add(
        MedicationChange(
            user_id=user.id,
            medication_id=med.id,
            kind="resumed",
            effective_on=on,
            note=note,
        )
    )
    await db.flush()
    return med


async def delete_change(
    db: AsyncSession, *, user: User, med_id: int, change_id: int
) -> bool:
    """Drop a mistyped timeline row. The opening `started` row is protected —
    without it a medication has no dose history at all."""
    row = (
        await db.execute(
            select(MedicationChange).where(
                MedicationChange.id == change_id,
                MedicationChange.medication_id == med_id,
                MedicationChange.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    if row.kind == "started":
        raise MedicationError("cannot_delete_started")
    await db.delete(row)
    await db.flush()
    return True


async def delete_medication(db: AsyncSession, *, user: User, med: Medication) -> None:
    """Hard delete, cascading the timeline. For typos — stopping is the way to
    retire a medication you actually took."""
    await db.delete(med)
    await db.flush()


async def reorder(db: AsyncSession, *, user: User, ids: list[int]) -> None:
    rows = {m.id: m for m in await list_medications(db, user=user)}
    for index, mid in enumerate(ids):
        row = rows.get(mid)
        if row is not None:
            row.sort_order = index
    await db.flush()
