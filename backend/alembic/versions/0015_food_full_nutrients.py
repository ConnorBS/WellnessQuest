"""food: per-serving nutrients + servings/grams snapshots

Adds the Canadian Nutrition Facts panel to food_entries and food_presets.
Nutrients live in a single JSONB column (keys whitelisted in Pydantic) so
new ones don't need migrations as Health Canada updates Schedule K. We
also snapshot `serving_g` / `serving_label` on each entry so editing a
preset's serving size later doesn't rewrite history.

Revision ID: 0015_food_full_nutrients
Revises: 0014_blood_pressure
Create Date: 2026-05-18 12:00:00
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0015_food_full_nutrients"
down_revision: str | None = "0014_blood_pressure"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "food_entries",
        sa.Column("servings", sa.Numeric(7, 3), nullable=True),
    )
    op.add_column(
        "food_entries",
        sa.Column("serving_g", sa.Numeric(8, 2), nullable=True),
    )
    op.add_column(
        "food_entries",
        sa.Column("serving_label", sa.String(64), nullable=True),
    )
    op.add_column(
        "food_entries",
        sa.Column("nutrients", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_check_constraint(
        "ck_food_entries_servings_range",
        "food_entries",
        "servings IS NULL OR (servings >= 0 AND servings <= 1000)",
    )
    op.create_check_constraint(
        "ck_food_entries_serving_g_range",
        "food_entries",
        "serving_g IS NULL OR (serving_g >= 0 AND serving_g <= 100000)",
    )

    op.add_column(
        "food_presets",
        sa.Column("serving_g", sa.Numeric(8, 2), nullable=True),
    )
    op.add_column(
        "food_presets",
        sa.Column("serving_label", sa.String(64), nullable=True),
    )
    op.add_column(
        "food_presets",
        sa.Column("nutrients", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_check_constraint(
        "ck_food_presets_serving_g_range",
        "food_presets",
        "serving_g IS NULL OR (serving_g >= 0 AND serving_g <= 100000)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_food_presets_serving_g_range", "food_presets", type_="check")
    op.drop_column("food_presets", "nutrients")
    op.drop_column("food_presets", "serving_label")
    op.drop_column("food_presets", "serving_g")

    op.drop_constraint("ck_food_entries_serving_g_range", "food_entries", type_="check")
    op.drop_constraint("ck_food_entries_servings_range", "food_entries", type_="check")
    op.drop_column("food_entries", "nutrients")
    op.drop_column("food_entries", "serving_label")
    op.drop_column("food_entries", "serving_g")
    op.drop_column("food_entries", "servings")
