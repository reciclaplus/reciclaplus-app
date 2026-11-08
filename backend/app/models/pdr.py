"""Pickup point (PDR) model — mirrors the pdrs table.

A PDR belongs to a town and a barrio (neighborhood); its community comes from
the barrio. `category` is free text, validated against the town's list when set.
"""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, Identity, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.town import Neighborhood


class Pdr(Base):
    __tablename__ = "pdrs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # DB-generated identity; fetched via RETURNING on insert.
    internal_id: Mapped[int] = mapped_column(
        BigInteger, Identity(), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    category: Mapped[str] = mapped_column(String, nullable=False)
    town_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("towns.id", ondelete="RESTRICT"), nullable=False
    )
    neighborhood_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("neighborhoods.id", ondelete="RESTRICT"), nullable=False
    )
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    route_order: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    location: Mapped[Neighborhood] = relationship()
