"""mood_entries — timestamped mood + energy check-ins

Revision ID: 0022_mood_entries
Revises: 0021_user_feature_prefs
Create Date: 2026-07-17 00:10:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0022_mood_entries"
down_revision: str | None = "0021_user_feature_prefs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_MOODS = (
    "happy",
    "calm",
    "excited",
    "motivated",
    "relaxed",
    "grateful",
    "productive",
    "tired",
    "sad",
    "stressed",
    "anxious",
    "overwhelmed",
    "frustrated",
    "low_energy",
    "angry",
)
_MOOD_IN = ", ".join(f"'{m}'" for m in _MOODS)


def upgrade() -> None:
    op.create_table(
        "mood_entries",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("mood", sa.String(20), nullable=False),
        sa.Column("energy", sa.SmallInteger(), nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(f"mood IN ({_MOOD_IN})", name="ck_mood_value"),
        sa.CheckConstraint("energy >= 1 AND energy <= 3", name="ck_mood_energy_range"),
    )
    op.create_index(
        "ix_mood_entries_user_occurred_at",
        "mood_entries",
        ["user_id", "occurred_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_mood_entries_user_occurred_at", table_name="mood_entries")
    op.drop_table("mood_entries")
