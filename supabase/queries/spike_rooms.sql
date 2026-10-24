begin;
create table if not exists public.spike_rooms(id uuid primary key default gen_random_uuid(),join_code text unique not null,host_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '45 minutes');
create table if not exists public.spike_room_members(room_id uuid not null references public.spike_rooms(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,joined_at timestamptz not null default now(),primary key(room_id,user_id));
alter table public.spike_rooms add column if not exists capacity integer not null default 2 check(capacity in(2,4));
alter table public.spike_rooms add column if not exists mode integer not null default 11 check(mode in(11,12));
alter table public.spike_rooms enable row level security;
alter table public.spike_room_members enable row level security;
revoke all on public.spike_rooms,public.spike_room_members from anon,authenticated;
create or replace function public.is_spike_member(room uuid) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.spike_room_members m join public.spike_rooms r on r.id=m.room_id where m.room_id=room and m.user_id=auth.uid() and r.expires_at>now())$$;
revoke all on function public.is_spike_member(uuid) from public;grant execute on function public.is_spike_member(uuid) to authenticated;
create or replace function public.spike_room_info(room uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_spike_member(room) then raise exception 'Sala no disponible';end if;
 return (select jsonb_build_object('id',r.id,'code',r.join_code,'host',r.host_id,'capacity',r.capacity,'mode',r.mode,'members',(select jsonb_agg(jsonb_build_object('id',m.user_id,'username',p.username) order by m.joined_at) from public.spike_room_members m join public.profiles p on p.id=m.user_id where m.room_id=r.id)) from public.spike_rooms r where r.id=room);
end;$$;
create or replace function public.create_spike_room() returns jsonb language plpgsql security definer set search_path='' as $$declare room uuid; code text;
begin
 if auth.uid() is null then raise exception 'Inicia sesión para jugar con un amigo';end if;
 delete from public.spike_rooms where expires_at<now();
 if (select count(*) from public.spike_rooms where host_id=auth.uid())>=2 then raise exception 'Ya tienes dos salas abiertas';end if;
 code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
 insert into public.spike_rooms(join_code,host_id) values(code,auth.uid()) returning id into room;
 insert into public.spike_room_members(room_id,user_id) values(room,auth.uid());
 return public.spike_room_info(room);
end;$$;
create or replace function public.create_survival_room() returns jsonb language plpgsql security definer set search_path='' as $$declare room uuid; code text;
begin
 if auth.uid() is null then raise exception 'Inicia sesión para jugar con un amigo';end if;
 delete from public.spike_rooms where expires_at<now();
 if (select count(*) from public.spike_rooms where host_id=auth.uid())>=2 then raise exception 'Ya tienes dos salas abiertas';end if;
 code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
 insert into public.spike_rooms(join_code,host_id,capacity,mode) values(code,auth.uid(),4,12) returning id into room;
 insert into public.spike_room_members(room_id,user_id) values(room,auth.uid());
 return public.spike_room_info(room);
end;$$;
create or replace function public.join_spike_room(code text) returns jsonb language plpgsql security definer set search_path='' as $$declare room public.spike_rooms;
begin
 if auth.uid() is null then raise exception 'Inicia sesión para jugar con un amigo';end if;
 if code !~ '^[A-Za-z0-9]{10}$' then raise exception 'Código no válido';end if;
 select * into room from public.spike_rooms where join_code=upper(code) and expires_at>now() for update;
 if room.id is null then raise exception 'Sala no disponible';end if;
 if not exists(select 1 from public.spike_room_members where room_id=room.id and user_id=auth.uid()) then
  if (select count(*) from public.spike_room_members where room_id=room.id)>=room.capacity then raise exception 'La sala ya está completa';end if;
  insert into public.spike_room_members(room_id,user_id) values(room.id,auth.uid());
 end if;
 return public.spike_room_info(room.id);
end;$$;
create or replace function public.leave_spike_room(room uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.spike_rooms where id=room and host_id=auth.uid()) then delete from public.spike_rooms where id=room and host_id=auth.uid();
 else delete from public.spike_room_members where room_id=room and user_id=auth.uid();end if;
end;$$;
create or replace function public.can_use_spike_topic(topic text,publish boolean default false) returns boolean language plpgsql stable security definer set search_path='' as $$declare room uuid;sender text;
begin
 if auth.uid() is null or split_part(topic,':',1)<>'spike' then return false;end if;
 begin room:=split_part(topic,':',2)::uuid;exception when invalid_text_representation then return false;end;
 sender:=split_part(topic,':',3);
 return public.is_spike_member(room) and (not publish or sender=auth.uid()::text) and exists(select 1 from public.spike_room_members where room_id=room and user_id::text=sender);
end;$$;
revoke all on function public.spike_room_info(uuid),public.create_spike_room(),public.create_survival_room(),public.join_spike_room(text),public.leave_spike_room(uuid),public.can_use_spike_topic(text,boolean) from public;
grant execute on function public.spike_room_info(uuid),public.create_spike_room(),public.create_survival_room(),public.join_spike_room(text),public.leave_spike_room(uuid),public.can_use_spike_topic(text,boolean) to authenticated;
drop policy if exists wadriaim_spike_receive on realtime.messages;
create policy wadriaim_spike_receive on realtime.messages for select to authenticated using (extension='broadcast' and public.can_use_spike_topic((select realtime.topic()),false));
drop policy if exists wadriaim_spike_publish on realtime.messages;
create policy wadriaim_spike_publish on realtime.messages for insert to authenticated with check (extension='broadcast' and public.can_use_spike_topic((select realtime.topic()),true));
commit;
