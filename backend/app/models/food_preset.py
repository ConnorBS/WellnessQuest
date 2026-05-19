from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FoodPreset(Base):
    """User-defined quick-add foods. May reference an Open Food Facts product.

    Stores per-serving kcal/macros/nutrients plus the serving definition itself
    (`serving_g` + `serving_label`) so logging "2 servings" only needs the
    multiplier — the structural fields and the nutrient JSON are collapsed once
    at preset creation (whether from OFF, manual entry, or label OCR).
    """

    __tablename__ = "food_presets"
    __table_args__ = (
        CheckConstraint("kcal >= 0 AND kcal <= 20000", name="ck_food_presets_kcal_range"),
        CheckConstraint(
            "protein_g IS NULL OR (protein_g >= 0 AND protein_g <= 2000)",
            name="ck_food_presets_protein_range",
        ),
        CheckConstraint(
            "carbs_g IS NULL OR (carbs_g >= 0 AND carbs_g <= 2000)",
            name="ck_food_presets_carbs_range",
        ),
        CheckConstraint(
            "fat_g IS NULL OR (fat_g >= 0 AND fat_g <= 2000)",
            name="ck_food_presets_fat_range",
        ),
        CheckConstraint(
            "meal_type IS NULL OR meal_type IN ('breakfast','lunch','dinner','snack')",
            name="ck_food_presets_meal_type",
        ),
        CheckConstraint(
            "icon_kind IN ('builtin','upload','none')",
            name="ck_food_presets_icon_kind",
        ),
        CheckConstraint(
            "serving_g IS NULL OR (serving_g >= 0 AND serving_g <= 100000)",
            name="ck_food_presets_serving_g_range",
        ),
        Index("ix_food_presets_user_sort", "user_id", "sort_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True)
    kcal: Mapped[int] = mapped_column(Integer, nullable=False)
    protein_g: Mapped[Decimal | None] = mapped_column(Numeric(7, 2), nullable=True)
    carbs_g: Mapped[Decimal | None] = mapped_column(Numeric(7, 2), nullable=True)
    fat_g: Mapped[Decimal | None] = mapped_column(Numeric(7, 2), nullable=True)
    serving_g: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    serving_label: Mapped[str | None] = mapped_column(String(64), nullable=True)
    nutrients: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    meal_type: Mapped[str | None] = mapped_column(String(16), nullable=True)
    provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    provider_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    icon_kind: Mapped[str] = mapped_column(String(10), nullable=False, default="none")
    icon_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
