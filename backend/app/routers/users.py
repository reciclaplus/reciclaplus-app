"""Account management endpoints (superadmin only).

An account is shared by every town its user belongs to, so these global actions
are for superadmins: listing accounts, renaming, granting or removing superadmin,
and deactivating. Town admins add and remove people in their own town through
the members endpoints (app/routers/members.py), which also create accounts.

Users are keyed by their own uuid and matched to a Google login by email (see
app/auth.py).
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.activity_log import log_activity
from app.auth import require_superadmin
from app.db import get_db
from app.models.user import User
from app.schemas import AccountUpdate, UserOut

router = APIRouter(prefix="/users", tags=["users"])


def _find_user_by_email(db: Session, email: str) -> User:
    """Look up an active (non-deactivated) user by email, or 404."""
    user = db.execute(
        select(User).where(func.lower(User.email) == email.lower())
    ).scalar_one_or_none()
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _log(db: Session, actor: User, action: str, user: User) -> None:
    # A global entry (no town): accounts are shared between towns.
    log_activity(
        db,
        user_id=actor.id,
        action=action,
        resource_type="user",
        resource_id=user.id,
        resource_name=user.email,
    )


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
) -> list[User]:
    """List all active accounts (excludes deactivated ones)."""
    return db.execute(
        select(User).where(User.deleted_at.is_(None)).order_by(User.created_at)
    ).scalars().all()


@router.put("/{email}", response_model=UserOut)
def update_user(
    email: str,
    payload: AccountUpdate,
    db: Session = Depends(get_db),
    superadmin: User = Depends(require_superadmin),
) -> User:
    """Rename an account and/or grant or remove superadmin. Omitted fields are
    left unchanged. A superadmin can't remove their own superadmin access."""
    user = _find_user_by_email(db, email)
    changes = payload.model_dump(exclude_unset=True)
    if "is_superadmin" in changes and changes["is_superadmin"] is not None:
        if user.id == superadmin.id and not changes["is_superadmin"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puedes quitarte el acceso de superadministrador.",
            )
        user.is_superadmin = changes["is_superadmin"]
    if "name" in changes:
        user.name = changes["name"]
    _log(db, superadmin, "update", user)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{email}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    email: str,
    db: Session = Depends(get_db),
    superadmin: User = Depends(require_superadmin),
) -> None:
    """Deactivate an account: blocks sign-in everywhere and hides it from member
    lists, but keeps its `id` so PDRs and logs it created stay attributable. Only
    a superadmin can reactivate it, by adding it to a town again. Superadmins
    can't deactivate their own account."""
    user = _find_user_by_email(db, email)
    if user.id == superadmin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes desactivar tu propia cuenta.",
        )
    user.deleted_at = datetime.now(timezone.utc)
    _log(db, superadmin, "delete", user)
    db.commit()
