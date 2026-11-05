-- Multi-town support, phase 1 (expand). See issue 62.
--
-- Adds town scoping alongside the existing single-town columns and backfills
-- all existing data to Sabana Yegua. Purely additive for the running app: new
-- columns stay nullable until the contract phase, which re-backfills anything
-- written in between, then sets NOT NULL and drops the old text columns.
--
-- Stops before changing anything if a PDR's community/neighborhood text has no
-- matching config row (backend/scripts/report_pdr_location_mismatches.py lists
-- them so they can be resolved first).

-- PDR #23 had a barrio from another community; its neighbors at the same
-- location are all in Barrio Pintado. Matches on the old text too, so it does
-- nothing if the row has since been corrected.
update public.pdrs
set neighborhood = 'Barrio Pintado'
where internal_id = 23
  and community = 'Sabana Yegua'
  and neighborhood = 'Nature Village';

do $$
declare
    sabana_yegua_id uuid;
    unmatched_count bigint;
    unmatched_sample text;
begin
    select id into sabana_yegua_id from public.towns where name = 'Sabana Yegua';
    if sabana_yegua_id is null then
        raise exception 'Multi-town migration: town "Sabana Yegua" not found';
    end if;

    select count(*), string_agg(distinct p.community || ' / ' || p.neighborhood, '; ')
    into unmatched_count, unmatched_sample
    from public.pdrs p
    where not exists (
        select 1
        from public.communities c
        join public.neighborhoods n on n.community_id = c.id
        where c.town_id = sabana_yegua_id
          and c.name = p.community
          and n.name = p.neighborhood
    );

    if unmatched_count > 0 then
        raise exception
            'Multi-town migration: % PDR(s) have no matching community/neighborhood: %',
            unmatched_count, unmatched_sample;
    end if;
end $$;

-- Per-town settings. archived_at: an archived town is hidden and blocks access
-- while keeping its data (restorable).
alter table public.towns
    add column map_zoom integer not null default 13 check (map_zoom between 1 and 22),
    add column plastic_types text[] not null default array['pet', 'hdpe', 'pp', 'trash'],
    add column report_partner_text text,
    add column archived_at timestamptz;

-- Global superadmin: sees every town and manages towns themselves.
alter table public.users
    add column is_superadmin boolean not null default false;

-- A user's role within one town. Replaces users.role in the contract phase.
create table public.town_members (
    user_id uuid not null references public.users (id) on delete cascade,
    town_id uuid not null references public.towns (id) on delete cascade,
    role text not null check (role in ('read', 'write', 'admin')),
    created_at timestamptz not null default now(),
    created_by uuid references public.users (id) on delete set null,
    primary key (user_id, town_id)
);

create index idx_town_members_town_id on public.town_members (town_id);

alter table public.town_members enable row level security;

-- PDRs link to their town and neighborhood (community is derived through the
-- neighborhood). RESTRICT: config in use by a PDR, even a soft-deleted one that
-- still has collection history, cannot be deleted.
alter table public.pdrs
    add column town_id uuid references public.towns (id) on delete restrict,
    add column neighborhood_id uuid references public.neighborhoods (id) on delete restrict;

create index idx_pdrs_town_id on public.pdrs (town_id);
create index idx_pdrs_neighborhood_id on public.pdrs (neighborhood_id);

-- Plastic types become per-town and are validated by the backend. The CHECK must
-- go: removing a type from a town's list has to leave historical entries valid.
alter table public.weight_entries
    add column town_id uuid references public.towns (id) on delete restrict,
    drop constraint if exists weight_entries_plastic_type_check;

create index idx_weight_entries_town_date on public.weight_entries (town_id, date desc);

-- This table was created without RLS, against the deny-all rule on every table.
alter table public.weight_entries enable row level security;

-- Audit logs record their town (null for global actions such as account changes)
-- and cover all mutating actions, not only PDRs and users. SET NULL: a log entry
-- outlives a deleted town and keeps its resource_name snapshot.
alter table public.activity_logs
    add column town_id uuid references public.towns (id) on delete set null,
    drop constraint if exists activity_logs_resource_type_check,
    add constraint activity_logs_resource_type_check check (
        resource_type in (
            'pdr', 'user', 'town', 'community', 'neighborhood',
            'collection', 'weight', 'member'
        )
    );

create index idx_activity_logs_town_created_at
    on public.activity_logs (town_id, created_at desc);

-- The configured category list never matched what PDRs actually use. Align it,
-- so the list can be used to validate categories when they are set or changed.
update public.towns
set categories = coalesce(
    (select array_agg(distinct category order by category) from public.pdrs),
    categories
)
where name = 'Sabana Yegua';

-- Backfill: all existing data belongs to Sabana Yegua.
update public.pdrs p
set town_id = c.town_id,
    neighborhood_id = n.id
from public.communities c
join public.neighborhoods n on n.community_id = c.id
where c.town_id = (select id from public.towns where name = 'Sabana Yegua')
  and c.name = p.community
  and n.name = p.neighborhood;

update public.weight_entries
set town_id = (select id from public.towns where name = 'Sabana Yegua');

update public.activity_logs
set town_id = (select id from public.towns where name = 'Sabana Yegua')
where resource_type = 'pdr';

-- Active users keep their current role, in Sabana Yegua. Deactivated accounts get
-- no membership, so reactivating one later doesn't silently restore access.
insert into public.town_members (user_id, town_id, role)
select u.id, t.id, u.role
from public.users u
cross join public.towns t
where t.name = 'Sabana Yegua'
  and u.deleted_at is null;
