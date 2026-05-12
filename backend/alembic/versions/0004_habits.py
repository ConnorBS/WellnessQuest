"""habits and habit_checkins

Revision ID: 0004_habits
Revises: 0003_activity
Create Date: 2026-05-12 00:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004_habits"
down_revision: str | None = "0003_activity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "habits",
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
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column(
            "icon_kind",
            sa.String(10),
            nullable=False,
            server_default=sa.text("'none'"),
        ),
        sa.Column("icon_key", sa.String(64), nullable=True),
        sa.Column("cadence_kind", sa.String(10), nullable=False),
        sa.Column("weekly_target", sa.Integer(), nullable=True),
        sa.Column("interval_days", sa.Integer(), nullable=True),
        sa.Column(
            "sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
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
            "cadence_kind IN ('daily','weekly','interval')",
            name="ck_habits_cadence_kind",
        ),
        sa.CheckConstraint(
            "icon_kind IN ('builtin','upload','none')",
            name="ck_habits_icon_kind",
        ),
        sa.CheckConstraint(
            "(cadence_kind <> 'weekly') OR (weekly_target BETWEEN 1 AND 7)",
            name="ck_habits_weekly_target_range",
        ),
        sa.CheckConstraint(
            "(cadence_kind <> 'interval') OR (interval_days BETWEEN 2 AND 365)",
            name="ck_habits_interval_days_range",
        ),
    )
    op.create_index("ix_habits_user_sort", "habits", ["user_id", "sort_order"])

    op.create_table(
        "habit_checkins",
        sa.Column(
            "id", sa.BigInteger(), primary_key=True, autoincrement=True
        ),
        sa.Column(
            "habit_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("habits.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("habit_id", "occurred_on", name="uq_habit_checkin_day"),
    )
    op.create_index(
        "ix_habit_checkins_user_occurred_on",
        "habit_checkins",
        ["user_id", "occurred_on"],
    )
    op.create_index(
        "ix_habit_checkins_habit_occurred_on",
        "habit_checkins",
        ["habit_id", "occurred_on"],
    )


def downgrade() -> None:
    op.drop_index("ix_habit_checkins_habit_occurred_on", table_name="habit_checkins")
    op.drop_index("ix_habit_checkins_user_occurred_on", table_name="habit_checkins")
    op.drop_table("habit_checkins")
    op.drop_index("ix_habits_user_sort", table_name="habits")
    op.drop_table("habits")
