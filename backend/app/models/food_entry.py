from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FoodEntry(Base):
    """Append-only food log. Today's kcal total is SUM grouped by user + day-in-tz.

    Macros are stored as already-multiplied gram values for the logged portion,
    not per-100g — the frontend does the per-serving math at log time.
    """

    __tablename__ = "food_entries"
    __table_args__ = (
        CheckConstraint("kcal >= 0 AND kcal <= 20000", name="ck_food_entries_kcal_range"),
        CheckConstraint(
            "protein_g IS NULL OR (protein_g >= 0 AND protein_g <= 2000)",
            name="ck_food_entries_protein_range",
        ),
        CheckConstraint(
            "carbs_g IS NULL OR (carbs_g >= 0 AND carbs_g <= 2000)",
            name="ck_food_entries_carbs_range",
        ),
        CheckConstraint(
            "fat_g IS NULL OR (fat_g >= 0 AND fat_g <= 2000)",
            name="ck_food_entries_fat_range",
        ),
        CheckConstraint(
            "meal_type IS NULL OR meal_type IN ('breakfast','lunch','dinner','snack')",
            name="ck_food_entries_meal_type",
        ),
        UniqueConstraint("user_id", "client_id", name="food_user_client"),
        Index("ix_food_entries_user_occurred_at", "user_id", "occurred_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True)
    kcal: Mapped[int] = mapped_column(Integer, nullable=False)
    protein_g: Mapped[Decimal | None] = mapped_column(Numeric(7, 2), nullable=True)
    carbs_g: Mapped[Decimal | None] = mapped_column(Numeric(7, 2), nullable=True)
    fat_g: Mapped[Decimal | None] = mapped_column(Numeric(7, 2), nullable=True)
    meal_type: Mapped[str | None] = mapped_column(String(16), nullable=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False)  # 'pwa' | 'ha' | 'manual'
    provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    provider_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    client_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
