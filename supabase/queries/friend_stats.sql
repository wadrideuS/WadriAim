begin;
create or replace function public.friend_training_history(friend_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare history jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if friend_id<>auth.uid() and not exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester=auth.uid() and f.recipient=friend_id) or (f.recipient=auth.uid() and f.requester=friend_id))) then
  raise exception 'Accepted friendship required' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('name',entry->'name','mode',entry->'mode','score',entry->'score','hits',entry->'hits','headshots',entry->'headshots','accuracy',entry->'accuracy')),'[]'::jsonb)
 into history from public.player_settings s cross join lateral jsonb_array_elements(case when jsonb_typeof(s.value)='array' then s.value else '[]'::jsonb end) entry
 where s.user_id=friend_id and s.key='wa-history';
 return coalesce(history,'[]'::jsonb);
end;
$$;
revoke all on function public.friend_training_history(uuid) from public,anon;
grant execute on function public.friend_training_history(uuid) to authenticated;
commit;
