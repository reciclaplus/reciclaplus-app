"""Pickup point (PDR) endpoints, scoped to one town."""

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, and_, select
from sqlalchemy.orm import Session, selectinload

from app.activity_log import log_activity
from app.auth import TownAccess, require_town_role
from app.db import get_db
from app.isoweek import current_iso_week
from app.models.collection import Collection
from app.models.pdr import Pdr
from app.models.town import Community, Neighborhood, Town
from app.schemas import PdrOut, PdrWithHistory, TownPdrCreate, TownPdrUpdate, WeekStatus

router = APIRouter(prefix="/towns/{town_id}/pdrs", tags=["pdrs"])

HISTORY_WEEKS = 5


def _with_location():
    """Load options that avoid one query per PDR when reading its location."""
    return selectinload(Pdr.location).selectinload(Neighborhood.community)


def get_town_pdr(db: Session, town_id: uuid.UUID, pdr_id: uuid.UUID) -> Pdr:
    """Look up an active PDR within a town, or 404. A PDR from another town is
    not found, the same as one that doesn't exist."""
    pdr = db.execute(
        select(Pdr)
        .where(Pdr.id == pdr_id, Pdr.town_id == town_id, Pdr.deleted_at.is_(None))
        .options(_with_location())
    ).scalar_one_or_none()
    if pdr is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDR not found")
    return pdr


def _pdr_fields(pdr: Pdr) -> dict:
    """A PDR's response fields, with its location names read from its links so a
    renamed barrio is always current. Falls back to the stored text for a PDR not
    yet linked; the contract phase removes that case."""
    location = pdr.location
    return {
        "id": pdr.id,
        "internal_id": pdr.internal_id,
        "name": pdr.name,
        "description": pdr.description,
        "community": location.community.name if location else pdr.community,
        "neighborhood": location.name if location else pdr.neighborhood,
        "category": pdr.category,
        "lat": pdr.lat,
        "lng": pdr.lng,
        "created_at": pdr.created_at,
        "town_id": pdr.town_id,
        "neighborhood_id": pdr.neighborhood_id,
        "community_id": location.community_id if location else None,
    }


def _resolve_neighborhood(db: Session, town_id: uuid.UUID, neighborhood_id: uuid.UUID) -> Neighborhood:
    """The neighborhood, or 422 if it doesn't belong to this town."""
    neighborhood = db.execute(
        select(Neighborhood)
        .join(Community, Neighborhood.community_id == Community.id)
        .where(Neighborhood.id == neighborhood_id, Community.town_id == town_id)
        .options(selectinload(Neighborhood.community))
    ).scalar_one_or_none()
    if neighborhood is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="El barrio no pertenece a este proyecto",
        )
    return neighborhood


def _check_category(town: Town, category: str) -> None:
    """Reject a category outside the town's list. Only called when a category is
    set or changed, so a PDR keeping a retired one can still be edited."""
    if category not in town.categories:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="La categoría no pertenece a este proyecto",
        )


def _recent_weeks() -> list[tuple[int, int]]:
    """The last HISTORY_WEEKS ISO weeks, oldest to newest."""
    year, week = current_iso_week()
    weeks: list[tuple[int, int]] = []
    for offset in range(HISTORY_WEEKS):
        w, y = week - offset, year
        if w < 1:
            y -= 1
            w += date(y, 12, 28).isocalendar().week
        weeks.append((y, w))
    weeks.reverse()
    return weeks


@router.get("", response_model=list[PdrOut])
def list_pdrs(
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("read")),
) -> list[PdrOut]:
    """List this town's pickup points (excludes soft-deleted ones)."""
    pdrs = db.execute(
        select(Pdr)
        .where(Pdr.town_id == access.town.id, Pdr.deleted_at.is_(None))
        .order_by(Pdr.created_at.desc())
        .options(_with_location())
    ).scalars().all()
    return [PdrOut(**_pdr_fields(p)) for p in pdrs]


