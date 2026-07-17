"""period_entries — period day log (flow + symptoms)

Revision ID: 0023_period_entries
Revises: 0022_mood_entries
Create Date: 2026-07-17 00:20:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0023_period_entries"
down_revision: str | None = "0022_mood_entries"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_FLOWS = ("spotting", "light", "medium", "heavy")
_FLOW_IN = ", ".join(f"'{f}'" for f in _FLOWS)


def upgrade() -> None:
    op.create_table(
        "period_entries",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("flow", sa.String(10), nullable=False),
        sa.Column(
            "symptoms",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column("note", sa.String(500), nullable=True),
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
        sa.UniqueConstraint("user_id", "entry_date", name="uq_period_user_date"),
        sa.CheckConstraint(f"flow IN ({_FLOW_IN})", name="ck_period_flow"),
    )
    op.create_index(
        "ix_period_entries_user_date",
        "period_entries",
        ["user_id", "entry_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_period_entries_user_date", table_name="period_entries")
    op.drop_table("period_entries")
