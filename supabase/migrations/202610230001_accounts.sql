begin;
create table public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check(username ~ '^[a-z0-9_]{3,20}$'),
 display_name text not null default '' check(length(display_name)<=40),
 avatar_path text check(avatar_path is null or length(avatar_path)<200),
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profile_read on public.profiles for select to authenticated using(true);
create policy profile_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
grant select on public.profiles to authenticated;
grant update(username,display_name,avatar_path) on public.profiles to authenticated;
create table public.player_settings(
 user_id uuid not null references public.profiles(id) on delete cascade,
 key text not null check(key ~ '^wa-[a-z0-9-]{1,48}$'),
 value jsonb not null check(octet_length(value::text)<=262144),
 primary key(user_id,key)
);
alter table public.player_settings enable row level security;
create policy settings_read on public.player_settings for select to authenticated using(user_id=(select auth.uid()));
create policy settings_write on public.player_settings for insert to authenticated with check(user_id=(select auth.uid()));
create policy settings_update on public.player_settings for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy settings_delete on public.player_settings for delete to authenticated using(user_id=(select auth.uid()));
grant select,insert,update,delete on public.player_settings to authenticated;
create function public.on_wadriaim_signup() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,username) values(new.id,lower(trim(new.raw_user_meta_data->>'username')));
 return new;
end $$;
create trigger wadriaim_signup after insert on auth.users for each row execute function public.on_wadriaim_signup();
revoke all on function public.on_wadriaim_signup() from public;
create function public.username_available(candidate text) returns boolean language sql stable security definer set search_path='' as $$
 select lower(trim(candidate)) ~ '^[a-z0-9_]{3,20}$' and not exists(select 1 from public.profiles where username=lower(trim(candidate)));
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon,authenticated;
create table public.friendships(
 id uuid primary key default gen_random_uuid(),
 requester uuid not null references public.profiles(id) on delete cascade,
 recipient uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted')),
 created_at timestamptz not null default now(),
 check(requester<>recipient)
);
create unique index friendship_pair on public.friendships(least(requester,recipient),greatest(requester,recipient));
alter table public.friendships enable row level security;
create policy friends_read on public.friendships for select to authenticated using((select auth.uid()) in (requester,recipient));
create policy friends_delete on public.friendships for delete to authenticated using((select auth.uid()) in (requester,recipient));
grant select,delete on public.friendships to authenticated;
create function public.request_friend(friend_username text) returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid; result uuid;
begin
 if auth.uid() is null then raise exception 'Inicia sesion para agregar amigos'; end if;
 select id into target from public.profiles where username=lower(trim(friend_username));
 if target is null then raise exception 'No encontramos ese usuario'; end if;
 if target=auth.uid() then raise exception 'No puedes agregarte a ti mismo'; end if;
 insert into public.friendships(requester,recipient) values(auth.uid(),target) returning id into result;
 return result;
exception when unique_violation then raise exception 'Ya existe una amistad o solicitud entre ustedes';
end $$;
create function public.accept_friend(request_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.friendships set status='accepted' where id=request_id and recipient=auth.uid() and status='pending';
 if not found then raise exception 'No puedes aceptar esta solicitud'; end if;
end $$;
revoke all on function public.request_friend(text),public.accept_friend(uuid) from public;
grant execute on function public.request_friend(text),public.accept_friend(uuid) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('avatars','avatars',false,2097152,array['image/jpeg','image/png','image/webp']);
create policy avatar_read on storage.objects for select to authenticated using(bucket_id='avatars');
create policy avatar_insert on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatar_update on storage.objects for update to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatar_delete on storage.objects for delete to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
