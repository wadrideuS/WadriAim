begin;
create schema if not exists private;
create table if not exists private.username_auth_attempts (
  username text not null,
  recovery boolean not null,
  window_start timestamptz not null,
  attempts integer not null,
  primary key (username, recovery)
);
alter table private.username_auth_attempts enable row level security;
revoke all on private.username_auth_attempts from public, anon, authenticated;
create or replace function public.allow_username_auth_attempt(candidate text, recovery boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare attempt_count integer;
begin
  if candidate !~ '^[a-z0-9_]{3,20}$' then return false; end if;
  delete from private.username_auth_attempts where window_start < now() - interval '1 day';
  insert into private.username_auth_attempts as a (username,recovery,window_start,attempts)
  values(candidate,recovery,now(),1)
  on conflict on constraint username_auth_attempts_pkey do update set
    attempts = case when a.window_start < now() - interval '10 minutes' then 1 else a.attempts + 1 end,
    window_start = case when a.window_start < now() - interval '10 minutes' then now() else a.window_start end
  returning attempts into attempt_count;
  return attempt_count <= case when recovery then 3 else 15 end;
end;
$$;
revoke all on function public.allow_username_auth_attempt(text,boolean) from public, anon, authenticated;
grant execute on function public.allow_username_auth_attempt(text,boolean) to service_role;
commit;
