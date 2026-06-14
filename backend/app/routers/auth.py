"""Auth-related endpoints.

Login/logout/refresh are handled by the Supabase client directly; the backend
only exposes the current user's identity and role.
"""

from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.models.user import User
from app.schemas import UserMe

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserMe)
def read_me(user: User = Depends(get_current_user)) -> User:
    """Return the current authenticated user's identity and platform role."""
    return user
