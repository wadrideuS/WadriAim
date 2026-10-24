begin;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from private.app_admins limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare snapshot jsonb;
begin
 if not public.is_app_admin() then raise exception 'Admin role check failed'; end if;
 begin perform 1 from private.live_activity limit 1;raise exception 'Activity table exposed';exception when insufficient_privilege then null;end;
 perform public.activity_ping('10000000-0000-4000-8000-000000000001','playing',6,false);
 perform public.activity_ping('10000000-0000-4000-8000-000000000002','browsing',null,false);
 snapshot:=public.admin_activity_snapshot();
 if (select count(*) from jsonb_array_elements(snapshot->'people') p where p->>'username'='wadrid') <>1 then raise exception 'Account not deduplicated';end if;
 if not exists(select 1 from jsonb_array_elements(snapshot->'people') p where p->>'username'='wadrid' and p->>'activity'='playing') then raise exception 'Playing activity missing';end if;
 perform public.friend_training_history(auth.uid());
end;
$$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000099","role":"authenticated"}',true);
do $$ begin
 if public.is_app_admin() then raise exception 'Non-admin elevated';end if;
 begin perform public.admin_activity_snapshot();raise exception 'Private dashboard exposed';exception when insufficient_privilege then null;end;
 begin perform public.friend_training_history('4c17f5eb-0f35-4c5f-a98d-05669eedc4c8');raise exception 'Unaccepted friend exposed';exception when insufficient_privilege then null;end;
end;$$;
reset role;
rollback;
select 'Admin permissions, visitor privacy, deduplication and friend stats checks passed' as result;
