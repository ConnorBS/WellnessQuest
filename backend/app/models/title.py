from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Title(Base):
    """Global catalog of unlockable titles.

    Rows are synced from `app/data/titles_catalog.json` at FastAPI startup.
    Never hard-deleted: retired titles get `archived_at` set so existing
    `user_titles` rows remain valid.
    """

    __tablename__ = "titles"
    __table_args__ = (
        CheckConstraint(
            "rarity IN ('common','uncommon','rare','epic','legendary')",
            name="rarity",
        ),
        CheckConstraint(
            "opt_out_group IS NULL OR opt_out_group IN ('weight_loss','bp')",
            name="opt_out_group",
        ),
        Index("ix_titles_category_sort_order", "category", "sort_order"),
        Index("ix_titles_condition_kind", "condition_kind"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    rarity: Mapped[str] = mapped_column(String(20), nullable=False, default="common")
    condition_kind: Mapped[str] = mapped_column(String(60), nullable=False)
    condition_params: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    opt_out_group: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_secret: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
