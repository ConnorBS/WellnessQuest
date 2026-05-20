"""food: add unit column (g/ml) to entries and presets

Liquid foods labelled "Per 1 cup (250 mL)" used to be silently treated as
grams. Adds a nullable `unit` column to both `food_entries` and
`food_presets` so the same numeric `serving_g` storage can mean either
grams or millilitres depending on the unit. NULL is read as "g" for
back-compat with rows written before this column existed.

Revision ID: 0018_food_unit
Revises: 0017_food_recipes
Create Date: 2026-05-20 12:00:00
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0018_food_unit"
down_revision: str | None = "0017_food_recipes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "food_entries",
        sa.Column("unit", sa.String(2), nullable=True),
    )
    op.add_column(
        "food_presets",
        sa.Column("unit", sa.String(2), nullable=True),
    )
    op.create_check_constraint(
        "ck_food_entries_unit",
        "food_entries",
        "unit IS NULL OR unit IN ('g','ml')",
    )
    op.create_check_constraint(
        "ck_food_presets_unit",
        "food_presets",
        "unit IS NULL OR unit IN ('g','ml')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_food_presets_unit", "food_presets", type_="check")
    op.drop_constraint("ck_food_entries_unit", "food_entries", type_="check")
    op.drop_column("food_presets", "unit")
    op.drop_column("food_entries", "unit")
