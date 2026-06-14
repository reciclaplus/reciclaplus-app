-- One-time admin bootstrap.
--
-- Run this AFTER the admin has signed in with Google at least once (which
-- creates their row in auth.users). It provisions/updates their public.users
-- row with the 'admin' role. Adjust the email if needed.

insert into public.users (id, email, name, role)
select
    au.id,
    au.email,
    coalesce(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name'),
    'admin'
from auth.users au
where au.email = 'marcvilaribera@gmail.com'
on conflict (id) do update set role = 'admin';
