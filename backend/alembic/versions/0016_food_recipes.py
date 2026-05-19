"""food: recipes (multi-ingredient user-defined dishes)

Adds `food_recipes` and `food_recipe_ingredients`. Recipes pre-aggregate
their totals so the list endpoint stays a single SELECT; logging a recipe
multiplies totals by `servings / yields_servings` and writes a single
`food_entries` row via the existing `food_service.add()` path.

Revision ID: 0016_food_recipes
Revises: 0015_food_full_nutrients
Create Date: 2026-05-19 12:00:00
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0016_food_recipes"
down_revision: str | None = "0015_food_full_nutrients"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "food_recipes",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("brand", sa.String(120), nullable=True),
        sa.Column("yields_servings", sa.Numeric(7, 3), nullable=False),
        sa.Column("serving_label", sa.String(64), nullable=True),
        sa.Column("total_kcal", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_protein_g", sa.Numeric(8, 2), nullable=True),
        sa.Column("total_carbs_g", sa.Numeric(8, 2), nullable=True),
        sa.Column("total_fat_g", sa.Numeric(8, 2), nullable=True),
        sa.Column(
            "total_nutrients",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("meal_type", sa.String(16), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "yields_servings > 0 AND yields_servings <= 1000",
            name="ck_food_recipes_yields_range",
        ),
        sa.CheckConstraint(
            "total_kcal >= 0 AND total_kcal <= 200000",
            name="ck_food_recipes_total_kcal_range",
        ),
        sa.CheckConstraint(
            "total_protein_g IS NULL OR (total_protein_g >= 0 AND total_protein_g <= 200000)",
            name="ck_food_recipes_total_protein_range",
        ),
        sa.CheckConstraint(
            "total_carbs_g IS NULL OR (total_carbs_g >= 0 AND total_carbs_g <= 200000)",
            name="ck_food_recipes_total_carbs_range",
        ),
        sa.CheckConstraint(
            "total_fat_g IS NULL OR (total_fat_g >= 0 AND total_fat_g <= 200000)",
            name="ck_food_recipes_total_fat_range",
        ),
        sa.CheckConstraint(
            "meal_type IS NULL OR meal_type IN ('breakfast','lunch','dinner','snack')",
            name="ck_food_recipes_meal_type",
        ),
    )
    op.create_index(
        "ix_food_recipes_user_sort",
        "food_recipes",
        ["user_id", "sort_order"],
    )

    op.create_table(
        "food_recipe_ingredients",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "recipe_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("food_recipes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("brand", sa.String(120), nullable=True),
        sa.Column("provider", sa.String(32), nullable=True),
        sa.Column("provider_id", sa.String(64), nullable=True),
        sa.Column("quantity", sa.Numeric(10, 3), nullable=False),
        sa.Column("unit", sa.String(8), nullable=False),
        sa.Column("serving_g", sa.Numeric(8, 2), nullable=True),
        sa.Column("serving_label", sa.String(64), nullable=True),
        sa.Column("kcal", sa.Integer(), nullable=False),
        sa.Column("protein_g", sa.Numeric(7, 2), nullable=True),
        sa.Column("carbs_g", sa.Numeric(7, 2), nullable=True),
        sa.Column("fat_g", sa.Numeric(7, 2), nullable=True),
        sa.Column(
            "nutrients",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.CheckConstraint(
            "kcal >= 0 AND kcal <= 20000",
            name="ck_food_recipe_ing_kcal_range",
        ),
        sa.CheckConstraint(
            "protein_g IS NULL OR (protein_g >= 0 AND protein_g <= 2000)",
            name="ck_food_recipe_ing_protein_range",
        ),
        sa.CheckConstraint(
            "carbs_g IS NULL OR (carbs_g >= 0 AND carbs_g <= 2000)",
            name="ck_food_recipe_ing_carbs_range",
        ),
        sa.CheckConstraint(
            "fat_g IS NULL OR (fat_g >= 0 AND fat_g <= 2000)",
            name="ck_food_recipe_ing_fat_range",
        ),
        sa.CheckConstraint(
            "quantity > 0 AND quantity <= 100000",
            name="ck_food_recipe_ing_quantity_range",
        ),
        sa.CheckConstraint(
            "unit IN ('g','ml','serving')",
            name="ck_food_recipe_ing_unit",
        ),
        sa.CheckConstraint(
            "serving_g IS NULL OR (serving_g >= 0 AND serving_g <= 100000)",
            name="ck_food_recipe_ing_serving_g_range",
        ),
        sa.CheckConstraint("position >= 0", name="ck_food_recipe_ing_position_nonneg"),
        sa.UniqueConstraint(
            "recipe_id", "position", name="food_recipe_ing_position"
        ),
    )
    op.create_index(
        "ix_food_recipe_ing_recipe_position",
        "food_recipe_ingredients",
        ["recipe_id", "position"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_food_recipe_ing_recipe_position", table_name="food_recipe_ingredients"
    )
    op.drop_table("food_recipe_ingredients")
    op.drop_index("ix_food_recipes_user_sort", table_name="food_recipes")
    op.drop_table("food_recipes")
