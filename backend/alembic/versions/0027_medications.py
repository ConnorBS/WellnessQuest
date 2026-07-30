"""medications — medication register + append-only change timeline

Revision ID: 0027_medications
Revises: 0026_user_feature_order
Create Date: 2026-07-30 00:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0027_medications"
down_revision: str | None = "0026_user_feature_order"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "medications",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("form", sa.String(20), nullable=True),
        sa.Column("reason", sa.String(200), nullable=True),
        sa.Column("prescriber", sa.String(120), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("started_on", sa.Date(), nullable=False),
        sa.Column("ended_on", sa.Date(), nullable=True),
        sa.Column("stopped_reason", sa.String(200), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
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
            "form IS NULL OR form IN ("
            "'tablet','capsule','liquid','injection','patch','inhaler',"
            "'cream','drops','spray','suppository','other')",
            name="ck_medication_form",
        ),
        sa.CheckConstraint(
            "ended_on IS NULL OR ended_on >= started_on", name="ck_medication_dates"
        ),
    )
    op.create_index("ix_medications_user", "medications", ["user_id", "sort_order"])
    op.create_index("ix_medications_user_ended", "medications", ["user_id", "ended_on"])

    op.create_table(
        "medication_changes",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "medication_id",
            sa.BigInteger(),
            sa.ForeignKey("medications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("effective_on", sa.Date(), nullable=False),
        sa.Column("dose_amount", sa.Numeric(10, 3), nullable=True),
        sa.Column("dose_unit", sa.String(20), nullable=True),
        sa.Column("frequency", sa.String(80), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "kind IN ('started','dose_change','schedule_change','paused',"
            "'resumed','stopped','note')",
            name="ck_medication_change_kind",
        ),
        sa.CheckConstraint(
            "dose_amount IS NULL OR dose_amount > 0", name="ck_medication_dose_positive"
        ),
    )
    op.create_index(
        "ix_medication_changes_med",
        "medication_changes",
        ["medication_id", "effective_on"],
    )
    op.create_index(
        "ix_medication_changes_user_date",
        "medication_changes",
        ["user_id", "effective_on"],
    )


def downgrade() -> None:
    op.drop_index("ix_medication_changes_user_date", table_name="medication_changes")
    op.drop_index("ix_medication_changes_med", table_name="medication_changes")
    op.drop_table("medication_changes")
    op.drop_index("ix_medications_user_ended", table_name="medications")
    op.drop_index("ix_medications_user", table_name="medications")
    op.drop_table("medications")
