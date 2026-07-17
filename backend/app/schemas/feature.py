from __future__ import annotations

from pydantic import BaseModel


class FeatureItem(BaseModel):
    key: str
    label: str
    enabled: bool


class FeaturesOut(BaseModel):
    features: list[FeatureItem]


class FeaturePatchIn(BaseModel):
    feature_key: str
    enabled: bool


class FeatureOrderIn(BaseModel):
    order: list[str]
