from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (
        # Postgres partial unique index: only one active goal per user+metric+period
        Index(
            "uq_goals_user_metric_period_active",
            "user_id",
            "metric",
            "period",
            unique=True,
            postgresql_where="active",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    metric: Mapped[str] = mapped_column(String(40), nullable=False)  # 'water_ml','weight_kg',...
    period: Mapped[str] = mapped_column(String(10), nullable=False)  # 'day' | 'week'
    target: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
