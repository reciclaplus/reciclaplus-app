"""Pickup point (PDR) endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import require_role
from app.db import get_db
from app.models.pdr import Pdr
from app.models.user import User
from app.schemas import PdrCreate, PdrOut

router = APIRouter(prefix="/pdrs", tags=["pdrs"])


@router.get("", response_model=list[PdrOut])
def list_pdrs(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("read")),
) -> list[Pdr]:
    """List all pickup points."""
    return db.execute(select(Pdr).order_by(Pdr.created_at.desc())).scalars().all()


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
