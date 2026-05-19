from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

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
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.food_recipe_ingredient import FoodRecipeIngredient


class FoodRecipe(Base):
    """User-defined multi-ingredient dish (MyFitnessPal-style).

    The recipe stores PRE-AGGREGATED totals (sum across its ingredients) so
    the list endpoint stays a single SELECT. Logging multiplies by
    `servings / yields_servings` and goes through `food_service.add()` so the
    resulting `food_entries` row gets XP, idempotency, and target-exceeded
    events identical to any other food log.
    """

    __tablename__ = "food_recipes"
    __table_args__ = (
        CheckConstraint(
            "yields_servings > 0 AND yields_servings <= 1000",
            name="ck_food_recipes_yields_range",
        ),
        CheckConstraint(
            "total_kcal >= 0 AND total_kcal <= 200000",
            name="ck_food_recipes_total_kcal_range",
        ),
        CheckConstraint(
            "total_protein_g IS NULL OR (total_protein_g >= 0 AND total_protein_g <= 200000)",
            name="ck_food_recipes_total_protein_range",
        ),
        CheckConstraint(
            "total_carbs_g IS NULL OR (total_carbs_g >= 0 AND total_carbs_g <= 200000)",
            name="ck_food_recipes_total_carbs_range",
        ),
        CheckConstraint(
            "total_fat_g IS NULL OR (total_fat_g >= 0 AND total_fat_g <= 200000)",
            name="ck_food_recipes_total_fat_range",
        ),
        CheckConstraint(
            "meal_type IS NULL OR meal_type IN ('breakfast','lunch','dinner','snack')",
            name="ck_food_recipes_meal_type",
        ),
        Index("ix_food_recipes_user_sort", "user_id", "sort_order"),
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
    yields_servings: Mapped[Decimal] = mapped_column(Numeric(7, 3), nullable=False)
    serving_label: Mapped[str | None] = mapped_column(String(64), nullable=True)
    total_kcal: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_protein_g: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    total_carbs_g: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    total_fat_g: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    total_nutrients: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    meal_type: Mapped[str | None] = mapped_column(String(16), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    ingredients: Mapped[list[FoodRecipeIngredient]] = relationship(
        "FoodRecipeIngredient",
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="FoodRecipeIngredient.position",
        lazy="selectin",
    )
