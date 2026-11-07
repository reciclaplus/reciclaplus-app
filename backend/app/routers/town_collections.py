"""Weekly collection pass endpoints, scoped to one town.

Collections have no town of their own: they belong to a town through their PDR.
"""

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.activity_log import log_activity
from app.auth import TownAccess, require_town_role
from app.db import get_db
from app.isoweek import current_iso_week
from app.models.collection import Collection
from app.models.pdr import Pdr
from app.models.town import Community, Neighborhood
from app.schemas import CollectionPassRow, CollectionPassSave, IsoWeek

router = APIRouter(prefix="/towns/{town_id}/collections", tags=["collections"])


def _week_rows(db: Session, town_id: uuid.UUID, year: int, week: int) -> list[CollectionPassRow]:
    """Every active PDR in the town with its status for the ISO week (None if not
    recorded yet)."""
    community_name = func.coalesce(Community.name, Pdr.community)
    rows = db.execute(
        select(
            Pdr.id,
            Pdr.internal_id,
            Pdr.name,
            Pdr.description,
            community_name.label("community"),
            func.coalesce(Neighborhood.name, Pdr.neighborhood).label("neighborhood"),
            Pdr.neighborhood_id,
            Neighborhood.community_id,
            Pdr.category,
            Pdr.route_order,
            Collection.status,
        )
        .select_from(Pdr)
        .outerjoin(Neighborhood, Pdr.neighborhood_id == Neighborhood.id)
        .outerjoin(Community, Neighborhood.community_id == Community.id)
        .outerjoin(
            Collection,
            and_(
                Collection.pdr_id == Pdr.id,
                Collection.year == year,
                Collection.week == week,
            ),
        )
        .where(Pdr.town_id == town_id, Pdr.deleted_at.is_(None))
        .order_by(community_name, Pdr.name)
    ).all()
    return [
        CollectionPassRow(
            pdr_id=r.id,
            internal_id=r.internal_id,
            name=r.name,
            description=r.description,
            community=r.community,
            neighborhood=r.neighborhood,
            neighborhood_id=r.neighborhood_id,
            community_id=r.community_id,
            category=r.category,
            route_order=r.route_order,
            status=r.status,
        )
        for r in rows
    ]


@router.get("/current", response_model=IsoWeek)
def get_current_week(_: TownAccess = Depends(require_town_role("read"))) -> IsoWeek:
    """Current ISO year + week (defaults the collection pass page)."""
    year, week = current_iso_week()
    return IsoWeek(year=year, week=week)


@router.get("/{year}/{week}", response_model=list[CollectionPassRow])
def get_week(
    year: int,
    week: int,
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("read")),
) -> list[CollectionPassRow]:
    """This town's PDRs with their recorded status for the given ISO week."""
    return _week_rows(db, access.town.id, year, week)


@router.post("/{year}/{week}", response_model=list[CollectionPassRow])
def save_week(
    year: int,
    week: int,
    payload: CollectionPassSave,
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("write")),
) -> list[CollectionPassRow]:
    """Upsert the statuses recorded for the given ISO week, then return the
    refreshed week view.

    Rejects the whole save if any PDR belongs to another town. A soft-deleted PDR
    in this town is accepted: it may have been deleted while marks for it were
    queued offline, and rejecting it would block the rest of that queue.
    """
    town_id = access.town.id
    pdr_ids = {entry.pdr_id for entry in payload.entries}
    if pdr_ids:
        found = db.scalars(
            select(Pdr.id).where(Pdr.id.in_(pdr_ids), Pdr.town_id == town_id)
        ).all()
        if len(found) != len(pdr_ids):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Algún punto de recogida no pertenece a este proyecto",
            )

    today = date.today()
    now = datetime.now(timezone.utc)
    for entry in payload.entries:
        created_at = entry.collected_at or now
        db.execute(
            pg_insert(Collection)
            .values(
                pdr_id=entry.pdr_id,
                year=year,
                week=week,
                status=entry.status,
                date=today,
                created_by=access.user.id,
                created_at=created_at,
            )
            .on_conflict_do_update(
                index_elements=["pdr_id", "year", "week"],
                set_={
                    "status": entry.status,
                    "date": today,
                    "created_by": access.user.id,
                    "created_at": created_at,
                },
            )
        )
    if payload.entries:
        # One entry per save rather than per PDR, so a pass doesn't flood the log.
        log_activity(
            db,
            user_id=access.user.id,
            town_id=town_id,
            action="update",
            resource_type="collection",
            resource_id=town_id,
            resource_name=f"{year}-W{week:02d} ({len(payload.entries)})",
        )
    db.commit()
    return _week_rows(db, town_id, year, week)
