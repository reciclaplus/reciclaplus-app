-- Pre-authorized users (invitations). With Google-only login, an admin can't
-- create someone's auth identity directly; instead they pre-authorize an email
-- + role here. On that person's first sign-in, the backend provisions their
-- public.users row from this table and consumes the entry. RLS deny-all.

create table if not exists public.allowed_users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    name text,
    role text not null default 'read' check (role in ('read', 'write', 'admin')),
    created_at timestamptz not null default now(),
    created_by uuid references public.users (id) on delete set null
);

alter table public.allowed_users enable row level security;
