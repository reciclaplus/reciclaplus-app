"""Town configuration endpoints.

Town admins manage their own town's settings, communities and neighborhoods.
Superadmins also create, archive, restore and delete towns. Every community and
neighborhood route authorizes against the town that row belongs to.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.activity_log import ActivityAction, ActivityResourceType, log_activity
from app.auth import (
    TownAccess,
    get_current_user,
    require_community_role,
    require_neighborhood_role,
    require_superadmin,
    require_town_role,
)
from app.db import get_db
from app.models.town import Community, Neighborhood, Town
from app.models.town_member import TownMember
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

TOWN_NAME_TAKEN = "Ya existe un proyecto con ese nombre."


def _get_town_or_404(db: Session, town_id: uuid.UUID) -> Town:
    town = db.get(Town, town_id)
    if town is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Town not found")
    return town


def _load_town_detail(db: Session, town_id: uuid.UUID) -> Town:
    """A town with its nested communities and neighborhoods."""
    db.expire_all()
    return db.execute(
        select(Town)
        .where(Town.id == town_id)
        .options(selectinload(Town.communities).selectinload(Community.neighborhoods))
    ).scalar_one()


def _commit_unique_name(db: Session) -> None:
    """Commit a town write, or 409 if its name is already taken."""
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=TOWN_NAME_TAKEN) from exc


def _delete_unless_in_use(db: Session, resource: object, in_use_detail: str) -> None:
    """Delete a config row, or 409 if PDRs or weights still reference it."""
    try:
        db.delete(resource)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=in_use_detail) from exc


def _log(
    db: Session,
    user: User,
    town_id: uuid.UUID | None,
    action: ActivityAction,
    resource_type: ActivityResourceType,
    resource_id: uuid.UUID,
    resource_name: str,
) -> None:
    log_activity(
        db,
        user_id=user.id,
        town_id=town_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        resource_name=resource_name,
    )


# --- Reads ---

@router.get("/towns", response_model=list[TownSummary])
def list_towns(
    include_archived: bool = Query(False, description="Superadmins only."),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Town]:
    """List the towns the caller can access (every town for superadmins).
    Archived towns are hidden unless a superadmin asks for them."""
    query = select(Town).order_by(Town.name)
    if not user.is_superadmin:
        query = query.join(TownMember, TownMember.town_id == Town.id).where(
            TownMember.user_id == user.id
        )
    if not (user.is_superadmin and include_archived):
        query = query.where(Town.archived_at.is_(None))
    return db.execute(query).scalars().all()


@router.get("/towns/{town_id}", response_model=TownDetail)
def get_town(
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("read")),
) -> Town:
    """Get one town with its settings and nested communities/neighborhoods."""
    return _load_town_detail(db, access.town.id)


# --- Town writes ---

@router.post("/towns", response_model=TownDetail, status_code=status.HTTP_201_CREATED)
def create_town(
    payload: TownWrite,
    db: Session = Depends(get_db),
    user: User = Depends(require_superadmin),
) -> Town:
    """Create a town (superadmin). Omitted settings take their defaults."""
    town = Town(**payload.model_dump(exclude_none=True))
    db.add(town)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=TOWN_NAME_TAKEN) from exc
    _log(db, user, town.id, "create", "town", town.id, town.name)
    db.commit()
    return _load_town_detail(db, town.id)


@router.put("/towns/{town_id}", response_model=TownDetail)
def update_town(
    payload: TownWrite,
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("admin")),
) -> Town:
    """Update a town's settings. A category or plastic type removed from its list
    stays on existing PDRs and weight entries, and can't be chosen for new ones."""
    town = access.town
    town.name = payload.name
    town.map_center_lat = payload.map_center_lat
    town.map_center_lng = payload.map_center_lng
    town.categories = payload.categories
    if payload.map_zoom is not None:
        town.map_zoom = payload.map_zoom
    if payload.plastic_types is not None:
        town.plastic_types = payload.plastic_types
    if "report_partner_text" in payload.model_fields_set:
        town.report_partner_text = payload.report_partner_text
    _log(db, access.user, town.id, "update", "town", town.id, town.name)
    _commit_unique_name(db)
    return _load_town_detail(db, town.id)


