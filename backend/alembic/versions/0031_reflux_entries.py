"""reflux_entries — acid-reflux episode log (severity, time, trigger foods)

Revision ID: 0031_reflux_entries
Revises: 0030_intimacy_entries
Create Date: 2026-09-19 00:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0031_reflux_entries"
down_revision: str | None = "0030_intimacy_entries"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_SEVERITIES = ("mild", "moderate", "severe")
_SEVERITY_IN = ", ".join(f"'{s}'" for s in _SEVERITIES)


def upgrade() -> None:
    op.create_table(
        "reflux_entries",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("severity", sa.String(10), nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "triggers",
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
        sa.CheckConstraint(f"severity IN ({_SEVERITY_IN})", name="ck_reflux_severity"),
    )
    op.create_index(
        "ix_reflux_entries_user_occurred_at",
        "reflux_entries",
        ["user_id", "occurred_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_reflux_entries_user_occurred_at", table_name="reflux_entries")
    op.drop_table("reflux_entries")
