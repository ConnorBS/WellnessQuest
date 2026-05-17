"""blood_pressure_entries + blood_pressure_targets + users.show_bp_card

Revision ID: 0014_blood_pressure
Revises: 0013_user_management
Create Date: 2026-05-17 00:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0014_blood_pressure"
down_revision: str | None = "0013_user_management"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "show_bp_card",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )

    op.create_table(
        "blood_pressure_entries",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("systolic", sa.SmallInteger(), nullable=False),
        sa.Column("diastolic", sa.SmallInteger(), nullable=False),
        sa.Column("pulse", sa.SmallInteger(), nullable=True),
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
        sa.CheckConstraint("systolic > 0 AND systolic < 300", name="ck_bp_systolic_range"),
        sa.CheckConstraint("diastolic > 0 AND diastolic < 200", name="ck_bp_diastolic_range"),
        sa.CheckConstraint(
            "pulse IS NULL OR (pulse > 0 AND pulse < 300)", name="ck_bp_pulse_range"
        ),
        sa.CheckConstraint("systolic > diastolic", name="ck_bp_systolic_gt_diastolic"),
    )
    op.create_index(
        "ix_blood_pressure_entries_user_occurred_at",
        "blood_pressure_entries",
        ["user_id", "occurred_at"],
    )

    op.create_table(
        "blood_pressure_targets",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("target_systolic", sa.SmallInteger(), nullable=True),
        sa.Column("target_diastolic", sa.SmallInteger(), nullable=True),
        sa.Column(
            "effective_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "(target_systolic IS NULL AND target_diastolic IS NULL) OR ("
            "target_systolic IS NOT NULL AND target_diastolic IS NOT NULL "
            "AND target_systolic > 0 AND target_systolic < 300 "
            "AND target_diastolic > 0 AND target_diastolic < 200 "
            "AND target_systolic > target_diastolic)",
            name="ck_bp_target_pair",
        ),
    )
    op.create_index(
        "ix_blood_pressure_targets_user_effective_at",
        "blood_pressure_targets",
        ["user_id", "effective_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_blood_pressure_targets_user_effective_at",
        table_name="blood_pressure_targets",
    )
    op.drop_table("blood_pressure_targets")
    op.drop_index(
        "ix_blood_pressure_entries_user_occurred_at",
        table_name="blood_pressure_entries",
    )
    op.drop_table("blood_pressure_entries")
    op.drop_column("users", "show_bp_card")
