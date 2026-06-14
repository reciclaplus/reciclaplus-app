-- Users table: platform users and their roles.
-- users.id references Supabase Auth's auth.users, linking platform roles to
-- authenticated identities. RLS is deny-all — the FastAPI backend is the sole
-- data gateway.

create table if not exists public.users (
    id uuid primary key references auth.users (id) on delete cascade,
    email text not null unique,
    name text,
    role text not null default 'read' check (role in ('read', 'write', 'admin')),
    created_at timestamptz not null default now(),
    created_by uuid references public.users (id) on delete set null
);

-- Deny-all: enable RLS and define no policies so PostgREST/anon access is
-- blocked. The backend connects as the Postgres role, which bypasses RLS.
alter table public.users enable row level security;
