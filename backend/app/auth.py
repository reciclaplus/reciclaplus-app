"""Authentication & authorization.

Verifies Supabase-issued JWTs (HS256 via the legacy shared secret, or
asymmetric algorithms via the project's JWKS endpoint), resolves the caller's
platform identity from the `users` table, and provides the per-town permission
dependencies. Every protected endpoint depends on this module.
"""

import uuid
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models.town import Community, Neighborhood, Town
from app.models.town_member import TownMember
from app.models.user import User

# Hierarchical roles: each inherits the permissions of those below it.
ROLE_LEVELS: dict[str, int] = {"read": 0, "write": 1, "admin": 2}

bearer_scheme = HTTPBearer(auto_error=True)


@lru_cache(maxsize=1)
def _jwks_client() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(settings.jwks_url)


def _decode_token(token: str) -> dict:
    """Verify a Supabase JWT and return its claims."""
    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError as exc:
        raise _unauthorized("Invalid token header") from exc

    alg = header.get("alg", "")
    try:
        if alg == "HS256":
            if not settings.supabase_jwt_secret:
                raise _unauthorized("HS256 token but no JWT secret configured")
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience=settings.jwt_audience,
            )
        # Asymmetric signing (RS256/ES256) via JWKS.
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=[alg],
            audience=settings.jwt_audience,
        )
    except jwt.InvalidTokenError as exc:
        raise _unauthorized("Invalid or expired token") from exc


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the authenticated user from the bearer token.

    Verifies the JWT, then matches the caller to a `users` row **by email**
    (the verified email claim). Platform users are keyed by their own uuid and
    are created directly by admins, so a valid Supabase identity whose email
    has not been added to `users` is rejected (403). A deactivated (soft-
    deleted) user is rejected the same way, even though their Supabase
    identity still verifies.
    """
    claims = _decode_token(credentials.credentials)
    email = claims.get("email")
    if not email:
        raise _unauthorized("Token missing email")

    user = db.execute(
        select(User).where(func.lower(User.email) == email.lower())
    ).scalar_one_or_none()
    if user is None or user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not provisioned in this platform",
        )
    return user


def require_role(minimum: str):
    """Dependency factory enforcing a minimum global role (hierarchical).

    Legacy: only for the unscoped routes, removed in the multi-town contract
    phase. New routes use require_town_role.
    """
    required_level = ROLE_LEVELS[minimum]

    def checker(user: User = Depends(get_current_user)) -> User:
        if ROLE_LEVELS.get(user.role, -1) < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires '{minimum}' role",
            )
        return user

    return checker


@dataclass(frozen=True)
class TownAccess:
    """A caller's verified access to one town."""

    user: User
    town: Town
    role: str


def _check_town_access(db: Session, user: User, town: Town, minimum: str) -> TownAccess:
    """Authorize a user for a town, or raise 403.

    Superadmins act as admin in every town without a membership. An archived
    town blocks everyone: superadmins restore it through its own endpoint.
    """
    if user.is_superadmin:
        role = "admin"
    else:
        role = db.scalar(
            select(TownMember.role).where(
                TownMember.user_id == user.id, TownMember.town_id == town.id
            )
        )
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes acceso a este proyecto",
            )
    if town.archived_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este proyecto está archivado",
        )
    if ROLE_LEVELS.get(role, -1) < ROLE_LEVELS[minimum]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires '{minimum}' role in this town",
        )
    return TownAccess(user=user, town=town, role=role)


def require_town_role(minimum: str):
    """Dependency factory for routes with a {town_id} path parameter.

    Returns the caller's TownAccess: 404 for an unknown town, 403 otherwise if
    the caller lacks the minimum role there or the town is archived.
    """

    def checker(
        town_id: uuid.UUID,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> TownAccess:
        town = db.get(Town, town_id)
        if town is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Town not found")
        return _check_town_access(db, user, town, minimum)

    return checker


def require_community_role(minimum: str):
    """Like require_town_role, for routes with a {community_id} path parameter:
    authorizes against the community's own town."""

    def checker(
        community_id: uuid.UUID,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> TownAccess:
        community = db.get(Community, community_id)
        if community is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")
        return _check_town_access(db, user, db.get(Town, community.town_id), minimum)

    return checker


def require_neighborhood_role(minimum: str):
    """Like require_town_role, for routes with a {neighborhood_id} path
    parameter: authorizes against the neighborhood's own town."""

    def checker(
        neighborhood_id: uuid.UUID,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> TownAccess:
        neighborhood = db.get(Neighborhood, neighborhood_id)
        if neighborhood is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Neighborhood not found")
        community = db.get(Community, neighborhood.community_id)
        return _check_town_access(db, user, db.get(Town, community.town_id), minimum)

    return checker


def require_superadmin(user: User = Depends(get_current_user)) -> User:
    """Dependency for global actions: creating, archiving, restoring and deleting
    towns."""
    if not user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Requires superadmin"
        )
    return user