@router.get("/with-history", response_model=list[PdrWithHistory])
def list_pdrs_with_history(
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("read")),
) -> list[PdrWithHistory]:
    """This town's PDRs with their status for each of the last 5 ISO weeks.

    Always returns exactly 5 entries per PDR (oldest to newest), with status=None
    for weeks with no recorded collection, so a gap week stays distinguishable.
    """
    weeks = _recent_weeks()
    pdrs = db.execute(
        select(Pdr)
        .where(Pdr.town_id == access.town.id, Pdr.deleted_at.is_(None))
        .order_by(Pdr.created_at.desc())
        .options(_with_location())
    ).scalars().all()
    collections = db.execute(
        select(Collection.pdr_id, Collection.year, Collection.week, Collection.status)
        .join(Pdr, Pdr.id == Collection.pdr_id)
        .where(
            Pdr.town_id == access.town.id,
            or_(*[and_(Collection.year == y, Collection.week == w) for y, w in weeks]),
        )
    ).all()
    status_by_pdr_week = {(c.pdr_id, c.year, c.week): c.status for c in collections}
    return [
        PdrWithHistory(
            **_pdr_fields(p),
            recent_collections=[
                WeekStatus(year=y, week=w, status=status_by_pdr_week.get((p.id, y, w)))
                for y, w in weeks
            ],
        )
        for p in pdrs
    ]


@router.get("/{pdr_id}", response_model=PdrOut)
def get_pdr(
    pdr_id: uuid.UUID,
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("read")),
) -> PdrOut:
    """Get one of this town's pickup points."""
    return PdrOut(**_pdr_fields(get_town_pdr(db, access.town.id, pdr_id)))


@router.post("", response_model=PdrOut, status_code=status.HTTP_201_CREATED)
def create_pdr(
    payload: TownPdrCreate,
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("write")),
) -> PdrOut:
    """Create a pickup point in this town."""
    neighborhood = _resolve_neighborhood(db, access.town.id, payload.neighborhood_id)
    _check_category(access.town, payload.category)
    pdr = Pdr(
        name=payload.name,
        description=payload.description,
        category=payload.category,
        lat=payload.lat,
        lng=payload.lng,
        town_id=access.town.id,
        neighborhood_id=neighborhood.id,
        # The old text columns are required until the contract phase drops them.
        community=neighborhood.community.name,
        neighborhood=neighborhood.name,
        created_by=access.user.id,
    )
    db.add(pdr)
    db.flush()
    log_activity(
        db,
        user_id=access.user.id,
        town_id=access.town.id,
        action="create",
        resource_type="pdr",
        resource_id=pdr.id,
        resource_name=pdr.name,
    )
    db.commit()
    return PdrOut(**_pdr_fields(get_town_pdr(db, access.town.id, pdr.id)))


@router.put("/{pdr_id}", response_model=PdrOut)
def update_pdr(
    pdr_id: uuid.UUID,
    payload: TownPdrUpdate,
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("write")),
) -> PdrOut:
    """Update one of this town's pickup points."""
    pdr = get_town_pdr(db, access.town.id, pdr_id)
    changes = payload.model_dump(exclude_none=True)
    neighborhood_id = changes.pop("neighborhood_id", None)
    if neighborhood_id is not None:
        neighborhood = _resolve_neighborhood(db, access.town.id, neighborhood_id)
        pdr.neighborhood_id = neighborhood.id
        pdr.community = neighborhood.community.name
        pdr.neighborhood = neighborhood.name
    if "category" in changes and changes["category"] != pdr.category:
        _check_category(access.town, changes["category"])
    for field, value in changes.items():
        setattr(pdr, field, value)
    log_activity(
        db,
        user_id=access.user.id,
        town_id=access.town.id,
        action="update",
        resource_type="pdr",
        resource_id=pdr.id,
        resource_name=pdr.name,
    )
    db.commit()
    db.expire(pdr)
    return PdrOut(**_pdr_fields(get_town_pdr(db, access.town.id, pdr_id)))


@router.delete("/{pdr_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pdr(
    pdr_id: uuid.UUID,
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("write")),
) -> None:
    """Soft-delete a pickup point: hides it from all views but keeps its
    collection history intact."""
    pdr = get_town_pdr(db, access.town.id, pdr_id)
    pdr.deleted_at = datetime.now(timezone.utc)
    log_activity(
        db,
        user_id=access.user.id,
        town_id=access.town.id,
        action="delete",
        resource_type="pdr",
        resource_id=pdr.id,
        resource_name=pdr.name,
    )
    db.commit()
