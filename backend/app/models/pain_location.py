from __future__ import annotations

from sqlalchemy import BigInteger, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PainLocation(Base):
    """A single tapped body region for a pain check-in."""

    __tablename__ = "pain_locations"
    __table_args__ = (
        UniqueConstraint("pain_entry_id", "region_key", name="uq_pain_location"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    pain_entry_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("pain_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    region_key: Mapped[str] = mapped_column(String(30), nullable=False)
