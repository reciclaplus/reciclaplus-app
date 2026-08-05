"""User & access management endpoints (admin only).

Platform users are keyed by their own uuid and matched to a Google login by
email (see app/auth.py), so admins create user rows directly here. A user can
be added before they ever sign in; on first sign-in they are matched by email.
"""

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
    user = db.execute(
        select(User).where(func.lower(User.email) == email.lower())
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
) -> list[User]:
    """List all platform users."""
    return db.execute(select(User).order_by(User.created_at)).scalars().all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
) -> User:
    """Create a user by email + role. They gain access on their first sign-in
    (matched by email)."""
    email = payload.email.strip().lower()
    existing = db.execute(
        select(User).where(func.lower(User.email) == email)
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="User already exists"
        )

    user = User(
        email=email, name=payload.name, role=payload.role, created_by=admin.id
    )
    db.add(user)
    db.flush()
    log_activity(
        db,
        user_id=admin.id,
        action="create",
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
    """Delete a user. Admins cannot delete their own account."""
    user = _find_user_by_email(db, email)
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account",
        )
    log_activity(
        db,
        user_id=admin.id,
        action="delete",
        resource_type="user",
        resource_id=user.id,
        resource_name=user.email,
    )
    db.delete(user)
    db.commit()
