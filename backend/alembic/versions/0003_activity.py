"""activity_entries and activity_presets

Revision ID: 0003_activity
Revises: 0002_water_presets_uploads
Create Date: 2026-05-12 00:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003_activity"
down_revision: str | None = "0002_water_presets_uploads"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "activity_entries",
        sa.Column(
            "id",
            sa.BigInteger(),
            primary_key=True,
            autoincrement=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("client_id", sa.String(120), nullable=True),
        sa.CheckConstraint(
            "minutes > 0 AND minutes <= 1440", name="minutes_range"
        ),
        sa.UniqueConstraint("user_id", "client_id", name="activity_user_client"),
    )
    op.create_index(
        "ix_activity_entries_user_occurred_at",
        "activity_entries",
        ["user_id", "occurred_at"],
    )

    op.create_table(
        "activity_presets",
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
        sa.Column("label", sa.String(60), nullable=False),
        sa.Column("minutes", sa.Integer(), nullable=False),
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
            "minutes > 0 AND minutes <= 1440",
            name="ck_activity_presets_minutes_range",
        ),
        sa.CheckConstraint(
            "icon_kind IN ('builtin','upload','none')",
            name="ck_activity_presets_icon_kind",
        ),
    )
    op.create_index(
        "ix_activity_presets_user_sort", "activity_presets", ["user_id", "sort_order"]
    )


def downgrade() -> None:
    op.drop_index("ix_activity_presets_user_sort", table_name="activity_presets")
    op.drop_table("activity_presets")
    op.drop_index("ix_activity_entries_user_occurred_at", table_name="activity_entries")
    op.drop_table("activity_entries")
