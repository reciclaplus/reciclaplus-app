"""Town configuration models — mirror the towns/communities/neighborhoods
tables. These drive the dropdown options on the PDR form.
"""

import uuid

from sqlalchemy import Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Town(Base):
    __tablename__ = "towns"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True
    )
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    map_center_lat: Mapped[float] = mapped_column(Float, nullable=False)
    map_center_lng: Mapped[float] = mapped_column(Float, nullable=False)
    categories: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list
    )

    communities: Mapped[list["Community"]] = relationship(
        back_populates="town", cascade="all, delete-orphan"
    )


class Community(Base):
    __tablename__ = "communities"
    __table_args__ = (UniqueConstraint("town_id", "name"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True
    )
    town_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("towns.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)

    town: Mapped["Town"] = relationship(back_populates="communities")
    neighborhoods: Mapped[list["Neighborhood"]] = relationship(
        back_populates="community", cascade="all, delete-orphan"
    )


class Neighborhood(Base):
    __tablename__ = "neighborhoods"
    __table_args__ = (UniqueConstraint("community_id", "name"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True
    )
    community_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("communities.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)

    community: Mapped["Community"] = relationship(back_populates="neighborhoods")
