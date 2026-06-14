"""Pydantic schemas for API request/response bodies."""

import uuid

from pydantic import BaseModel, ConfigDict


class UserMe(BaseModel):
    """Current authenticated user, returned by GET /auth/me."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str | None
    role: str
