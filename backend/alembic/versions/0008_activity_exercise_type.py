"""activity exercise_type column

Revision ID: 0008_activity_exercise_type
Revises: 0007_weight_target
Create Date: 2026-05-12 00:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008_activity_exercise_type"
down_revision: str | None = "0007_weight_target"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "activity_entries",
        sa.Column("exercise_type", sa.String(60), nullable=True),
    )
    op.add_column(
        "activity_presets",
        sa.Column("exercise_type", sa.String(60), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("activity_presets", "exercise_type")
    op.drop_column("activity_entries", "exercise_type")
