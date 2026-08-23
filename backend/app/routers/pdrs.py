"""Pickup point (PDR) endpoints."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.activity_log import log_activity
from app.auth import require_role
from app.db import get_db
from app.isoweek import current_iso_week
from app.models.collection import Collection
from app.models.pdr import Pdr
from app.models.user import User
from app.schemas import PdrCreate, PdrOut, PdrUpdate, PdrWithHistory, WeekStatus

router = APIRouter(prefix="/pdrs", tags=["pdrs"])


@router.get("", response_model=list[PdrOut])
def list_pdrs(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("read")),
) -> list[Pdr]:
    """List all pickup points (excludes soft-deleted ones)."""
    return db.execute(
        select(Pdr).where(Pdr.deleted_at.is_(None)).order_by(Pdr.created_at.desc())
    ).scalars().all()


@router.get("/with-history", response_model=list[PdrWithHistory])
def list_pdrs_with_history(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("read")),
) -> list[PdrWithHistory]:
    """All PDRs with their collection status for the last 5 ISO weeks.

    Always returns exactly 5 entries per PDR (oldest to newest), one per week
    in the window, with status=None for weeks that have no recorded
    collection — so a gap week is distinguishable from "not yet reached in
    the window" instead of silently shifting later weeks into its slot.
    """
    year, week = current_iso_week()
    weeks: list[tuple[int, int]] = []
    for i in range(5):
        w = week - i
        y = year
        if w < 1:
            y -= 1
            from datetime import date
            last_week = date(y, 12, 28).isocalendar().week
            w += last_week
        weeks.append((y, w))
    weeks.reverse()  # oldest to newest

    pdrs = db.execute(
        select(Pdr).where(Pdr.deleted_at.is_(None)).order_by(Pdr.created_at.desc())
    ).scalars().all()

    conditions = [
        and_(Collection.year == y, Collection.week == w)
        for y, w in weeks
    ]
    from sqlalchemy import or_
    collections = db.execute(
        select(Collection.pdr_id, Collection.year, Collection.week, Collection.status)
        .where(or_(*conditions))
    ).all()

    status_by_pdr_week: dict[tuple[uuid.UUID, int, int], str] = {
        (c.pdr_id, c.year, c.week): c.status for c in collections
    }

    return [
        PdrWithHistory(
            id=p.id,
            internal_id=p.internal_id,
            name=p.name,
            description=p.description,
            community=p.community,
            neighborhood=p.neighborhood,
            category=p.category,
            lat=p.lat,
            lng=p.lng,
            created_at=p.created_at,
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
    _: User = Depends(require_role("read")),
) -> Pdr:
    """Get a single pickup point."""
    pdr = db.get(Pdr, pdr_id)
    if pdr is None or pdr.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDR not found")
    return pdr


@router.post("", response_model=PdrOut, status_code=status.HTTP_201_CREATED)
def create_pdr(
    payload: PdrCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("write")),
) -> Pdr:
    """Create a new pickup point."""
    pdr = Pdr(**payload.model_dump(), created_by=user.id)
    db.add(pdr)
    db.flush()
    log_activity(
        db,
        user_id=user.id,
        action="create",
        resource_type="pdr",
        resource_id=pdr.id,
        resource_name=pdr.name,
    )
    db.commit()
    db.refresh(pdr)
    return pdr


@router.put("/{pdr_id}", response_model=PdrOut)
def update_pdr(
    pdr_id: uuid.UUID,
    payload: PdrUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("write")),
) -> Pdr:
    pdr = db.get(Pdr, pdr_id)
    if pdr is None or pdr.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDR not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(pdr, field, value)
    log_activity(
        db,
        user_id=user.id,
        action="update",
        resource_type="pdr",
        resource_id=pdr.id,
        resource_name=pdr.name,
    )
    db.commit()
    db.refresh(pdr)
    return pdr


@router.delete("/{pdr_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pdr(
    pdr_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("write")),
) -> None:
    """Soft-delete a pickup point: hides it from all views but keeps its
    collection history intact."""
    pdr = db.get(Pdr, pdr_id)
    if pdr is None or pdr.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDR not found")
    pdr.deleted_at = datetime.now(timezone.utc)
    log_activity(
        db,
        user_id=user.id,
        action="delete",
        resource_type="pdr",
        resource_id=pdr.id,
        resource_name=pdr.name,
    )
    db.commit()
