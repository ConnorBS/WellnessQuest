from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, get_db
from app.features import FEATURES
from app.models.user import User
from app.schemas.feature import FeatureItem, FeaturePatchIn, FeaturesOut
from app.services import feature_service
from app.telemetry.recorder import audit

router = APIRouter(tags=["features"])


async def _features_out(db: AsyncSession, user: User) -> FeaturesOut:
    enabled = await feature_service.get_features(db, user.id)
    return FeaturesOut(
        features=[
            FeatureItem(key=f.key, label=f.label, enabled=enabled[f.key])
            for f in FEATURES
        ]
    )


@router.get("/features", response_model=FeaturesOut)
async def list_features(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> FeaturesOut:
    return await _features_out(db, user)


@router.patch("/features", response_model=FeaturesOut)
async def patch_features(
    payload: FeaturePatchIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> FeaturesOut:
    try:
        await feature_service.set_feature(db, user.id, payload.feature_key, payload.enabled)
    except feature_service.UnknownFeature as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="unknown_feature"
        ) from exc
    await audit(
        db,
        actor=f"user:{user.id}",
        action="user.features.update",
        user_id=user.id,
        meta={"feature_key": payload.feature_key, "enabled": payload.enabled},
    )
    return await _features_out(db, user)
