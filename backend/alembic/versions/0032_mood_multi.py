"""mood_entries.mood -> moods[] (several feelings per check-in); note 500 -> 4000

Revision ID: 0032_mood_multi
Revises: 0031_reflux_entries
Create Date: 2026-10-16 00:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0032_mood_multi"
down_revision: str | None = "0031_reflux_entries"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_MOODS = (
    "happy",
    "joyful",
    "excited",
    "amused",
    "proud",
    "confident",
    "hopeful",
    "inspired",
    "motivated",
    "productive",
    "calm",
    "relaxed",
    "peaceful",
    "content",
    "grateful",
    "loved",
    "connected",
    "relieved",
    "sad",
    "lonely",
    "disappointed",
    "hurt",
    "grieving",
    "nostalgic",
    "anxious",
    "worried",
    "scared",
    "insecure",
    "stressed",
    "overwhelmed",
    "angry",
    "frustrated",
    "irritated",
    "resentful",
    "jealous",
    "ashamed",
    "guilty",
    "embarrassed",
    "tired",
    "low_energy",
    "restless",
    "bored",
    "confused",
    "numb",
)
_MOOD_IN = ", ".join(f"'{m}'" for m in _MOODS)
_MOOD_ARRAY = f"ARRAY[{_MOOD_IN}]::varchar[]"
_NOTE_MAX = 4000


def upgrade() -> None:
    op.add_column(
        "mood_entries",
        sa.Column("moods", postgresql.ARRAY(sa.String(20)), nullable=True),
    )
    op.execute("UPDATE mood_entries SET moods = ARRAY[mood]::varchar[]")
    op.alter_column("mood_entries", "moods", nullable=False)
    op.drop_constraint("ck_mood_value", "mood_entries", type_="check")
    op.drop_column("mood_entries", "mood")
    op.create_check_constraint(
        "ck_mood_values", "mood_entries", f"moods <@ {_MOOD_ARRAY}"
    )
    op.create_check_constraint(
        "ck_mood_values_nonempty", "mood_entries", "cardinality(moods) >= 1"
    )
    op.alter_column(
        "mood_entries",
        "note",
        type_=sa.String(_NOTE_MAX),
        existing_type=sa.String(500),
        existing_nullable=True,
    )


def downgrade() -> None:
    # Lossy: only the first (strongest) feeling survives, and notes are cut
    # back to 500 characters.
    op.execute("UPDATE mood_entries SET note = left(note, 500) WHERE length(note) > 500")
    op.alter_column(
        "mood_entries",
        "note",
        type_=sa.String(500),
        existing_type=sa.String(_NOTE_MAX),
        existing_nullable=True,
    )
    op.add_column(
        "mood_entries", sa.Column("mood", sa.String(20), nullable=True)
    )
    op.execute("UPDATE mood_entries SET mood = moods[1]")
    op.alter_column("mood_entries", "mood", nullable=False)
    op.drop_constraint("ck_mood_values_nonempty", "mood_entries", type_="check")
    op.drop_constraint("ck_mood_values", "mood_entries", type_="check")
    op.drop_column("mood_entries", "moods")
    op.create_check_constraint("ck_mood_value", "mood_entries", f"mood IN ({_MOOD_IN})")
