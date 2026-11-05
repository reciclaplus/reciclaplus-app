"""Town membership endpoints: who can access a town, with which role.

A user account is shared between towns, so these endpoints only change the
membership in this town. They never reveal a user's other towns, and removing a
member leaves their account and other memberships untouched.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.activity_log import ActivityAction, log_activity
from app.auth import TownAccess, require_town_role
from app.db import get_db
from app.models.town_member import TownMember
from app.models.user import User
from app.schemas import MemberCreate, MemberOut, MemberUpdate

router = APIRouter(prefix="/towns/{town_id}/members", tags=["members"])


def _member_out(user: User, role: str, created_at: datetime) -> MemberOut:
    return MemberOut(
        user_id=user.id,
        email=user.email,
        name=user.name,
        role=role,
        created_at=created_at,
    )


def _get_member(db: Session, town_id: uuid.UUID, user_id: uuid.UUID) -> tuple[TownMember, User]:
    """A membership in this town and its user, or 404."""
    row = db.execute(
        select(TownMember, User)
        .join(User, User.id == TownMember.user_id)
        .where(TownMember.town_id == town_id, TownMember.user_id == user_id)
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    return row.TownMember, row.User


def _reject_self_change(access: TownAccess, user_id: uuid.UUID, detail: str) -> None:
    """Stop a town admin locking themselves out. A superadmin keeps access to the
    town regardless of membership, so this doesn't apply to them."""
    if user_id == access.user.id and not access.user.is_superadmin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _log(db: Session, access: TownAccess, action: ActivityAction, user: User) -> None:
    log_activity(
        db,
        user_id=access.user.id,
        town_id=access.town.id,
        action=action,
        resource_type="member",
        resource_id=user.id,
        resource_name=user.email,
    )


@router.get("", response_model=list[MemberOut])
def list_members(
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("admin")),
) -> list[MemberOut]:
    """List this town's active members."""
    rows = db.execute(
        select(TownMember, User)
        .join(User, User.id == TownMember.user_id)
        .where(TownMember.town_id == access.town.id, User.deleted_at.is_(None))
        .order_by(TownMember.created_at)
    ).all()
    return [_member_out(r.User, r.TownMember.role, r.TownMember.created_at) for r in rows]


@router.post("", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def add_member(
    payload: MemberCreate,
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("admin")),
) -> MemberOut:
    """Add a user to this town by email. Creates the account if it doesn't exist
    or reactivates a deactivated one; they gain access on sign-in, matched by
    email. An existing active account only gains this membership."""
    email = payload.email.strip().lower()
    user = db.execute(
        select(User).where(func.lower(User.email) == email)
    ).scalar_one_or_none()

    if user is None:
        # users.role only drives the legacy unscoped routes, so a new account gets
        # the lowest level there whatever its role in this town.
        user = User(email=email, name=payload.name, role="read", created_by=access.user.id)
        db.add(user)
        db.flush()
    elif user.deleted_at is not None:
        user.deleted_at = None
        user.name = payload.name
    elif db.get(TownMember, (user.id, access.town.id)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este usuario ya pertenece al proyecto.",
        )

    member = db.get(TownMember, (user.id, access.town.id))
    if member is None:
        member = TownMember(
            user_id=user.id,
            town_id=access.town.id,
            role=payload.role,
            created_by=access.user.id,
        )
        db.add(member)
    else:
        # A deactivated account that kept its membership here.
        member.role = payload.role
    db.flush()
    _log(db, access, "create", user)
    db.commit()
    db.refresh(member)
    return _member_out(user, member.role, member.created_at)


@router.put("/{user_id}", response_model=MemberOut)
def update_member(
    user_id: uuid.UUID,
    payload: MemberUpdate,
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("admin")),
) -> MemberOut:
    """Change a member's role in this town."""
    _reject_self_change(access, user_id, "No puedes cambiar tu propio rol.")
    member, user = _get_member(db, access.town.id, user_id)
    member.role = payload.role
    _log(db, access, "update", user)
    db.commit()
    return _member_out(user, member.role, member.created_at)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    access: TownAccess = Depends(require_town_role("admin")),
) -> None:
    """Remove a user from this town. Their account and other towns are unaffected."""
    _reject_self_change(access, user_id, "No puedes quitarte a ti mismo del proyecto.")
    member, user = _get_member(db, access.town.id, user_id)
    _log(db, access, "delete", user)
    db.delete(member)
    db.commit()
