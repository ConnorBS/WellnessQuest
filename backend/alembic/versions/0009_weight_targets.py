"""weight_targets history table; drop User.weight_target_kg

Revision ID: 0009_weight_targets
Revises: 0008_activity_exercise_type
Create Date: 2026-05-12 00:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0009_weight_targets"
down_revision: str | None = "0008_activity_exercise_type"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "weight_targets",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("target_kg", sa.Numeric(6, 2), nullable=True),
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
            "target_kg IS NULL OR (target_kg > 0 AND target_kg < 1000)",
            name="ck_weight_target_range",
        ),
    )
    op.create_index(
        "ix_weight_targets_user_effective_at",
        "weight_targets",
        ["user_id", "effective_at"],
    )

    # Copy any existing per-user target into the new history table so users
    # who already saved one don't lose it. Anchor effective_at to now() since
    # we don't have a "when was the target last changed" timestamp on User.
    op.execute(
        """
        INSERT INTO weight_targets (user_id, target_kg, effective_at, created_at)
        SELECT id, weight_target_kg, NOW(), NOW()
        FROM users
        WHERE weight_target_kg IS NOT NULL
        """
    )

    op.drop_column("users", "weight_target_kg")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("weight_target_kg", sa.Numeric(6, 2), nullable=True),
    )
    # Restore each user's latest known target value.
    op.execute(
        """
        UPDATE users u
        SET weight_target_kg = wt.target_kg
        FROM (
            SELECT DISTINCT ON (user_id) user_id, target_kg
            FROM weight_targets
            ORDER BY user_id, effective_at DESC
        ) wt
        WHERE u.id = wt.user_id
        """
    )
    op.drop_index("ix_weight_targets_user_effective_at", table_name="weight_targets")
    op.drop_table("weight_targets")