@router.post("/towns/{town_id}/archive", response_model=TownSummary)
def archive_town(
    town_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_superadmin),
) -> Town:
    """Archive a town (superadmin): hides it and blocks access, keeping its data."""
    town = _get_town_or_404(db, town_id)
    if town.archived_at is None:
        town.archived_at = datetime.now(timezone.utc)
        _log(db, user, town.id, "update", "town", town.id, town.name)
        db.commit()
    return town


@router.post("/towns/{town_id}/restore", response_model=TownSummary)
def restore_town(
    town_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_superadmin),
) -> Town:
    """Restore an archived town (superadmin)."""
    town = _get_town_or_404(db, town_id)
    if town.archived_at is not None:
        town.archived_at = None
        _log(db, user, town.id, "update", "town", town.id, town.name)
        db.commit()
    return town


@router.delete("/towns/{town_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_town(
    town_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_superadmin),
) -> None:
    """Delete a town with no data (superadmin), or 409 if it has any, including
    soft-deleted PDRs. Archive it instead."""
    town = _get_town_or_404(db, town_id)
    # A global entry: the town it would point to is about to be gone.
    _log(db, user, None, "delete", "town", town.id, town.name)
    _delete_unless_in_use(
        db, town, "No se puede eliminar: este proyecto tiene datos asociados."
    )


# --- Community writes (town admin) ---

@router.post(
    "/towns/{town_id}/communities",
    response_model=CommunityOut,
    status_code=status.HTTP_201_CREATED,
)
def create_community(
    payload: NameWrite,
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("admin")),
) -> Community:
    community = Community(town_id=access.town.id, name=payload.name)
    db.add(community)
    db.flush()
    _log(db, access.user, access.town.id, "create", "community", community.id, community.name)
    db.commit()
    db.refresh(community)
    return community


@router.put("/communities/{community_id}", response_model=CommunityOut)
def update_community(
    community_id: uuid.UUID,
    payload: NameWrite,
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_community_role("admin")),
) -> Community:
    community = db.get(Community, community_id)
    community.name = payload.name
    _log(db, access.user, access.town.id, "update", "community", community.id, community.name)
    db.commit()
    db.refresh(community)
    return community


@router.delete("/communities/{community_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_community(
    community_id: uuid.UUID,
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_community_role("admin")),
) -> None:
    community = db.get(Community, community_id)
    _log(db, access.user, access.town.id, "delete", "community", community.id, community.name)
    _delete_unless_in_use(
        db,
        community,
        "No se puede eliminar: esta comunidad tiene puntos de recogida asociados.",
    )


# --- Neighborhood writes (town admin) ---

@router.post(
    "/communities/{community_id}/neighborhoods",
    response_model=NeighborhoodOut,
    status_code=status.HTTP_201_CREATED,
)
def create_neighborhood(
    community_id: uuid.UUID,
    payload: NameWrite,
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_community_role("admin")),
) -> Neighborhood:
    neighborhood = Neighborhood(community_id=community_id, name=payload.name)
    db.add(neighborhood)
    db.flush()
    _log(db, access.user, access.town.id, "create", "neighborhood", neighborhood.id, neighborhood.name)
    db.commit()
    db.refresh(neighborhood)
    return neighborhood


@router.put("/neighborhoods/{neighborhood_id}", response_model=NeighborhoodOut)
def update_neighborhood(
    neighborhood_id: uuid.UUID,
    payload: NameWrite,
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_neighborhood_role("admin")),
) -> Neighborhood:
    neighborhood = db.get(Neighborhood, neighborhood_id)
    neighborhood.name = payload.name
    _log(db, access.user, access.town.id, "update", "neighborhood", neighborhood.id, neighborhood.name)
    db.commit()
    db.refresh(neighborhood)
    return neighborhood


@router.delete("/neighborhoods/{neighborhood_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_neighborhood(
    neighborhood_id: uuid.UUID,
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_neighborhood_role("admin")),
) -> None:
    neighborhood = db.get(Neighborhood, neighborhood_id)
    _log(db, access.user, access.town.id, "delete", "neighborhood", neighborhood.id, neighborhood.name)
    _delete_unless_in_use(
        db,
        neighborhood,
        "No se puede eliminar: este barrio tiene puntos de recogida asociados.",
    )
