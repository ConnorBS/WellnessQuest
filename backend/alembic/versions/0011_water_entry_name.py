"""water_entries.name for user-labelled water log entries

Revision ID: 0011_water_entry_name
Revises: 0010_food
Create Date: 2026-05-13 12:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0011_water_entry_name"
down_revision: str | None = "0010_food"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "water_entries",
        sa.Column("name", sa.String(60), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("water_entries", "name")
