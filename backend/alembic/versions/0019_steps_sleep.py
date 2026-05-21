"""steps_entries and sleep_entries

Revision ID: 0019_steps_sleep
Revises: 0018_food_unit
Create Date: 2026-05-13 12:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0019_steps_sleep"
down_revision: str | None = "0018_food_unit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "steps_entries",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("client_id", sa.String(120), nullable=True),
        sa.CheckConstraint(
            "count > 0 AND count <= 200000", name="ck_steps_entries_count_range"
        ),
        sa.UniqueConstraint("user_id", "client_id", name="uq_steps_entries_user_client"),
    )
    op.create_index(
        "ix_steps_entries_user_occurred_at",
        "steps_entries",
        ["user_id", "occurred_at"],
    )

    op.create_table(
        "sleep_entries",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("quality_score", sa.SmallInteger(), nullable=True),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("client_id", sa.String(120), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "duration_minutes > 0 AND duration_minutes <= 1440",
            name="ck_sleep_entries_duration_range",
        ),
        sa.CheckConstraint(
            "quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)",
            name="ck_sleep_entries_quality_range",
        ),
        sa.CheckConstraint(
            "ended_at > started_at", name="ck_sleep_entries_time_order"
        ),
        sa.UniqueConstraint("user_id", "client_id", name="uq_sleep_entries_user_client"),
    )
    op.create_index(
        "ix_sleep_entries_user_ended_at",
        "sleep_entries",
        ["user_id", "ended_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_sleep_entries_user_ended_at", table_name="sleep_entries")
    op.drop_table("sleep_entries")
    op.drop_index("ix_steps_entries_user_occurred_at", table_name="steps_entries")
    op.drop_table("steps_entries")
