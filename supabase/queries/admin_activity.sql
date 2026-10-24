begin;
create schema if not exists private;
create table if not exists private.app_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table if not exists private.live_activity (
 token uuid primary key,
 user_id uuid references auth.users(id) on delete cascade,
 activity text not null check(activity in ('browsing','playing','paused')),
 mode integer check(mode between 0 and 12),
 seen_at timestamptz not null default now()
);
create index if not exists live_activity_seen_idx on private.live_activity(seen_at);
alter table private.app_admins enable row level security;
alter table private.live_activity enable row level security;
revoke all on private.app_admins,private.live_activity from public,anon,authenticated;

create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from private.app_admins a where a.user_id=auth.uid());
$$;
revoke all on function public.is_app_admin() from public,anon;
grant execute on function public.is_app_admin() to authenticated;

create or replace function public.activity_ping(session_token uuid, current_activity text default 'browsing', current_mode integer default null, leaving boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 if session_token is null then raise exception 'Missing session'; end if;
 if current_activity not in ('browsing','playing','paused') or current_activity is null then raise exception 'Invalid activity'; end if;
 if current_mode is not null and current_mode not between 0 and 12 then raise exception 'Invalid mode'; end if;
 if current_activity in ('playing','paused') and current_mode is null then raise exception 'Missing mode'; end if;
 if leaving then
   delete from private.live_activity where token=session_token and user_id is not distinct from auth.uid();
   return;
 end if;
 delete from private.live_activity where seen_at < now()-interval '5 minutes';
 insert into private.live_activity as a(token,user_id,activity,mode,seen_at)
 values(session_token,auth.uid(),current_activity,case when current_activity='browsing' then null else current_mode end,now())
 on conflict(token) do update set user_id=excluded.user_id,activity=excluded.activity,mode=excluded.mode,seen_at=excluded.seen_at
 where a.user_id is null or a.user_id=auth.uid();
end;
$$;
revoke all on function public.activity_ping(uuid,text,integer,boolean) from public;
grant execute on function public.activity_ping(uuid,text,integer,boolean) to anon,authenticated;

create or replace function public.admin_activity_snapshot() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_app_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 with latest as (
   select distinct on(coalesce(a.user_id::text,a.token::text)) a.user_id,a.activity,a.mode,a.seen_at
   from private.live_activity a where a.seen_at>now()-interval '75 seconds'
   order by coalesce(a.user_id::text,a.token::text),case a.activity when 'playing' then 0 when 'paused' then 1 else 2 end,a.seen_at desc
 ), people as (
   select l.user_id,p.username,l.activity,l.mode,l.seen_at from latest l left join public.profiles p on p.id=l.user_id
 )
 select jsonb_build_object(
   'total',count(*),'playing',count(*) filter(where activity='playing'),
   'browsing',count(*) filter(where activity='browsing'),'paused',count(*) filter(where activity='paused'),
   'members',count(*) filter(where user_id is not null),'guests',count(*) filter(where user_id is null),
   'updated_at',now(),
   'people',coalesce(jsonb_agg(jsonb_build_object('username',username,'activity',activity,'mode',mode,'seen_at',seen_at) order by seen_at desc),'[]'::jsonb)
 ) into result from people;
 return result;
end;
$$;
revoke all on function public.admin_activity_snapshot() from public,anon;
grant execute on function public.admin_activity_snapshot() to authenticated;
commit;
