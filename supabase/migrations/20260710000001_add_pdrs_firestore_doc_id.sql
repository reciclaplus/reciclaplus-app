-- Track the source Firestore document id on imported PDRs so re-imports can
-- upsert instead of blindly re-inserting (this caused duplicate PDRs before).

alter table public.pdrs add column firestore_doc_id text unique;
