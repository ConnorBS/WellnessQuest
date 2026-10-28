"""users.ui_prefs: per-user appearance preferences (theme colours, card tints, hidden sections)

Revision ID: 0033_user_ui_prefs
Revises: 0032_mood_multi
Create Date: 2026-10-28 00:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0033_user_ui_prefs"
down_revision: str | None = "0032_mood_multi"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # One JSONB blob rather than a column per knob: the set of theme slots and
    # hideable sections is validated by app.schemas.ui_prefs, and adding a slot
    # there must not need a migration. `{}` means "all defaults".
    op.add_column(
        "users",
        sa.Column(
            "ui_prefs",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "ui_prefs")
