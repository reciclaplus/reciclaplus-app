-- Soft-delete PDRs instead of hard-deleting so their collection history is
-- preserved (collections.pdr_id cascades on hard delete, which would wipe it).
alter table public.pdrs add column deleted_at timestamptz;

create index idx_pdrs_deleted_at on public.pdrs (deleted_at) where deleted_at is null;
