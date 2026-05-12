from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WaterPreset(Base):
    __tablename__ = "water_presets"
    __table_args__ = (
        CheckConstraint(
            "volume_ml > 0 AND volume_ml <= 5000",
            name="ck_water_presets_volume_range",
        ),
        CheckConstraint(
            "icon_kind IN ('builtin','upload','none')",
            name="ck_water_presets_icon_kind",
        ),
        Index("ix_water_presets_user_sort", "user_id", "sort_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    label: Mapped[str] = mapped_column(String(60), nullable=False)
    volume_ml: Mapped[int] = mapped_column(Integer, nullable=False)
    icon_kind: Mapped[str] = mapped_column(String(10), nullable=False, default="none")
    icon_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
