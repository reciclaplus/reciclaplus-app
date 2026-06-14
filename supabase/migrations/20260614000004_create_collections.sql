-- Weekly collection records. One row per PDR per ISO week, storing the status
-- recorded during that week's collection pass. RLS deny-all — backend is the
-- sole data gateway.

create table if not exists public.collections (
    id uuid primary key default gen_random_uuid(),
    pdr_id uuid not null references public.pdrs (id) on delete cascade,
    year int not null,
    week int not null check (week between 1 and 53),
    status text not null check (status in ('collected', 'empty', 'unavailable', 'closed')),
    date date not null default current_date,
    created_at timestamptz not null default now(),
    created_by uuid references public.users (id) on delete set null,
    unique (pdr_id, year, week)
);

alter table public.collections enable row level security;
