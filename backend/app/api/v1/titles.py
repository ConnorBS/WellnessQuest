from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.title import Title
from app.models.user import User
from app.models.user_title import UserTitle
from app.schemas.auth import MeOut
from app.schemas.title import CategorySummary, EquipTitleIn, TitleOut
from app.services import title_service
from app.telemetry.recorder import audit

router = APIRouter(prefix="/titles", tags=["titles"])


def _allowed_by_opt_out(title: Title, user: User) -> bool:
    return not (
        (title.opt_out_group == "weight_loss" and user.weight_titles_opt_out)
        or (title.opt_out_group == "bp" and user.bp_titles_opt_out)
    )


def _to_title_out(
    title: Title, ut: UserTitle | None
) -> TitleOut:
    return TitleOut(
        id=title.id,
        slug=title.slug,
        name=title.name,
        description=title.description,
        category=title.category,
        rarity=title.rarity,
        is_secret=title.is_secret,
        sort_order=title.sort_order,
        unlocked=ut is not None,
        unlocked_at=ut.unlocked_at if ut is not None else None,
        acknowledged_at=ut.acknowledged_at if ut is not None else None,
    )


@router.get("/categories", response_model=list[CategorySummary])
async def list_categories(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CategorySummary]:
    totals = await title_service.total_count_by_category(db, user)
    unlocked = await title_service.unlocked_count_by_category(db, user)
    return [
        CategorySummary(category=cat, total=total, unlocked=unlocked.get(cat, 0))
        for cat, total in sorted(totals.items())
    ]


@router.get("", response_model=list[TitleOut])
async def list_titles(
    category: str | None = Query(default=None, max_length=40),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TitleOut]:
    """Catalog browse, paginated within a category. Filters opted-out groups
    and hides secret titles the user hasn't unlocked yet."""
    unlocked_rows = (
        await db.execute(
            select(UserTitle).where(UserTitle.user_id == user.id)
        )
    ).scalars().all()
    unlocked_by_id = {ut.title_id: ut for ut in unlocked_rows}

    stmt = select(Title).where(Title.archived_at.is_(None))
    if category is not None:
        stmt = stmt.where(Title.category == category)
    stmt = stmt.order_by(Title.category, Title.sort_order, Title.name)
    all_titles = list((await db.execute(stmt)).scalars().all())

    visible: list[Title] = []
    for t in all_titles:
        if not _allowed_by_opt_out(t, user):
            continue
        if t.is_secret and t.id not in unlocked_by_id:
            continue
        visible.append(t)

    page = visible[offset : offset + limit]
    return [_to_title_out(t, unlocked_by_id.get(t.id)) for t in page]


@router.get("/unlocked", response_model=list[TitleOut])
async def list_unlocked(
    limit: int = Query(default=100, ge=1, le=500),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TitleOut]:
    stmt = (
        select(Title, UserTitle)
        .join(UserTitle, UserTitle.title_id == Title.id)
        .where(
            UserTitle.user_id == user.id,
            Title.archived_at.is_(None),
        )
        .order_by(UserTitle.unlocked_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [_to_title_out(title, ut) for title, ut in rows]


@router.post(
    "/{title_id}/acknowledge", status_code=status.HTTP_204_NO_CONTENT
)
async def acknowledge_title(
    title_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await title_service.acknowledge(db, user, title_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="not_unlocked"
        )


@router.patch("/equipped", response_model=MeOut)
async def patch_equipped(
    payload: EquipTitleIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> MeOut:
    try:
        await title_service.equip(db, user, payload.title_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="not_unlocked"
        ) from None
    await audit(
        db,
        actor=f"user:{user.id}",
        action="title.equip",
        user_id=user.id,
        target_type="title",
        target_id=str(payload.title_id) if payload.title_id is not None else None,
    )
    # Import here to avoid a circular import at module load (users.py also
    # imports title_service).
    from app.api.v1.users import _build_me_out

    return await _build_me_out(db, user)
