-- Record the acting user's email as a snapshot on each activity log row, so
-- entries stay attributable even after the actor's own account is renamed or
-- hard-deleted (mirrors resource_name's snapshot rationale).

alter table public.activity_logs
    add column if not exists actor_email text;

update public.activity_logs al
set actor_email = u.email
from public.users u
where (al.actor_email is null or al.actor_email = '') and al.user_id = u.id;

update public.activity_logs
set actor_email = 'unknown'
where actor_email is null or actor_email = '';

alter table public.activity_logs
    alter column actor_email set not null;
