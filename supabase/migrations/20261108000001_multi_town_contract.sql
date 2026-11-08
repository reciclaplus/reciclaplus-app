-- Multi-town support, phase 5 (contract). See issue 62.
--
-- Run only once every backend serving this database uses the town-scoped
-- routes: this removes what the old routes read (pdrs.community,
-- pdrs.neighborhood, users.role).
--
-- 1. Re-backfill rows written through the old routes since the expand migration
--    (20261105000001), which could leave the new links empty.
-- 2. Stop, before changing any column, if a row still can't be linked or its
--    links disagree with each other.
-- 3. Make the links required and drop the old columns.

-- 1. Re-backfill. Matches text within the PDR's own town when it has one, else
--    within Sabana Yegua, the only town the old routes wrote to.
update public.pdrs p
set town_id = c.town_id,
    neighborhood_id = n.id
from public.communities c
join public.neighborhoods n on n.community_id = c.id
where p.neighborhood_id is null
  and c.town_id = coalesce(p.town_id, (select id from public.towns where name = 'Sabana Yegua'))
  and c.name = p.community
  and n.name = p.neighborhood;

update public.weight_entries
set town_id = (select id from public.towns where name = 'Sabana Yegua')
where town_id is null;

-- 2. Preflight.
do $$
declare
    problem_count bigint;
    sample text;
begin
    select count(*), string_agg(distinct coalesce(p.community, '?') || ' / ' || coalesce(p.neighborhood, '?'), '; ')
    into problem_count, sample
    from public.pdrs p
    where p.town_id is null or p.neighborhood_id is null;
    if problem_count > 0 then
        raise exception
            'Multi-town contract: % PDR(s) have no town or barrio link: %', problem_count, sample;
    end if;

    -- A PDR's town must be its barrio's town.
    select count(*), string_agg(p.id::text, ', ')
    into problem_count, sample
    from public.pdrs p
    join public.neighborhoods n on n.id = p.neighborhood_id
    join public.communities c on c.id = n.community_id
    where c.town_id <> p.town_id;
    if problem_count > 0 then
        raise exception
            'Multi-town contract: % PDR(s) are in a barrio of another town: %', problem_count, sample;
    end if;

    select count(*) into problem_count from public.weight_entries where town_id is null;
    if problem_count > 0 then
        raise exception 'Multi-town contract: % weight entries have no town', problem_count;
    end if;
end $$;

-- 3. Contract. A PDR's community now comes from its barrio, and access comes
--    from town_members (plus users.is_superadmin).
alter table public.pdrs
    alter column town_id set not null,
    alter column neighborhood_id set not null,
    drop column community,
    drop column neighborhood;

alter table public.weight_entries
    alter column town_id set not null;

alter table public.users
    drop column role;
