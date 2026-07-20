"""FastAPI application entry point.

Stateless backend: no server-side session storage. Auth state lives in the
Supabase JWT carried as a bearer token. CORS origins are strictly whitelisted
per environment (no wildcards in production; CORS_ORIGIN_REGEX is only meant
for the shared test backend matching Vercel's per-branch preview subdomains).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, collections, dashboard, pdrs, towns, users, weights

app = FastAPI(title="ReciclApp API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(towns.router)
app.include_router(pdrs.router)
app.include_router(collections.router)
app.include_router(users.router)
app.include_router(dashboard.router)
app.include_router(weights.router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    """Liveness check."""
    return {"status": "ok"}
