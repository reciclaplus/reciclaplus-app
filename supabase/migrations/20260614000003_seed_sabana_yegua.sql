-- Seed the initial town (Sabana Yegua, Azua) with its categories, communities
-- and neighborhoods. Idempotent: safe to re-run.

insert into public.towns (name, map_center_lat, map_center_lng, categories)
values (
    'Sabana Yegua',
    18.7419,
    -70.9530,
    array['Colmado', 'Escuela', 'Iglesia', 'Residencia', 'Empresa']
)
on conflict (name) do update
    set map_center_lat = excluded.map_center_lat,
        map_center_lng = excluded.map_center_lng,
        categories = excluded.categories;

-- Communities (separate statement so the neighborhoods insert below can see
-- them — a CTE would not, as CTEs don't observe their own writes).
insert into public.communities (town_id, name)
select t.id, c.name
from public.towns t
cross join (values ('Centro'), ('Los Jovillos'), ('El Rosario')) as c(name)
where t.name = 'Sabana Yegua'
on conflict (town_id, name) do nothing;

-- Neighborhoods (barrios) within each community.
insert into public.neighborhoods (community_id, name)
select c.id, n.name
from public.communities c
join (values
    ('Centro', 'Barrio Nuevo'),
    ('Centro', 'La Placita'),
    ('Los Jovillos', 'Los Jovillos Arriba'),
    ('Los Jovillos', 'Los Jovillos Abajo'),
    ('El Rosario', 'El Rosario Centro'),
    ('El Rosario', 'La Loma')
) as n(community_name, name) on n.community_name = c.name
where c.town_id = (select id from public.towns where name = 'Sabana Yegua')
on conflict (community_id, name) do nothing;
