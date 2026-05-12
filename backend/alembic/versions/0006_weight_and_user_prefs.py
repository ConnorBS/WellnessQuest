"""weight_entries + user dashboard prefs (show_weight_card, weight_unit)

Revision ID: 0006_weight_and_user_prefs
Revises: 0005_habit_monthly
Create Date: 2026-05-12 00:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0006_weight_and_user_prefs"
down_revision: str | None = "0005_habit_monthly"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "show_weight_card",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "weight_unit",
            sa.String(4),
            nullable=False,
            server_default=sa.text("'kg'"),
        ),
    )

    op.create_table(
        "weight_entries",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("weight_kg", sa.Numeric(6, 2), nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "weight_kg > 0 AND weight_kg < 1000", name="ck_weight_range"
        ),
    )
    op.create_index(
        "ix_weight_entries_user_occurred_at",
        "weight_entries",
        ["user_id", "occurred_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_weight_entries_user_occurred_at", table_name="weight_entries")
    op.drop_table("weight_entries")
    op.drop_column("users", "weight_unit")
    op.drop_column("users", "show_weight_card")
