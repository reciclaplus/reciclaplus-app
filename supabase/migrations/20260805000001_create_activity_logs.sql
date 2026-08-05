-- Activity log: audit trail for mutating actions (PRD §6, §7). Records who did
-- what to which resource. RLS deny-all — the backend is the sole data gateway.

create table if not exists public.activity_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users (id) on delete set null,
    action text not null check (action in ('create', 'update', 'delete')),
    resource_type text not null check (resource_type in ('pdr', 'user')),
    resource_id uuid not null,
    -- Snapshot of the resource's name/email at the time of the action (not a
    -- join) so the log stays readable after a rename or a hard-deleted user.
    resource_name text not null,
    created_at timestamptz not null default now()
);

create index idx_activity_logs_resource on public.activity_logs (resource_type, resource_id);
create index idx_activity_logs_created_at on public.activity_logs (created_at desc);

alter table public.activity_logs enable row level security;
