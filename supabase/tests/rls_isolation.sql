-- RLS isolation test: family A must never see or change family B's rows.
-- Runs inside a transaction and rolls back, so it leaves no data behind.
-- Run with: Supabase SQL editor, psql, or MCP execute_sql. Any failure raises an error.
begin;

-- Two throwaway users; the signup trigger gives each its own family.
insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-4000-a000-00000000000a', 'rls-a@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-00000000000b', 'rls-b@example.test', 'authenticated', 'authenticated');

-- Seed one row per table for family B (as the table owner, bypassing RLS).
do $$
declare
  fam_b uuid := (select family_id from public.family_users where user_id = '00000000-0000-4000-a000-00000000000b');
begin
  insert into public.members (id, family_id, name) values ('10000000-0000-4000-a000-00000000000b', fam_b, 'B kid');
  insert into public.restaurants (id, family_id, name) values ('20000000-0000-4000-a000-00000000000b', fam_b, 'B diner');
  insert into public.visits (id, family_id, restaurant_id) values ('30000000-0000-4000-a000-00000000000b', fam_b, '20000000-0000-4000-a000-00000000000b');
  insert into public.dish_logs (family_id, visit_id, member_id, dish_name, rating)
    values (fam_b, '30000000-0000-4000-a000-00000000000b', '10000000-0000-4000-a000-00000000000b', 'Fries', 1);
  perform set_config('test.fam_b', fam_b::text, true);
end $$;

-- ── Act as user A ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);

do $$
declare
  fam_a uuid;
  fam_b uuid;
  n int;
begin
  select family_id into fam_a from public.family_users;
  assert fam_a is not null, 'A should see its own family membership';

  -- Reads: A sees nothing of B
  select count(*) into n from public.families;      assert n = 1, 'A should see exactly 1 family, saw ' || n;
  select count(*) into n from public.family_users;  assert n = 1, 'A should see only its own membership';
  select count(*) into n from public.members;       assert n = 0, 'A saw B''s members';
  select count(*) into n from public.restaurants;   assert n = 0, 'A saw B''s restaurants';
  select count(*) into n from public.visits;        assert n = 0, 'A saw B''s visits';
  select count(*) into n from public.dish_logs;     assert n = 0, 'A saw B''s dish logs';

  -- Writes into B's family are rejected
  fam_b := current_setting('test.fam_b')::uuid;
  begin
    insert into public.restaurants (family_id, name) values (fam_b, 'Sneaky');
    raise exception 'FAIL: A inserted into B''s family';
  exception when insufficient_privilege then null;  -- expected: RLS violation
  end;

  -- Updates and deletes of B's rows silently affect 0 rows
  update public.restaurants set name = 'Hacked' where id = '20000000-0000-4000-a000-00000000000b';
  get diagnostics n = row_count; assert n = 0, 'A updated B''s restaurant';
  delete from public.dish_logs where family_id = fam_b;
  get diagnostics n = row_count; assert n = 0, 'A deleted B''s dish logs';

  -- Moving A's own row into B's family is rejected (WITH CHECK)
  insert into public.restaurants (family_id, name) values (fam_a, 'A place');
  begin
    update public.restaurants set family_id = fam_b where family_id = fam_a;
    raise exception 'FAIL: A moved a row into B''s family';
  exception when insufficient_privilege then null;
  end;

  -- A can use its own family normally
  select count(*) into n from public.restaurants; assert n = 1, 'A should see its own restaurant';

  -- Photos: A cannot upload into B's folder
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('visit-photos', fam_b::text || '/x.jpg', '00000000-0000-4000-a000-00000000000a');
    raise exception 'FAIL: A uploaded into B''s photo folder';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ── Signed-out (anon) sees nothing ──
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform 1 from public.members;
    raise exception 'FAIL: anon can read members';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'RLS isolation: all checks passed' as result;
rollback;
