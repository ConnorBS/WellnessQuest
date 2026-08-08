"""user.show_bp_category column

Revision ID: 0028_bp_show_category
Revises: 0027_medications
Create Date: 2026-08-08 00:00:00

Per-user toggle for the AHA category chip ("Normal" / "Stage 1" / …) rendered
next to blood pressure readings. Defaults to true so existing users see no
change.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0028_bp_show_category"
down_revision: str | None = "0027_medications"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "show_bp_category",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "show_bp_category")
