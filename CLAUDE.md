# ReciclApp

Waste & recycling collection management platform for the Dominican Republic. Full requirements live in [ReciclApp_PRD.md](ReciclApp_PRD.md) — read it before implementing any feature.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Material-UI (MUI), MUI X Charts, Google Maps API
- **Backend**: FastAPI (Python 3.12), SQLAlchemy 2.0 (direct Postgres connection to Supabase), Uvicorn/Gunicorn. Dependencies are managed with **uv** (`pyproject.toml` + `uv.lock`): use `uv sync`, `uv add <pkg>`, and `uv run <cmd>` — never pip directly.
- **Migrations**: Supabase CLI migrations (SQL files in `supabase/migrations/`), applied with `supabase db push`. No Alembic. The SQL migration files are the source of truth for the schema; keep SQLAlchemy models in sync with them by hand.
- **Database & Auth**: Supabase (PostgreSQL) with Google OAuth via Supabase Auth, cookie-based sessions (`@supabase/ssr`); the frontend sends a bearer token to FastAPI
- **Hosting**: Google Cloud App Engine

## Repository Layout

```
frontend/   Next.js app
backend/    FastAPI app
```

## Language Convention (important)

**All code is in English. All user-facing text is in Spanish.**

- English: variable names, function names, API routes, DB tables/columns, enum values, comments, commit messages, file names.
- Spanish: UI labels, button text, form fields, error messages shown to users, page titles.
- Never store Spanish strings in the database as data values (e.g. statuses are `collected`/`empty`/`unavailable`/`closed`, never `sí`/`no`).
- Keep UI strings in a centralized location (not hardcoded inline) so they're easy to find and update.

The one domain term that stays: **PDR** (_Punto de Recogida_ — pickup point). It's the established name for pickup points and is used in code as `pdr`/`pdrs`.

## Domain Glossary

| Term              | Meaning                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| PDR               | Pickup point (Punto de Recogida) — a location where plastic is collected |
| Collection pass   | Weekly visit to all PDRs, recording a status per point                   |
| Collection status | `collected`, `empty`, `unavailable`, `closed`                            |
| Weight categories | `pet`, `hdpe`, `pp`, `trash` (plastic resin codes)                       |
| ISO week key      | Collections are keyed by year + ISO week number                          |

## Roles & Access

Hierarchical roles: `read` < `write` < `admin`. Each inherits the lower role's permissions.

- Enforce roles **independently** on both frontend (`PermissionGuard` component) and backend (FastAPI dependency per endpoint). Never rely on frontend checks alone.
- `read`: view list, map, dashboard. `write`: + create/edit PDRs, collection passes, weights. `admin`: + user management, town configuration.

## Architecture Rules

- The FastAPI backend is **stateless** — no server-side session storage. Auth state lives in Supabase JWT cookies.
- Login/logout/refresh are handled by the Supabase client directly; the backend only verifies JWTs and exposes `GET /auth/me` for role lookup.
- Auth sessions are cookie-based via `@supabase/ssr` — tokens never in `localStorage`. API calls carry `Authorization: Bearer <access_token>` from the Supabase session.
- Database access is SQLAlchemy only (no `supabase-py` for data) — RLS is deny-all and the backend is the sole data gateway. Schema changes always go through Supabase CLI migrations (SQL files in `supabase/migrations/`).
- CORS origins are strictly whitelisted per environment — no wildcards in production.
- All mutating actions (PDR create/update/delete, collection passes, weights, user management) must write to the `activity_logs` audit table.
- Supabase is the single source of truth — no external file storage.

## API Conventions

- RESTful resource routes: `/pdrs`, `/collections`, `/weights`, `/users`, `/towns` (see PRD §5 for the full table).
- Collections are addressed by week: `/collections/{year}/{week}`.
- FastAPI's auto-generated OpenAPI docs must stay accurate — keep Pydantic models complete and typed.

## Frontend Conventions

- Pages: `/` (public landing), `/info` (public help), `/list`, `/map`, `/dashboard` (read), `/weights`, `/new-pdr`, `/collection-pass` (write), `/admin` (admin).
- Route names are kebab-case English.
- Mobile-first: field operators use phones. Every page must work on small screens.
- Keep components simple — non-technical users; minimize friction in forms.

### How to use Next.js here

Treat Next.js as a client-side SPA host. Its value in this project is the `@supabase/ssr` integration, which handles HTTP-only cookie sessions for the auth requirement — not SSR, static generation, or SEO (everything except `/` and `/info` is behind a login anyway).

Practical rules:

- Most components will be `"use client"` — that's fine and expected.
- All data fetching goes through FastAPI. Do not use Next.js API routes (the FastAPI backend is the API).
- Do not use Server Components, Server Actions, or server-side data fetching for application data — keep the data flow simple: client → FastAPI.
- Do not introduce Next.js caching strategies (`revalidate`, `unstable_cache`, etc.) — FastAPI owns caching decisions.
- The main reason to keep Next.js is the `@supabase/ssr` cookie-auth path. Don't hand-roll the OAuth exchange or store tokens in `localStorage`.

## Quality Bar

- Business logic must be unit-testable; critical backend endpoints need integration tests.
- Document public functions, API endpoints, and non-obvious logic.
- Follow standard Next.js and FastAPI best practices — clear separation of concerns, no unnecessary complexity.

## Environments

| Environment | Frontend                        | Backend                          |
| ----------- | -------------------------------- | --------------------------------- |
| Development | `localhost:3000`                 | `localhost:8000`                  |
| Testing     | Vercel preview (per git branch)  | FastAPI Cloud (shared test app)   |
| Production  | `reciclaplus.com`                | `api.reciclaplus.com`             |

Each environment has its own Supabase project — development never touches production data. Per-environment config (Supabase URL/keys, OAuth credentials, CORS origins, cookie flags) lives in environment variables — never committed.

### Testing environment

For trying out changes without touching real data: a dedicated Supabase project (`reciclapp-test`) holds the same schema (kept in sync via the same `supabase/migrations/` files), a single persistent FastAPI Cloud deployment serves as the shared test backend, and Vercel gives every pushed git branch an automatic preview URL wired to that backend.

- To point local dev at the test stack instead of real data, copy the commented "Testing environment" block in [frontend/.env.local.example](frontend/.env.local.example) and [backend/.env.example](backend/.env.example) over the defaults.
- The backend supports an optional `CORS_ORIGIN_REGEX` env var (see [backend/app/config.py](backend/app/config.py)) so the shared test deployment can allow all `*.vercel.app` preview subdomains — production keeps the exact-match `CORS_ORIGINS` list only, per the no-wildcards rule above.
- Every Claude Code worktree under `.claude/worktrees/` shares the same test backend and test database. After creating a worktree, run `node scripts/worktree-ports.js` once from its root to bootstrap it: it assigns the worktree a unique frontend/backend port pair (rewriting its `.claude/launch.json`) so parallel worktrees don't collide on 3000/8000, and — since `git worktree add` only checks out tracked files — copies the gitignored env files (`frontend/.env.local`, `backend/.env`) from the main checkout, pointing `NEXT_PUBLIC_API_BASE_URL` at the worktree's own backend port (a shared cloud test-backend URL is left untouched). It never overwrites existing env files and is safe to re-run. The main checkout always stays on 3000/8000 and its env files are left alone.
- To test authenticated pages locally without Google OAuth, set `NEXT_PUBLIC_ENABLE_DEV_LOGIN=true` (test env only — never production) to enable the email/password login on the landing page. It requires a Supabase auth user **and** a matching `public.users` row (the two are decoupled), both in the test project.
