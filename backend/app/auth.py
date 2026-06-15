"""Authentication & authorization.

Verifies Supabase-issued JWTs (HS256 via the legacy shared secret, or
asymmetric algorithms via the project's JWKS endpoint), resolves the caller's
platform role from the `users` table, and provides the reusable role-hierarchy
dependency `require_role`. Every protected endpoint depends on this module.
"""

from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
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
    has not been added to `users` is rejected (403).
    """
    claims = _decode_token(credentials.credentials)
    email = claims.get("email")
    if not email:
        raise _unauthorized("Token missing email")

    user = db.execute(
        select(User).where(func.lower(User.email) == email.lower())
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not provisioned in this platform",
        )
    return user


def require_role(minimum: str):
    """Dependency factory enforcing a minimum role (hierarchical)."""
    required_level = ROLE_LEVELS[minimum]

    def checker(user: User = Depends(get_current_user)) -> User:
        if ROLE_LEVELS.get(user.role, -1) < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires '{minimum}' role",
            )
        return user

    return checker
