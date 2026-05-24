"""user.show_raw_weight_delta column

Revision ID: 0020_weight_show_raw_delta
Revises: 0019_steps_sleep
Create Date: 2026-05-24 00:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0020_weight_show_raw_delta"
down_revision: str | None = "0019_steps_sleep"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "show_raw_weight_delta",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "show_raw_weight_delta")
