"""Weight entry endpoints — log weighed plastic bags by type."""

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import require_role
from app.db import get_db
from app.models.weight_entry import WeightEntry
from app.models.user import User
from app.schemas import WeightEntryCreate, WeightEntryOut

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
