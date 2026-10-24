begin;
alter table public.profiles add column if not exists favorite_team text not null default '' check(length(favorite_team)<=24);
alter table public.profiles add column if not exists country text not null default '' check(country='' or country ~ '^[A-Z]{2}$');
alter table public.profiles add column if not exists team_setup_complete boolean not null default false;
alter table public.profiles add column if not exists needs_username boolean not null default false;
grant update(favorite_team,country,team_setup_complete,needs_username) on public.profiles to authenticated;
create or replace function public.on_wadriaim_signup() returns trigger
language plpgsql security definer set search_path='' as $$
declare is_social boolean; candidate text;
begin
 is_social := coalesce(new.raw_app_meta_data->>'provider','email') <> 'email';
 if not is_social then
   candidate := lower(trim(new.raw_user_meta_data->>'username'));
   insert into public.profiles(id,username,needs_username) values(new.id,candidate,false);
 else
   loop
     candidate := 'p_'||substr(replace(gen_random_uuid()::text,'-',''),1,18);
     begin
       insert into public.profiles(id,username,needs_username) values(new.id,candidate,true);
       exit;
     exception when unique_violation then null;
     end;
   end loop;
 end if;
 return new;
end;
$$;
revoke all on function public.on_wadriaim_signup() from public,anon,authenticated;
commit;
