"""user.weight_target_kg column

Revision ID: 0007_weight_target
Revises: 0006_weight_and_user_prefs
Create Date: 2026-05-12 00:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007_weight_target"
down_revision: str | None = "0006_weight_and_user_prefs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("weight_target_kg", sa.Numeric(6, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "weight_target_kg")
