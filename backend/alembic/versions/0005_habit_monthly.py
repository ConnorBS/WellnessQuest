"""habit monthly cadence + monthly_target column

Revision ID: 0005_habit_monthly
Revises: 0004_habits
Create Date: 2026-05-12 00:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005_habit_monthly"
down_revision: str | None = "0004_habits"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("habits", sa.Column("monthly_target", sa.Integer(), nullable=True))

    # Replace cadence_kind check with one that allows 'monthly'.
    op.drop_constraint("ck_habits_cadence_kind", "habits", type_="check")
    op.create_check_constraint(
        "ck_habits_cadence_kind",
        "habits",
        "cadence_kind IN ('daily','weekly','monthly','interval')",
    )

    op.create_check_constraint(
        "ck_habits_monthly_target_range",
        "habits",
        "(cadence_kind <> 'monthly') OR (monthly_target BETWEEN 1 AND 31)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_habits_monthly_target_range", "habits", type_="check")

    # Demote any monthly rows to weekly(1) so the old constraint accepts them.
    op.execute(
        "UPDATE habits SET cadence_kind='weekly', weekly_target=1, monthly_target=NULL "
        "WHERE cadence_kind='monthly'"
    )
    op.drop_constraint("ck_habits_cadence_kind", "habits", type_="check")
    op.create_check_constraint(
        "ck_habits_cadence_kind",
        "habits",
        "cadence_kind IN ('daily','weekly','interval')",
    )

    op.drop_column("habits", "monthly_target")
