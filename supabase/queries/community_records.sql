begin;
create or replace function public.mode_records(mode_id integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare names text[]:=array['Microflicks','Flick Shot','Smooth Tracking','Headshot Only','Reflex Rush','Target Switch','NO APTO PARA PLATAS','Circuito de saltos','Aterrizaje preciso','Bunny Jump','Angle Peek','Haven · Defender la spike','Supervivencia']; result jsonb;
begin
 if mode_id not between 0 and 12 then raise exception 'Invalid mode';end if;
 with rounds as (
  select p.id,p.username,entry,
  case when jsonb_typeof(entry->'score')='number' and (entry->>'score')::numeric>0 then least(1000000,(entry->>'score')::numeric)
       when jsonb_typeof(entry->'hits')='number' then greatest(0,least(1000000,(entry->>'hits')::numeric)) else 0 end as points
  from public.player_settings s join public.profiles p on p.id=s.user_id
  cross join lateral jsonb_array_elements(case when jsonb_typeof(s.value)='array' then s.value else '[]'::jsonb end) entry
  where s.key='wa-history' and p.id is distinct from auth.uid() and (entry->>'mode'=mode_id::text or (entry->>'mode' is null and entry->>'name'=names[mode_id+1]))
 ), best as (select username,max(points) as score from rounds group by id,username having max(points)>0 order by score desc,username limit 5)
 select coalesce(jsonb_agg(jsonb_build_object('username',username,'score',score) order by score desc,username),'[]'::jsonb) into result from best;
 return result;
end;
$$;
revoke all on function public.mode_records(integer) from public;
grant execute on function public.mode_records(integer) to anon,authenticated;
commit;
