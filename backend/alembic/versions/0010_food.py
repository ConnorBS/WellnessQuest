"""food_entries and food_presets

Revision ID: 0010_food
Revises: 0009_weight_targets
Create Date: 2026-05-12 15:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0010_food"
down_revision: str | None = "0009_weight_targets"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "food_entries",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("brand", sa.String(120), nullable=True),
        sa.Column("kcal", sa.Integer(), nullable=False),
        sa.Column("protein_g", sa.Numeric(7, 2), nullable=True),
        sa.Column("carbs_g", sa.Numeric(7, 2), nullable=True),
        sa.Column("fat_g", sa.Numeric(7, 2), nullable=True),
        sa.Column("meal_type", sa.String(16), nullable=True),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("provider", sa.String(32), nullable=True),
        sa.Column("provider_id", sa.String(64), nullable=True),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("client_id", sa.String(120), nullable=True),
        sa.CheckConstraint(
            "kcal >= 0 AND kcal <= 20000", name="ck_food_entries_kcal_range"
        ),
        sa.CheckConstraint(
            "protein_g IS NULL OR (protein_g >= 0 AND protein_g <= 2000)",
            name="ck_food_entries_protein_range",
        ),
        sa.CheckConstraint(
            "carbs_g IS NULL OR (carbs_g >= 0 AND carbs_g <= 2000)",
            name="ck_food_entries_carbs_range",
        ),
        sa.CheckConstraint(
            "fat_g IS NULL OR (fat_g >= 0 AND fat_g <= 2000)",
            name="ck_food_entries_fat_range",
        ),
        sa.CheckConstraint(
            "meal_type IS NULL OR meal_type IN ('breakfast','lunch','dinner','snack')",
            name="ck_food_entries_meal_type",
        ),
        sa.UniqueConstraint("user_id", "client_id", name="food_user_client"),
    )
    op.create_index(
        "ix_food_entries_user_occurred_at",
        "food_entries",
        ["user_id", "occurred_at"],
    )

    op.create_table(
        "food_presets",
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
        sa.Column("kcal", sa.Integer(), nullable=False),
        sa.Column("protein_g", sa.Numeric(7, 2), nullable=True),
        sa.Column("carbs_g", sa.Numeric(7, 2), nullable=True),
        sa.Column("fat_g", sa.Numeric(7, 2), nullable=True),
        sa.Column("meal_type", sa.String(16), nullable=True),
        sa.Column("provider", sa.String(32), nullable=True),
        sa.Column("provider_id", sa.String(64), nullable=True),
        sa.Column(
            "icon_kind",
            sa.String(10),
            nullable=False,
            server_default=sa.text("'none'"),
        ),
        sa.Column("icon_key", sa.String(64), nullable=True),
        sa.Column(
            "sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "kcal >= 0 AND kcal <= 20000", name="ck_food_presets_kcal_range"
        ),
        sa.CheckConstraint(
            "protein_g IS NULL OR (protein_g >= 0 AND protein_g <= 2000)",
            name="ck_food_presets_protein_range",
        ),
        sa.CheckConstraint(
            "carbs_g IS NULL OR (carbs_g >= 0 AND carbs_g <= 2000)",
            name="ck_food_presets_carbs_range",
        ),
        sa.CheckConstraint(
            "fat_g IS NULL OR (fat_g >= 0 AND fat_g <= 2000)",
            name="ck_food_presets_fat_range",
        ),
        sa.CheckConstraint(
            "meal_type IS NULL OR meal_type IN ('breakfast','lunch','dinner','snack')",
            name="ck_food_presets_meal_type",
        ),
        sa.CheckConstraint(
            "icon_kind IN ('builtin','upload','none')",
            name="ck_food_presets_icon_kind",
        ),
    )
    op.create_index(
        "ix_food_presets_user_sort", "food_presets", ["user_id", "sort_order"]
    )


def downgrade() -> None:
    op.drop_index("ix_food_presets_user_sort", table_name="food_presets")
    op.drop_table("food_presets")
    op.drop_index("ix_food_entries_user_occurred_at", table_name="food_entries")
    op.drop_table("food_entries")
