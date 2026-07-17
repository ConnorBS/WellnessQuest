"""users.feature_order — user-chosen dashboard card order

Revision ID: 0026_user_feature_order
Revises: 0025_tiny_wins
Create Date: 2026-07-17 00:50:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0026_user_feature_order"
down_revision: str | None = "0025_tiny_wins"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("feature_order", postgresql.ARRAY(sa.String()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "feature_order")
