"""Pydantic schemas for API request/response bodies."""

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

CollectionStatus = Literal["collected", "empty", "unavailable", "closed"]


class UserTown(BaseModel):
    """A town the caller can access, with their role there."""

    id: uuid.UUID
    name: str
    role: str


class UserMe(BaseModel):
    """Current authenticated user, returned by GET /auth/me."""

    id: uuid.UUID
    email: str
    name: str | None
    is_superadmin: bool
    towns: list[UserTown]


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
    map_zoom: int
    archived_at: datetime | None = None


class TownDetail(TownSummary):
    """Full town config: settings + nested communities/neighborhoods."""

    categories: list[str]
    plastic_types: list[str]
    report_partner_text: str | None
    communities: list[CommunityOut]


# --- PDRs ---

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
    town_id: uuid.UUID
    neighborhood_id: uuid.UUID
    community_id: uuid.UUID


class TownPdrCreate(BaseModel):
    """Create a PDR in a town. Its community comes from the neighborhood."""

    name: str = Field(min_length=1)
    description: str | None = None
    neighborhood_id: uuid.UUID
    category: str = Field(min_length=1)
    lat: float
    lng: float


class TownPdrUpdate(BaseModel):
    """Partial PDR update: omitted fields are left unchanged."""

    name: str | None = Field(default=None, min_length=1)
    description: str | None = None
    neighborhood_id: uuid.UUID | None = None
    category: str | None = Field(default=None, min_length=1)
    lat: float | None = None
    lng: float | None = None


class WeekStatus(BaseModel):
    year: int
    week: int
    status: CollectionStatus | None = None


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
    description: str | None
    community: str
    neighborhood: str
    category: str
    route_order: int | None = None
    status: CollectionStatus | None
    neighborhood_id: uuid.UUID
    community_id: uuid.UUID


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
    """An active account, as superadmins see it. Roles are per town: see the
    members endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str | None
    is_superadmin: bool
    created_at: datetime


class AccountUpdate(BaseModel):
    """Rename an account and/or grant or remove superadmin. Omitted fields are
    left unchanged."""

    name: str | None = None
    is_superadmin: bool | None = None


# --- Town members ---

class MemberOut(BaseModel):
    """A user's membership in one town."""

    user_id: uuid.UUID
    email: str
    name: str | None
    role: Role
    created_at: datetime


class MemberCreate(BaseModel):
    """Add a user to a town by email, creating their account if needed. `name`
    only applies to a new or reactivated account: an existing one is shared
    between towns, so it isn't renamed from here."""

    email: str = Field(min_length=3)
    name: str | None = None
    role: Role = "read"


class MemberUpdate(BaseModel):
    role: Role


# --- Town configuration (admin write) ---

class TownWrite(BaseModel):
    """Town settings. map_zoom, plastic_types and report_partner_text are left
    unchanged when omitted."""

    name: str = Field(min_length=1)
    map_center_lat: float
    map_center_lng: float
    categories: list[str] = []
    map_zoom: int | None = Field(default=None, ge=1, le=22)
    plastic_types: list[str] | None = None
    report_partner_text: str | None = None


class NameWrite(BaseModel):
    """Create/rename a community or neighborhood."""

    name: str = Field(min_length=1)


# --- Weight entries ---

class TownWeightEntryCreate(BaseModel):
    """plastic_type is validated against the town's own list."""

    date: str = Field(description="ISO date string (YYYY-MM-DD)")
    plastic_type: str = Field(min_length=1)
    weight_lbs: float = Field(gt=0)


class TownWeightEntryUpdate(BaseModel):
    date: str | None = Field(default=None, description="ISO date string (YYYY-MM-DD)")
    plastic_type: str | None = Field(default=None, min_length=1)
    weight_lbs: float | None = Field(default=None, gt=0)


class WeightEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    date: datetime
    # Free text: a type removed from its town's list stays on existing entries.
    plastic_type: str
    weight_lbs: float
    created_by: uuid.UUID | None
    created_at: datetime
