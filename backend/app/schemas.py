"""Pydantic schemas for API request/response bodies."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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
