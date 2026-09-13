"""intimacy_entries — sexual-activity log inside period tracking

Revision ID: 0030_intimacy_entries
Revises: 0029_journal
Create Date: 2026-09-13 00:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0030_intimacy_entries"
down_revision: str | None = "0029_journal"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_KINDS = ("partnered", "solo")
_PROTECTION = ("protected", "unprotected", "withdrawal", "unspecified")
_KIND_IN = ", ".join(f"'{k}'" for k in _KINDS)
_PROTECTION_IN = ", ".join(f"'{p}'" for p in _PROTECTION)


def upgrade() -> None:
    op.create_table(
        "intimacy_entries",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column(
            "protection",
            sa.String(16),
            nullable=False,
            server_default=sa.text("'unspecified'"),
        ),
        sa.Column(
            "tags",
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
        sa.CheckConstraint(f"kind IN ({_KIND_IN})", name="ck_intimacy_kind"),
        sa.CheckConstraint(
            f"protection IN ({_PROTECTION_IN})", name="ck_intimacy_protection"
        ),
    )
    op.create_index(
        "ix_intimacy_entries_user_date",
        "intimacy_entries",
        ["user_id", "entry_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_intimacy_entries_user_date", table_name="intimacy_entries")
    op.drop_table("intimacy_entries")
