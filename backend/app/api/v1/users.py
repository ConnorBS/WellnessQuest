from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.models.title import Title
from app.models.user import User
from app.schemas.auth import MeOut, MePatchIn
from app.schemas.title import TitleSummary
from app.schemas.ui_prefs import ui_prefs_from_row
from app.services import feature_service, title_service
from app.telemetry.recorder import audit

router = APIRouter(tags=["users"])


def _to_title_summary(title: Title) -> TitleSummary:
    return TitleSummary(
        id=title.id,
        slug=title.slug,
        name=title.name,
        description=title.description,
        rarity=title.rarity,
        category=title.category,
    )


async def _build_me_out(db: AsyncSession, user: User) -> MeOut:
    equipped = await title_service.equipped_title(db, user)
    pending = await title_service.pending_unlocks(db, user)
    pending_total = await title_service.count_pending_unlocks(db, user)
    features = await feature_service.get_features(db, user.id)
    return MeOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        xp_total=user.xp_total,
        level=user.level,
        timezone=user.timezone,
        show_weight_card=user.show_weight_card,
        show_bp_card=user.show_bp_card,
        weight_unit=user.weight_unit,
        must_change_password=user.must_change_password,
        equipped_title=_to_title_summary(equipped) if equipped is not None else None,
        title_hidden=user.title_hidden,
        weight_titles_opt_out=user.weight_titles_opt_out,
        bp_titles_opt_out=user.bp_titles_opt_out,
        show_raw_weight_delta=user.show_raw_weight_delta,
        show_bp_category=user.show_bp_category,
        features=features,
        feature_order=feature_service.effective_order(user),
        ui_prefs=ui_prefs_from_row(user.ui_prefs),
        pending_title_unlocks=[_to_title_summary(t) for t in pending],
        pending_title_unlocks_total=pending_total,
    )


@router.get("/me", response_model=MeOut)
async def get_me(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> MeOut:
    # Lazy retro-scan: when the user's last scan is missing or stale, look
    # for any newly-eligible titles (e.g. titles deployed since last visit,
    # or backfill on the first /me after this feature ships). The scan is
    # ~15 aggregate queries and a no-op when the catalog is empty.
    await title_service.maybe_scan(db, user)
    return await _build_me_out(db, user)


@router.patch("/me", response_model=MeOut)
async def patch_me(
    payload: MePatchIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> MeOut:
    if payload.show_weight_card is not None:
        user.show_weight_card = payload.show_weight_card
    if payload.show_bp_card is not None:
        user.show_bp_card = payload.show_bp_card
    if payload.weight_unit is not None:
        if payload.weight_unit not in ("kg", "lb"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="weight_unit must be 'kg' or 'lb'",
            )
        user.weight_unit = payload.weight_unit
    if payload.title_hidden is not None:
        user.title_hidden = payload.title_hidden
    if payload.weight_titles_opt_out is not None:
        # Turning an opt-out OFF makes newly-allowed titles eligible; force
        # a re-scan on next /me by clearing the last-scan cursor.
        if user.weight_titles_opt_out and not payload.weight_titles_opt_out:
            user.titles_last_scan_at = None
        user.weight_titles_opt_out = payload.weight_titles_opt_out
    if payload.bp_titles_opt_out is not None:
        if user.bp_titles_opt_out and not payload.bp_titles_opt_out:
            user.titles_last_scan_at = None
        user.bp_titles_opt_out = payload.bp_titles_opt_out
    if payload.show_raw_weight_delta is not None:
        user.show_raw_weight_delta = payload.show_raw_weight_delta
    if payload.show_bp_category is not None:
        user.show_bp_category = payload.show_bp_category
    if payload.ui_prefs is not None:
        user.ui_prefs = payload.ui_prefs.to_row()
    await db.flush()
    await audit(
        db,
        actor=f"user:{user.id}",
        action="user.preferences.update",
        user_id=user.id,
        meta=payload.model_dump(exclude_none=True),
    )
    return await _build_me_out(db, user)
