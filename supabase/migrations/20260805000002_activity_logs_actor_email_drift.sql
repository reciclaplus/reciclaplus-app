-- Documents a change that was applied directly to the reciclapp-test project
-- outside of a checked-in migration (schema drift): activity_logs gained an
-- actor_email column, briefly defaulted to '', with the default later
-- dropped. This file backfills the migration history to match that reality;
-- 20260811000001 finishes the job (NOT NULL + backfill) for every other
-- environment.

alter table public.activity_logs
    add column if not exists actor_email text not null default '';

alter table public.activity_logs
    alter column actor_email drop default;
