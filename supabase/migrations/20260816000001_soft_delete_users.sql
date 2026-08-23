-- Soft-delete users instead of hard-deleting so pdrs.created_by and
-- activity_logs.user_id stay resolvable foreign keys after a user is removed
-- (see supabase/migrations/20260803000001_soft_delete_pdrs.sql for the same
-- pattern applied to PDRs).
alter table public.users add column deleted_at timestamptz;

create index idx_users_deleted_at on public.users (deleted_at) where deleted_at is null;
