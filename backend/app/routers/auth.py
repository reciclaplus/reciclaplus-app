"""Auth-related endpoints.

Login/logout/refresh are handled by the Supabase client directly; the backend
only exposes the current user's identity and their towns.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models.town import Town
from app.models.town_member import TownMember
from app.models.user import User
from app.schemas import UserMe, UserTown

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserMe)
def read_me(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserMe:
    """Return the caller's identity and the towns they can access, with their
    role in each. Superadmins get every non-archived town as admin."""
    if user.is_superadmin:
        rows = db.execute(
            select(Town.id, Town.name)
            .where(Town.archived_at.is_(None))
            .order_by(Town.name)
        ).all()
        towns = [UserTown(id=r.id, name=r.name, role="admin") for r in rows]
    else:
        rows = db.execute(
            select(Town.id, Town.name, TownMember.role)
            .join(TownMember, TownMember.town_id == Town.id)
            .where(TownMember.user_id == user.id, Town.archived_at.is_(None))
            .order_by(Town.name)
        ).all()
        towns = [UserTown(id=r.id, name=r.name, role=r.role) for r in rows]
    return UserMe(
        id=user.id,
        email=user.email,
        name=user.name,
        is_superadmin=user.is_superadmin,
        towns=towns,
    )
