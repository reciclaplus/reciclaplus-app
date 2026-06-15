"""Town configuration endpoints.

Reads (any authenticated user) feed the PDR form dropdowns. Writes (admin only)
power the admin "Town config" tab: CRUD over towns, communities, and
neighborhoods.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import get_current_user, require_role
from app.db import get_db
from app.models.town import Community, Neighborhood, Town
from app.models.user import User
from app.schemas import (
    CommunityOut,
    NameWrite,
    NeighborhoodOut,
    TownDetail,
    TownSummary,
    TownWrite,
)

# No prefix: this router owns /towns, /communities and /neighborhoods.
router = APIRouter(tags=["towns"])


def _get_town_or_404(db: Session, town_id: uuid.UUID) -> Town:
    town = db.get(Town, town_id)
    if town is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Town not found")
    return town


# --- Reads (authenticated) ---

@router.get("/towns", response_model=list[TownSummary])
def list_towns(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Town]:
    """List all towns (any authenticated user)."""
    return db.execute(select(Town).order_by(Town.name)).scalars().all()


@router.get("/towns/{town_id}", response_model=TownDetail)
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


# --- Town writes (admin) ---

@router.post("/towns", response_model=TownDetail, status_code=status.HTTP_201_CREATED)
def create_town(
    payload: TownWrite,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
) -> Town:
    town = Town(**payload.model_dump())
    db.add(town)
    db.commit()
    return get_town(town.id, db=db, _=_)


@router.put("/towns/{town_id}", response_model=TownDetail)
def update_town(
    town_id: uuid.UUID,
    payload: TownWrite,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
) -> Town:
    town = _get_town_or_404(db, town_id)
    town.name = payload.name
    town.map_center_lat = payload.map_center_lat
    town.map_center_lng = payload.map_center_lng
    town.categories = payload.categories
    db.commit()
    return get_town(town_id, db=db, _=_)


@router.delete("/towns/{town_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_town(
    town_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
) -> None:
    db.delete(_get_town_or_404(db, town_id))
    db.commit()


# --- Community writes (admin) ---

@router.post(
    "/towns/{town_id}/communities",
    response_model=CommunityOut,
    status_code=status.HTTP_201_CREATED,
)
def create_community(
    town_id: uuid.UUID,
    payload: NameWrite,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
) -> Community:
    _get_town_or_404(db, town_id)
    community = Community(town_id=town_id, name=payload.name)
    db.add(community)
    db.commit()
    db.refresh(community)
    return community


@router.put("/communities/{community_id}", response_model=CommunityOut)
def update_community(
    community_id: uuid.UUID,
    payload: NameWrite,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
) -> Community:
    community = db.get(Community, community_id)
    if community is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")
    community.name = payload.name
    db.commit()
    db.refresh(community)
    return community


@router.delete("/communities/{community_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_community(
    community_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
) -> None:
    community = db.get(Community, community_id)
    if community is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")
    db.delete(community)
    db.commit()


# --- Neighborhood writes (admin) ---

@router.post(
    "/communities/{community_id}/neighborhoods",
    response_model=NeighborhoodOut,
    status_code=status.HTTP_201_CREATED,
)
def create_neighborhood(
    community_id: uuid.UUID,
    payload: NameWrite,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
) -> Neighborhood:
    community = db.get(Community, community_id)
    if community is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")
    neighborhood = Neighborhood(community_id=community_id, name=payload.name)
    db.add(neighborhood)
    db.commit()
    db.refresh(neighborhood)
    return neighborhood


@router.put("/neighborhoods/{neighborhood_id}", response_model=NeighborhoodOut)
def update_neighborhood(
    neighborhood_id: uuid.UUID,
    payload: NameWrite,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
) -> Neighborhood:
    neighborhood = db.get(Neighborhood, neighborhood_id)
    if neighborhood is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Neighborhood not found")
    neighborhood.name = payload.name
    db.commit()
    db.refresh(neighborhood)
    return neighborhood


@router.delete("/neighborhoods/{neighborhood_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_neighborhood(
    neighborhood_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
) -> None:
    neighborhood = db.get(Neighborhood, neighborhood_id)
    if neighborhood is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Neighborhood not found")
    db.delete(neighborhood)
    db.commit()
