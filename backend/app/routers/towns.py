"""Town configuration endpoints.

Read-only for any authenticated user — they feed the PDR form's dropdowns
(categories, communities, neighborhoods, map center). Admin write endpoints
come with the town-config admin UI later.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import get_current_user
from app.db import get_db
from app.models.town import Community, Town
from app.models.user import User
from app.schemas import TownDetail, TownSummary

router = APIRouter(prefix="/towns", tags=["towns"])


@router.get("", response_model=list[TownSummary])
def list_towns(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Town]:
    """List all towns (any authenticated user)."""
    return db.execute(select(Town).order_by(Town.name)).scalars().all()


@router.get("/{town_id}", response_model=TownDetail)
def get_town(
    town_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Town:
    """Get one town with its categories and nested communities/neighborhoods."""
    town = db.execute(
        select(Town)
        .where(Town.id == town_id)
        .options(selectinload(Town.communities).selectinload(Community.neighborhoods))
    ).scalar_one_or_none()
    if town is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Town not found")
    return town
