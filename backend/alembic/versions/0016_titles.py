"""titles + user_titles + per-user title columns on users

Revision ID: 0016_titles
Revises: 0015_food_full_nutrients
Create Date: 2026-05-19 00:00:00

Schema only. The 2,500-row title catalog is shipped as JSON and synced into
this table by a FastAPI lifespan hook, not by this migration.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0016_titles"
down_revision: str | None = "0015_food_full_nutrients"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "titles",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("slug", sa.String(120), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.String(500), nullable=False, server_default=""),
        sa.Column("category", sa.String(40), nullable=False),
        sa.Column("rarity", sa.String(20), nullable=False, server_default="common"),
        sa.Column("condition_kind", sa.String(60), nullable=False),
        sa.Column(
            "condition_params",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("opt_out_group", sa.String(20), nullable=True),
        sa.Column(
            "is_secret",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "rarity IN ('common','uncommon','rare','epic','legendary')",
            name="rarity",
        ),
        sa.CheckConstraint(
            "opt_out_group IS NULL OR opt_out_group IN ('weight_loss','bp')",
            name="opt_out_group",
        ),
    )
    op.create_index(
        "ix_titles_category_sort_order",
        "titles",
        ["category", "sort_order"],
    )
    op.create_index("ix_titles_condition_kind", "titles", ["condition_kind"])

    op.create_table(
        "user_titles",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "title_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("titles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "unlocked_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "acknowledged_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.UniqueConstraint("user_id", "title_id", name="uq_user_titles_user_id_title_id"),
    )
    op.create_index(
        "ix_user_titles_user_unlocked_at",
        "user_titles",
        ["user_id", sa.text("unlocked_at DESC")],
    )

    op.add_column(
        "users",
        sa.Column(
            "equipped_title_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("titles.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "title_hidden",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "weight_titles_opt_out",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "bp_titles_opt_out",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "titles_last_scan_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "titles_last_scan_at")
    op.drop_column("users", "bp_titles_opt_out")
    op.drop_column("users", "weight_titles_opt_out")
    op.drop_column("users", "title_hidden")
    op.drop_column("users", "equipped_title_id")
    op.drop_index("ix_user_titles_user_unlocked_at", table_name="user_titles")
    op.drop_table("user_titles")
    op.drop_index("ix_titles_condition_kind", table_name="titles")
    op.drop_index("ix_titles_category_sort_order", table_name="titles")
    op.drop_table("titles")
