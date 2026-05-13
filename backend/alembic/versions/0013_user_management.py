"""user management: must_change_password + drop invites

Revision ID: 0013_user_management
Revises: 0012_activity_entry_name
Create Date: 2026-05-13 15:00:00

Adds users.must_change_password (default false) so admin-created accounts can
be forced to rotate their temporary password on first login, and drops the
invites table since invite-code signup is being replaced by admin-driven user
creation.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0013_user_management"
down_revision: str | None = "0012_activity_entry_name"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.drop_index("uq_invites_code_hash", table_name="invites")
    op.drop_table("invites")


def downgrade() -> None:
    op.create_table(
        "invites",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("email", postgresql.CITEXT(), nullable=True),
        sa.Column("code_hash", sa.Text(), nullable=False),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "consumed_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("uq_invites_code_hash", "invites", ["code_hash"], unique=True)

    op.drop_column("users", "must_change_password")
