from __future__ import annotations

import uuid
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.food_recipe import FoodRecipe


class FoodRecipeIngredient(Base):
    """One ingredient in a recipe. Pre-multiplied snapshot (kcal/macros/nutrients
    already scaled for this quantity), matching `food_entries` doctrine.

    `quantity` + `unit` capture what the user typed so the edit-recipe screen
    can show "2 servings" or "15 g" verbatim rather than reverse-engineering
    it from raw grams.
    """

    __tablename__ = "food_recipe_ingredients"
    __table_args__ = (
        CheckConstraint("kcal >= 0 AND kcal <= 20000", name="ck_food_recipe_ing_kcal_range"),
        CheckConstraint(
            "protein_g IS NULL OR (protein_g >= 0 AND protein_g <= 2000)",
            name="ck_food_recipe_ing_protein_range",
        ),
        CheckConstraint(
            "carbs_g IS NULL OR (carbs_g >= 0 AND carbs_g <= 2000)",
            name="ck_food_recipe_ing_carbs_range",
        ),
        CheckConstraint(
            "fat_g IS NULL OR (fat_g >= 0 AND fat_g <= 2000)",
            name="ck_food_recipe_ing_fat_range",
        ),
        CheckConstraint(
            "quantity > 0 AND quantity <= 100000",
            name="ck_food_recipe_ing_quantity_range",
        ),
        CheckConstraint(
            "unit IN ('g','ml','serving')",
            name="ck_food_recipe_ing_unit",
        ),
        CheckConstraint(
            "serving_g IS NULL OR (serving_g >= 0 AND serving_g <= 100000)",
            name="ck_food_recipe_ing_serving_g_range",
        ),
        CheckConstraint("position >= 0", name="ck_food_recipe_ing_position_nonneg"),
        UniqueConstraint("recipe_id", "position", name="food_recipe_ing_position"),
        Index("ix_food_recipe_ing_recipe_position", "recipe_id", "position"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    recipe_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("food_recipes.id", ondelete="CASCADE"),
        nullable=False,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True)
    provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    provider_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    unit: Mapped[str] = mapped_column(String(8), nullable=False)
    serving_g: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    serving_label: Mapped[str | None] = mapped_column(String(64), nullable=True)
    kcal: Mapped[int] = mapped_column(Integer, nullable=False)
    protein_g: Mapped[Decimal | None] = mapped_column(Numeric(7, 2), nullable=True)
    carbs_g: Mapped[Decimal | None] = mapped_column(Numeric(7, 2), nullable=True)
    fat_g: Mapped[Decimal | None] = mapped_column(Numeric(7, 2), nullable=True)
    nutrients: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    recipe: Mapped[FoodRecipe] = relationship("FoodRecipe", back_populates="ingredients")
