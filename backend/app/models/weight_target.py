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
    Numeric,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WeightTarget(Base):
    """Append-only weight target history.

    Each row records a target_kg value as of an `effective_at` timestamp. The
    user's "current" target is whichever row has the latest effective_at. A
    NULL target_kg represents an explicit "no target" state (the user opted
    out as of effective_at), distinct from "no row at all" (never set).
    """

    __tablename__ = "weight_targets"
    __table_args__ = (
        CheckConstraint(
            "target_kg IS NULL OR (target_kg > 0 AND target_kg < 1000)",
            name="ck_weight_target_range",
        ),
        Index(
            "ix_weight_targets_user_effective_at",
            "user_id",
            "effective_at",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    target_kg: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    effective_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
