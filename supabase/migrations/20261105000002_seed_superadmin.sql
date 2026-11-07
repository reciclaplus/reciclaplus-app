-- The first superadmin (multi-town support, issue 62). Others are promoted from
-- the app. Does nothing if this account doesn't exist in the environment.
update public.users
set is_superadmin = true
where lower(email) = 'marcvilaribera@gmail.com';
