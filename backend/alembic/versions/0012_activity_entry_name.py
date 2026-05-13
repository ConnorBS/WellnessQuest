"""activity_entries.name for user-labelled activity log entries

Revision ID: 0012_activity_entry_name
Revises: 0011_water_entry_name
Create Date: 2026-05-13 13:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0012_activity_entry_name"
down_revision: str | None = "0011_water_entry_name"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "activity_entries",
        sa.Column("name", sa.String(60), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("activity_entries", "name")
