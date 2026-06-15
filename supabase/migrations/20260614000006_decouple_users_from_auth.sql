-- Variant B: decouple platform users from Supabase auth identities.
--
-- Previously users.id was a FK to auth.users(id), so a users row could only
-- exist after the person signed in (hence the allowed_users invite table). We
-- now key users by their own uuid and match a login to a user by email, which
-- lets admins create user rows directly. Drop the auth FK and the invite table.

alter table public.users drop constraint if exists users_id_fkey;
alter table public.users alter column id set default gen_random_uuid();

drop table if exists public.allowed_users;
