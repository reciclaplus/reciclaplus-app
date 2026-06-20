"""Pickup point (PDR) endpoints."""

import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

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
    """List all pickup points."""
    return db.execute(select(Pdr).order_by(Pdr.created_at.desc())).scalars().all()


@router.get("/with-history", response_model=list[PdrWithHistory])
def list_pdrs_with_history(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("read")),
) -> list[PdrWithHistory]:
    """All PDRs with their collection status for the last 5 ISO weeks."""
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

    pdrs = db.execute(select(Pdr).order_by(Pdr.created_at.desc())).scalars().all()

    conditions = [
        and_(Collection.year == y, Collection.week == w)
        for y, w in weeks
    ]
    from sqlalchemy import or_
    collections = db.execute(
        select(Collection.pdr_id, Collection.year, Collection.week, Collection.status)
        .where(or_(*conditions))
    ).all()

    history: dict[uuid.UUID, list[WeekStatus]] = defaultdict(list)
    for c in collections:
        history[c.pdr_id].append(WeekStatus(year=c.year, week=c.week, status=c.status))

    for pdr_id in history:
        history[pdr_id].sort(key=lambda ws: (ws.year, ws.week))

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
            recent_collections=history.get(p.id, []),
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
    if pdr is None:
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
    db.commit()
    db.refresh(pdr)
    return pdr


@router.put("/{pdr_id}", response_model=PdrOut)
def update_pdr(
    pdr_id: uuid.UUID,
    payload: PdrUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("write")),
) -> Pdr:
    pdr = db.get(Pdr, pdr_id)
    if pdr is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDR not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(pdr, field, value)
    db.commit()
    db.refresh(pdr)
    return pdr


@router.delete("/{pdr_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pdr(
    pdr_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("write")),
) -> None:
    pdr = db.get(Pdr, pdr_id)
    if pdr is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDR not found")
    db.delete(pdr)
    db.commit()
