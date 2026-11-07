"""Weight entry endpoints, scoped to one town."""

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.activity_log import log_activity
from app.auth import TownAccess, require_town_role
from app.db import get_db
from app.models.town import Town
from app.models.weight_entry import WeightEntry
from app.schemas import TownWeightEntryCreate, TownWeightEntryUpdate, WeightEntryOut

router = APIRouter(prefix="/towns/{town_id}/weights", tags=["weights"])


def _get_entry(db: Session, town_id: uuid.UUID, entry_id: uuid.UUID) -> WeightEntry:
    """Look up a weight entry within a town, or 404."""
    entry = db.execute(
        select(WeightEntry).where(WeightEntry.id == entry_id, WeightEntry.town_id == town_id)
    ).scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weight entry not found")
    return entry


def _check_plastic_type(town: Town, plastic_type: str) -> None:
    """Reject a type outside the town's list. Only called when a type is set or
    changed, so an entry keeping a removed type can still be edited."""
    if plastic_type not in town.plastic_types:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="El tipo de plástico no pertenece a este proyecto",
        )


def _parse_date(value: str) -> date:
    """Parse an ISO date, ignoring any time part, or 422."""
    try:
        return date.fromisoformat(value[:10])
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Fecha no válida"
        ) from exc


def _log(db: Session, access: TownAccess, action: str, entry: WeightEntry) -> None:
    log_activity(
        db,
        user_id=access.user.id,
        town_id=access.town.id,
        action=action,
        resource_type="weight",
        resource_id=entry.id,
        resource_name=f"{entry.date} {entry.plastic_type}",
    )


@router.get("", response_model=list[WeightEntryOut])
def list_weights(
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("read")),
) -> list[WeightEntry]:
    """List this town's weight entries, newest first."""
    return db.execute(
        select(WeightEntry)
        .where(WeightEntry.town_id == access.town.id)
        .order_by(WeightEntry.date.desc(), WeightEntry.created_at.desc())
    ).scalars().all()


@router.post("", response_model=WeightEntryOut, status_code=status.HTTP_201_CREATED)
def create_weight(
    payload: TownWeightEntryCreate,
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("write")),
) -> WeightEntry:
    """Record a weight entry in this town."""
    _check_plastic_type(access.town, payload.plastic_type)
    entry = WeightEntry(
        town_id=access.town.id,
        date=_parse_date(payload.date),
        plastic_type=payload.plastic_type,
        weight_lbs=payload.weight_lbs,
        created_by=access.user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    db.flush()
    _log(db, access, "create", entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/{entry_id}", response_model=WeightEntryOut)
def update_weight(
    entry_id: uuid.UUID,
    payload: TownWeightEntryUpdate,
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("write")),
) -> WeightEntry:
    """Update one of this town's weight entries."""
    entry = _get_entry(db, access.town.id, entry_id)
    changes = payload.model_dump(exclude_none=True)
    if "plastic_type" in changes and changes["plastic_type"] != entry.plastic_type:
        _check_plastic_type(access.town, changes["plastic_type"])
    if "date" in changes:
        changes["date"] = _parse_date(changes["date"])
    for field, value in changes.items():
        setattr(entry, field, value)
    _log(db, access, "update", entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_weight(
    entry_id: uuid.UUID,
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("write")),
) -> None:
    """Delete one of this town's weight entries."""
    entry = _get_entry(db, access.town.id, entry_id)
    _log(db, access, "delete", entry)
    db.delete(entry)
    db.commit()
