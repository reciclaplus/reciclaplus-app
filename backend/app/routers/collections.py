"""Weekly collection pass endpoints.

Collections are addressed by ISO week. The pass page reads every PDR with its
status for a week and writes the recorded statuses back.
"""

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import and_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.auth import require_role
from app.db import get_db
from app.isoweek import current_iso_week
from app.models.collection import Collection
from app.models.pdr import Pdr
from app.models.user import User
from app.schemas import CollectionPassRow, CollectionPassSave, IsoWeek

router = APIRouter(prefix="/collections", tags=["collections"])


@router.get("/current", response_model=IsoWeek)
def get_current_week(_: User = Depends(require_role("read"))) -> IsoWeek:
    """Current ISO year + week (defaults the collection pass page)."""
    year, week = current_iso_week()
    return IsoWeek(year=year, week=week)


@router.get("/{year}/{week}", response_model=list[CollectionPassRow])
def get_week(
    year: int,
    week: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("read")),
) -> list[CollectionPassRow]:
    """Every PDR with its recorded status for the given ISO week (None if the
    pass hasn't recorded it yet)."""
    rows = db.execute(
        select(
            Pdr.id,
            Pdr.internal_id,
            Pdr.name,
            Pdr.community,
            Pdr.neighborhood,
            Pdr.category,
            Collection.status,
        )
        .select_from(Pdr)
        .outerjoin(
            Collection,
            and_(
                Collection.pdr_id == Pdr.id,
                Collection.year == year,
                Collection.week == week,
            ),
        )
        .order_by(Pdr.community, Pdr.name)
    ).all()

    return [
        CollectionPassRow(
            pdr_id=r.id,
            internal_id=r.internal_id,
            name=r.name,
            community=r.community,
            neighborhood=r.neighborhood,
            category=r.category,
            status=r.status,
        )
        for r in rows
    ]


@router.post("/{year}/{week}", response_model=list[CollectionPassRow])
def save_week(
    year: int,
    week: int,
    payload: CollectionPassSave,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("write")),
) -> list[CollectionPassRow]:
    """Upsert the statuses recorded for the given ISO week, then return the
    refreshed week view."""
    today = date.today()
    for entry in payload.entries:
        stmt = (
            pg_insert(Collection)
            .values(
                pdr_id=entry.pdr_id,
                year=year,
                week=week,
                status=entry.status,
                date=today,
                created_by=user.id,
            )
            .on_conflict_do_update(
                index_elements=["pdr_id", "year", "week"],
                set_={"status": entry.status, "date": today, "created_by": user.id},
            )
        )
        db.execute(stmt)
    db.commit()
    return get_week(year, week, db=db, _=user)
