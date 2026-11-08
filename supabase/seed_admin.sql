-- One-time superadmin bootstrap.
--
-- Run this AFTER the person has signed in with Google at least once (which
-- creates their row in auth.users). It provisions their public.users row as a
-- superadmin, with admin access to every town. Adjust the email if needed.
-- Town-level access for everyone else is managed in the app (town_members).

insert into public.users (id, email, name, is_superadmin)
select
    au.id,
    au.email,
    coalesce(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name'),
    true
from auth.users au
where au.email = 'marcvilaribera@gmail.com'
on conflict (email) do update set is_superadmin = true;
