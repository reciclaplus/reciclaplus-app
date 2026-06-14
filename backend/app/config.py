"""Application configuration loaded from environment variables."""

import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Environment-driven settings. Never hardcode secrets."""

    # Supabase project URL, e.g. https://xxxx.supabase.co
    supabase_url: str = os.environ.get("SUPABASE_URL", "")

    # Legacy HS256 JWT secret (Supabase dashboard -> API -> JWT Settings).
    # If empty, tokens are verified via the project's JWKS endpoint instead.
    supabase_jwt_secret: str = os.environ.get("SUPABASE_JWT_SECRET", "")

    # Direct Postgres connection string (SQLAlchemy URL),
    # e.g. postgresql+psycopg://postgres:pass@host:5432/postgres
    database_url: str = os.environ.get("DATABASE_URL", "")

    # Expected audience claim for Supabase access tokens.
    jwt_audience: str = os.environ.get("SUPABASE_JWT_AUD", "authenticated")

    # Comma-separated list of allowed CORS origins.
    cors_origins: list[str] = [
        origin.strip()
        for origin in os.environ.get(
            "CORS_ORIGINS", "http://localhost:3000"
        ).split(",")
        if origin.strip()
    ]

    @property
    def jwks_url(self) -> str:
        return f"{self.supabase_url}/auth/v1/.well-known/jwks.json"


settings = Settings()
