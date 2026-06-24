"""Pydantic schemas for API request/response bodies."""

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

CollectionStatus = Literal["collected", "empty", "unavailable", "closed"]


class UserMe(BaseModel):
    """Current authenticated user, returned by GET /auth/me."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str | None
    role: str


# --- Towns (form options) ---

class NeighborhoodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class CommunityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    neighborhoods: list[NeighborhoodOut]


class TownSummary(BaseModel):
    """Lightweight town listing."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    map_center_lat: float
    map_center_lng: float


class TownDetail(TownSummary):
    """Full town config: categories + nested communities/neighborhoods."""

    categories: list[str]
    communities: list[CommunityOut]


# --- PDRs ---

class PdrCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None
    community: str = Field(min_length=1)
    neighborhood: str = Field(min_length=1)
    category: str = Field(min_length=1)
    lat: float
    lng: float


class PdrUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    community: str | None = None
    neighborhood: str | None = None
    category: str | None = None


class PdrOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    internal_id: int
    name: str
    description: str | None
    community: str
    neighborhood: str
    category: str
    lat: float
    lng: float
    created_at: datetime


class WeekStatus(BaseModel):
    year: int
    week: int
    status: CollectionStatus


class PdrWithHistory(PdrOut):
    recent_collections: list[WeekStatus] = []


# --- Collections (weekly pass) ---

class IsoWeek(BaseModel):
    """Current ISO year + week, for defaulting the collection pass page."""

    year: int
    week: int


class CollectionPassRow(BaseModel):
    """One PDR plus its recorded status for the requested week (None if not
    yet recorded)."""

    pdr_id: uuid.UUID
    internal_id: int
    name: str
    community: str
    neighborhood: str
    category: str
    route_order: int | None = None
    status: CollectionStatus | None


class CollectionEntry(BaseModel):
    """A single PDR's status submitted in a collection pass."""

    pdr_id: uuid.UUID
    status: CollectionStatus
    collected_at: Optional[datetime] = None


class CollectionPassSave(BaseModel):
    """Payload for saving a week's collection pass."""

    entries: list[CollectionEntry]


# --- Users & access management ---

Role = Literal["read", "write", "admin"]


class UserOut(BaseModel):
    """An active (provisioned) platform user."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str | None
    role: Role
    created_at: datetime


class UserCreate(BaseModel):
    """Create a user by email + role (active on first sign-in, matched by
    email)."""

    email: str = Field(min_length=3)
    name: str | None = None
    role: Role = "read"


class UserUpdate(BaseModel):
    """Update a user's role and/or name."""

    name: str | None = None
    role: Role


# --- Town configuration (admin write) ---

class TownWrite(BaseModel):
    name: str = Field(min_length=1)
    map_center_lat: float
    map_center_lng: float
    categories: list[str] = []


class NameWrite(BaseModel):
    """Create/rename a community or neighborhood."""

    name: str = Field(min_length=1)


# --- Weight entries ---

PlasticType = Literal["pet", "hdpe", "pp", "trash"]


class WeightEntryCreate(BaseModel):
    date: str = Field(description="ISO date string (YYYY-MM-DD)")
    plastic_type: PlasticType
    weight_lbs: float = Field(gt=0)


class WeightEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    date: datetime
    plastic_type: PlasticType
    weight_lbs: float
    created_by: uuid.UUID | None
    created_at: datetime
