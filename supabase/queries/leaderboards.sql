-- Ranking global por modo y puntos por equipo.
-- Ejecutar una vez en el SQL Editor de Supabase (igual que el resto de /queries).
begin;

-- Nombres de los 15 modos (para historiales antiguos que no guardaban el índice).
create or replace function public.wadriaim_mode_names() returns text[]
language sql immutable set search_path='' as $$
 select array['Microflicks','Flick Shot','Smooth Tracking','Headshot Only','Reflex Rush','Target Switch',
  'NO APTO PARA PLATAS','Circuito de saltos','Aterrizaje preciso','Bunny Jump','Angle Peek',
  'Haven · Defender la spike','Supervivencia','Esquiva de flashes','Duelo dinámico'];
$$;

-- Récord de otros jugadores (ahora acepta los modos 13 y 14).
create or replace function public.mode_records(mode_id integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare names text[]:=public.wadriaim_mode_names(); result jsonb;
begin
 if mode_id not between 0 and 14 then raise exception 'Invalid mode';end if;
 with rounds as (
  select p.id,p.username,
  case when jsonb_typeof(entry->'score')='number' and (entry->>'score')::numeric>0 then least(1000000,(entry->>'score')::numeric)
       when jsonb_typeof(entry->'hits')='number' then greatest(0,least(1000000,(entry->>'hits')::numeric)) else 0 end as points
  from public.player_settings s join public.profiles p on p.id=s.user_id
  cross join lateral jsonb_array_elements(case when jsonb_typeof(s.value)='array' then s.value else '[]'::jsonb end) entry
  where s.key='wa-history' and p.id is distinct from auth.uid()
    and (entry->>'mode'=mode_id::text or (entry->>'mode' is null and entry->>'name'=names[mode_id+1]))
    and coalesce(entry->>'endless','false')<>'true'
    and (mode_id=6 or coalesce(entry->>'ammoMode','reload')<>'infinite')
 ), best as (select username,max(points) as score from rounds group by id,username having max(points)>0 order by score desc,username limit 5)
 select coalesce(jsonb_agg(jsonb_build_object('username',username,'score',score) order by score desc,username),'[]'::jsonb) into result from best;
 return result;
end;
$$;

-- Top global de un modo: mejor marca de cada jugador. Las rondas sin límite de
-- tiempo o con munición infinita no cuentan (salvo NO APTO, que siempre es infinita).
create or replace function public.global_leaderboard(mode_id integer, max_rows integer default 50) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare names text[]:=public.wadriaim_mode_names(); result jsonb;
begin
 if mode_id not between 0 and 14 then raise exception 'Invalid mode';end if;
 max_rows:=least(greatest(coalesce(max_rows,50),1),100);
 with rounds as (
  select p.id,p.username,p.favorite_team,
  case when jsonb_typeof(entry->'score')='number' and (entry->>'score')::numeric>0 then least(1000000,(entry->>'score')::numeric)
       when jsonb_typeof(entry->'hits')='number' then greatest(0,least(1000000,(entry->>'hits')::numeric)) else 0 end as points,
  case when jsonb_typeof(entry->'accuracy')='number' then (entry->>'accuracy')::numeric else null end as accuracy
  from public.player_settings s join public.profiles p on p.id=s.user_id
  cross join lateral jsonb_array_elements(case when jsonb_typeof(s.value)='array' then s.value else '[]'::jsonb end) entry
  where s.key='wa-history' and not p.needs_username
    and (entry->>'mode'=mode_id::text or (entry->>'mode' is null and entry->>'name'=names[mode_id+1]))
    and coalesce(entry->>'endless','false')<>'true'
    and (mode_id=6 or coalesce(entry->>'ammoMode','reload')<>'infinite')
 ), best as (
  select id,username,favorite_team,max(points) as score,round(avg(accuracy)) as accuracy,count(*) as rounds
  from rounds group by id,username,favorite_team having max(points)>0
 ), ranked as (
  select *,rank() over(order by score desc) as position from best
 )
 select jsonb_build_object(
  'rows',coalesce((select jsonb_agg(jsonb_build_object('position',position,'username',username,'team',favorite_team,'score',score,'accuracy',accuracy,'rounds',rounds,'me',id=auth.uid()) order by position,username)
         from (select * from ranked order by position,username limit max_rows) top),'[]'::jsonb),
  'me',(select jsonb_build_object('position',position,'username',username,'team',favorite_team,'score',score,'accuracy',accuracy,'rounds',rounds,'me',true) from ranked where id=auth.uid()),
  'players',(select count(*) from ranked)
 ) into result;
 return result;
end;
$$;

-- Puntos por equipo: cada jugador que elige un equipo le suma +1.
create or replace function public.team_leaderboard() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('team',team,'points',points) order by points desc,team),'[]'::jsonb)
 from (select favorite_team as team,count(*) as points from public.profiles where favorite_team<>'' group by favorite_team) t;
$$;

revoke all on function public.mode_records(integer) from public;
revoke all on function public.global_leaderboard(integer,integer) from public;
revoke all on function public.team_leaderboard() from public;
grant execute on function public.mode_records(integer) to anon,authenticated;
grant execute on function public.global_leaderboard(integer,integer) to anon,authenticated;
grant execute on function public.team_leaderboard() to anon,authenticated;
commit;
