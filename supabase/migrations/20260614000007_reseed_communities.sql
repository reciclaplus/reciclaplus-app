-- Replace placeholder communities and neighborhoods with the real ones for
-- Sabana Yegua. Deletes old community rows (cascades to neighborhoods) then
-- inserts the correct data.

do $$
declare
    v_town_id uuid;
    v_community_id uuid;
begin
    select id into v_town_id from public.towns where name = 'Sabana Yegua';

    -- Remove old placeholder communities (cascade deletes their neighborhoods)
    delete from public.communities where town_id = v_town_id;

    -- Sabana Yegua
    insert into public.communities (town_id, name) values (v_town_id, 'Sabana Yegua')
    returning id into v_community_id;
    insert into public.neighborhoods (community_id, name) values
        (v_community_id, 'Barrio Blanco'),
        (v_community_id, 'Barrio Pintado'),
        (v_community_id, 'Barrio Nuevo'),
        (v_community_id, 'Ojo de Agua'),
        (v_community_id, 'San Francisco'),
        (v_community_id, 'El Abanico'),
        (v_community_id, 'Los Cartones'),
        (v_community_id, 'Barrio Tranquilo'),
        (v_community_id, 'Las Mercedes');

    -- Km 13
    insert into public.communities (town_id, name) values (v_town_id, 'Km 13')
    returning id into v_community_id;
    insert into public.neighborhoods (community_id, name) values (v_community_id, 'Km 13');

    -- Km 15
    insert into public.communities (town_id, name) values (v_town_id, 'Km 15')
    returning id into v_community_id;
    insert into public.neighborhoods (community_id, name) values (v_community_id, 'Km 15');

    -- Nature Village
    insert into public.communities (town_id, name) values (v_town_id, 'Nature Village')
    returning id into v_community_id;
    insert into public.neighborhoods (community_id, name) values (v_community_id, 'Nature Village');

    -- Proyecto 2C
    insert into public.communities (town_id, name) values (v_town_id, 'Proyecto 2C')
    returning id into v_community_id;
    insert into public.neighborhoods (community_id, name) values (v_community_id, 'Proyecto 2C');

    -- Los Negros
    insert into public.communities (town_id, name) values (v_town_id, 'Los Negros')
    returning id into v_community_id;
    insert into public.neighborhoods (community_id, name) values (v_community_id, 'Los Negros');

    -- Barrera
    insert into public.communities (town_id, name) values (v_town_id, 'Barrera')
    returning id into v_community_id;
    insert into public.neighborhoods (community_id, name) values (v_community_id, 'Barrera');

    -- Km 8
    insert into public.communities (town_id, name) values (v_town_id, 'Km 8')
    returning id into v_community_id;
    insert into public.neighborhoods (community_id, name) values (v_community_id, 'Km 8');
end $$;
