"""Weight entry endpoints — log weighed plastic bags by type."""

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import require_role
from app.db import get_db
from app.models.weight_entry import WeightEntry
from app.models.user import User
from app.schemas import WeightEntryCreate, WeightEntryOut, WeightEntryUpdate

router = APIRouter(prefix="/weights", tags=["weights"])


@router.get("", response_model=list[WeightEntryOut])
def list_weights(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("read")),
) -> list[WeightEntryOut]:
    rows = db.execute(
        select(WeightEntry).order_by(WeightEntry.date.desc(), WeightEntry.created_at.desc())
    ).scalars().all()
    return [WeightEntryOut.model_validate(r) for r in rows]


@router.post("", response_model=WeightEntryOut, status_code=201)
def create_weight(
    payload: WeightEntryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("write")),
) -> WeightEntryOut:
    entry = WeightEntry(
        date=date.fromisoformat(payload.date),
        plastic_type=payload.plastic_type,
        weight_lbs=payload.weight_lbs,
        created_by=user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return WeightEntryOut.model_validate(entry)


@router.put("/{entry_id}", response_model=WeightEntryOut)
def update_weight(
    entry_id: uuid.UUID,
    payload: WeightEntryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("write")),
) -> WeightEntryOut:
    entry = db.get(WeightEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weight entry not found")
    data = payload.model_dump(exclude_none=True)
    if "date" in data:
        data["date"] = date.fromisoformat(data["date"])
    for field, value in data.items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return WeightEntryOut.model_validate(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_weight(
    entry_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("write")),
) -> None:
    entry = db.get(WeightEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weight entry not found")
    db.delete(entry)
    db.commit()
