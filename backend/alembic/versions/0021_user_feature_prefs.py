"""user_feature_prefs — generic per-user feature enable/disable

Revision ID: 0021_user_feature_prefs
Revises: 0020_weight_show_raw_delta
Create Date: 2026-07-17 00:00:00

Backfills the two legacy per-card booleans (``show_weight_card`` /
``show_bp_card``) into override rows so any card a user had hidden stays hidden
under the new feature system. The legacy columns are left in place (vestigial)
and can be dropped in a later cleanup migration.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0021_user_feature_prefs"
down_revision: str | None = "0020_weight_show_raw_delta"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_feature_prefs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("feature_key", sa.String(40), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("user_id", "feature_key", name="uq_user_feature"),
    )
    op.create_index(
        "ix_user_feature_prefs_user_id",
        "user_feature_prefs",
        ["user_id"],
    )

    # Preserve existing hidden-card choices under the new feature system.
    op.execute(
        "INSERT INTO user_feature_prefs (user_id, feature_key, enabled) "
        "SELECT id, 'weight', false FROM users WHERE show_weight_card = false"
    )
    op.execute(
        "INSERT INTO user_feature_prefs (user_id, feature_key, enabled) "
        "SELECT id, 'blood_pressure', false FROM users WHERE show_bp_card = false"
    )


def downgrade() -> None:
    op.drop_index("ix_user_feature_prefs_user_id", table_name="user_feature_prefs")
    op.drop_table("user_feature_prefs")
