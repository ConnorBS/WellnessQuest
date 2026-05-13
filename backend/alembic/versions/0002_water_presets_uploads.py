"""water_presets and upload_files

Revision ID: 0002_water_presets_uploads
Revises: 0001_initial
Create Date: 2026-05-11 21:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002_water_presets_uploads"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "upload_files",
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
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(64), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_upload_files_user_id", "upload_files", ["user_id"])

    op.create_table(
        "water_presets",
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
        sa.Column("label", sa.String(60), nullable=False),
        sa.Column("volume_ml", sa.Integer(), nullable=False),
        sa.Column(
            "icon_kind",
            sa.String(10),
            nullable=False,
            server_default=sa.text("'none'"),
        ),
        sa.Column("icon_key", sa.String(64), nullable=True),
        sa.Column(
            "sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
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
        sa.CheckConstraint(
            "volume_ml > 0 AND volume_ml <= 5000",
            name="ck_water_presets_volume_range",
        ),
        sa.CheckConstraint(
            "icon_kind IN ('builtin','upload','none')",
            name="ck_water_presets_icon_kind",
        ),
    )
    op.create_index(
        "ix_water_presets_user_sort", "water_presets", ["user_id", "sort_order"]
    )


def downgrade() -> None:
    op.drop_index("ix_water_presets_user_sort", table_name="water_presets")
    op.drop_table("water_presets")
    op.drop_index("ix_upload_files_user_id", table_name="upload_files")
    op.drop_table("upload_files")
