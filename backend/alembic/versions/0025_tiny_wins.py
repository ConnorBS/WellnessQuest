"""tiny_wins — self-care checklist items + daily check-ins

Revision ID: 0025_tiny_wins
Revises: 0024_pain_and_symptoms
Create Date: 2026-07-17 00:40:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0025_tiny_wins"
down_revision: str | None = "0024_pain_and_symptoms"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tiny_win_items",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_tiny_win_items_user", "tiny_win_items", ["user_id", "sort_order"])

    op.create_table(
        "tiny_win_checkins",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "item_id",
            sa.BigInteger(),
            sa.ForeignKey("tiny_win_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("item_id", "entry_date", name="uq_tiny_win_checkin"),
    )
    op.create_index(
        "ix_tiny_win_checkins_user_date",
        "tiny_win_checkins",
        ["user_id", "entry_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_tiny_win_checkins_user_date", table_name="tiny_win_checkins")
    op.drop_table("tiny_win_checkins")
    op.drop_index("ix_tiny_win_items_user", table_name="tiny_win_items")
    op.drop_table("tiny_win_items")
