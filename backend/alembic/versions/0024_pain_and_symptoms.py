"""pain & symptoms — catalog, entries, locations, symptom logs

Revision ID: 0024_pain_and_symptoms
Revises: 0023_period_entries
Create Date: 2026-07-17 00:30:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0024_pain_and_symptoms"
down_revision: str | None = "0023_period_entries"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_SEV = ("none", "mild", "moderate", "severe")
_SEV_IN = ", ".join(f"'{s}'" for s in _SEV)


def upgrade() -> None:
    op.create_table(
        "symptom_catalog",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_symptom_catalog_user", "symptom_catalog", ["user_id", "sort_order"]
    )

    op.create_table(
        "pain_entries",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("pain_level", sa.SmallInteger(), nullable=False),
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
        sa.CheckConstraint(
            "pain_level >= 0 AND pain_level <= 10", name="ck_pain_level_range"
        ),
    )
    op.create_index(
        "ix_pain_entries_user_occurred_at",
        "pain_entries",
        ["user_id", "occurred_at"],
    )

    op.create_table(
        "pain_locations",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "pain_entry_id",
            sa.BigInteger(),
            sa.ForeignKey("pain_entries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("region_key", sa.String(30), nullable=False),
        sa.UniqueConstraint("pain_entry_id", "region_key", name="uq_pain_location"),
    )
    op.create_index(
        "ix_pain_locations_pain_entry_id", "pain_locations", ["pain_entry_id"]
    )

    op.create_table(
        "symptom_logs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "pain_entry_id",
            sa.BigInteger(),
            sa.ForeignKey("pain_entries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "catalog_id",
            sa.BigInteger(),
            sa.ForeignKey("symptom_catalog.id"),
            nullable=False,
        ),
        sa.Column("severity", sa.String(10), nullable=False),
        sa.Column("duration_minutes", sa.SmallInteger(), nullable=True),
        sa.CheckConstraint(f"severity IN ({_SEV_IN})", name="ck_symptom_severity"),
        sa.CheckConstraint(
            "duration_minutes IS NULL OR duration_minutes >= 0",
            name="ck_symptom_duration",
        ),
    )
    op.create_index(
        "ix_symptom_logs_pain_entry_id", "symptom_logs", ["pain_entry_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_symptom_logs_pain_entry_id", table_name="symptom_logs")
    op.drop_table("symptom_logs")
    op.drop_index("ix_pain_locations_pain_entry_id", table_name="pain_locations")
    op.drop_table("pain_locations")
    op.drop_index("ix_pain_entries_user_occurred_at", table_name="pain_entries")
    op.drop_table("pain_entries")
    op.drop_index("ix_symptom_catalog_user", table_name="symptom_catalog")
    op.drop_table("symptom_catalog")
