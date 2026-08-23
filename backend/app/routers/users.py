"""User & access management endpoints (admin only).

Platform users are keyed by their own uuid and matched to a Google login by
email (see app/auth.py), so admins create user rows directly here. A user can
be added before they ever sign in; on first sign-in they are matched by email.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.activity_log import log_activity
from app.auth import require_role
from app.db import get_db
from app.models.user import User
from app.schemas import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


def _find_user_by_email(db: Session, email: str) -> User:
    """Look up an active (non-deactivated) user by email, or 404."""
    user = db.execute(
        select(User).where(func.lower(User.email) == email.lower())
    ).scalar_one_or_none()
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
) -> list[User]:
    """List all active platform users (excludes deactivated ones)."""
    return db.execute(
        select(User).where(User.deleted_at.is_(None)).order_by(User.created_at)
    ).scalars().all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
) -> User:
    """Create a user by email + role. They gain access on their first sign-in
    (matched by email).

    If the email belongs to a previously deactivated user, reactivates that
    account (clearing `deleted_at`) instead of failing on the unique
    constraint — the `id` and any resources they created stay linked.
    """
    email = payload.email.strip().lower()
    existing = db.execute(
        select(User).where(func.lower(User.email) == email)
    ).scalar_one_or_none()

    if existing is not None and existing.deleted_at is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="User already exists"
        )

    if existing is not None:
        existing.deleted_at = None
        existing.name = payload.name
        existing.role = payload.role
        existing.created_by = admin.id
        user = existing
        action = "update"
    else:
        user = User(
            email=email, name=payload.name, role=payload.role, created_by=admin.id
        )
        db.add(user)
        action = "create"

    db.flush()
    log_activity(
        db,
        user_id=admin.id,
        action=action,
        resource_type="user",
        resource_id=user.id,
        resource_name=user.email,
    )
    db.commit()
    db.refresh(user)
    return user


@router.put("/{email}", response_model=UserOut)
def update_user(
    email: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
) -> User:
    """Update a user's role and/or name."""
    user = _find_user_by_email(db, email)
    user.role = payload.role
    user.name = payload.name
    log_activity(
        db,
        user_id=admin.id,
        action="update",
        resource_type="user",
        resource_id=user.id,
        resource_name=user.email,
    )
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{email}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    email: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
) -> None:
    """Deactivate a user: hides them from the user list and blocks sign-in,
    but keeps their `id` intact so PDRs and activity logs they created stay
    attributable. Admins cannot delete their own account."""
    user = _find_user_by_email(db, email)
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account",
        )
    user.deleted_at = datetime.now(timezone.utc)
    log_activity(
        db,
        user_id=admin.id,
        action="delete",
        resource_type="user",
        resource_id=user.id,
        resource_name=user.email,
    )
    db.commit()
