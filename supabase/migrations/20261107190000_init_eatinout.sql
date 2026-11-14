-- EatinOut initial schema
-- Every row belongs to one family. Users only ever see their own family's rows.

create schema if not exists private;

-- ── Families and who belongs to them ───────────────────────────────────────
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My family' check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.family_users (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);
create index family_users_user_id_idx on public.family_users (user_id);

-- Families the signed-in user belongs to. SECURITY DEFINER so policies can read
-- family_users without recursion; lives in the unexposed `private` schema and
-- only ever returns rows for auth.uid().
create function private.my_family_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select family_id from public.family_users where user_id = (select auth.uid());
$$;
revoke execute on function private.my_family_ids() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.my_family_ids() to authenticated;

-- Every new account gets its own family.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_family_id uuid;
begin
  insert into public.families default values returning id into new_family_id;
  insert into public.family_users (family_id, user_id) values (new_family_id, new.id);
  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ── Family data ────────────────────────────────────────────────────────────
create table public.members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  age smallint check (age between 0 and 120),
  emoji text not null default '🧑' check (char_length(emoji) <= 16),
  allergies text[] not null default '{}'
    check (allergies <@ array['peanut', 'dairy', 'gluten', 'other']::text[]),
  allergy_other text not null default '' check (char_length(allergy_other) <= 120),
  wont_eat text not null default '' check (char_length(wont_eat) <= 500),
  created_at timestamptz not null default now(),
  unique (id, family_id)
);
create index members_family_id_idx on public.members (family_id);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  city text not null default '' check (char_length(city) <= 120),
  created_at timestamptz not null default now(),
  unique (id, family_id)
);
create index restaurants_family_id_idx on public.restaurants (family_id);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  restaurant_id uuid not null,
  visited_on date not null default current_date,
  tags text[] not null default '{}'
    check (tags <@ array['high_chairs', 'kids_menu', 'patio', 'bike_rack', 'quiet', 'fast_service']::text[]),
  photo_path text,
  created_at timestamptz not null default now(),
  unique (id, family_id),
  -- composite FK: a visit can only point at a restaurant in the same family
  foreign key (restaurant_id, family_id) references public.restaurants (id, family_id) on delete cascade
);
create index visits_family_id_idx on public.visits (family_id);
create index visits_restaurant_id_idx on public.visits (restaurant_id, family_id);

create table public.dish_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  visit_id uuid not null,
  member_id uuid not null,
  dish_name text not null check (char_length(dish_name) between 1 and 120),
  rating smallint not null check (rating in (-1, 0, 1)),
  safe boolean,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  foreign key (visit_id, family_id) references public.visits (id, family_id) on delete cascade,
  foreign key (member_id, family_id) references public.members (id, family_id) on delete cascade
);
create index dish_logs_family_id_idx on public.dish_logs (family_id);
create index dish_logs_visit_id_idx on public.dish_logs (visit_id, family_id);
create index dish_logs_member_id_idx on public.dish_logs (member_id, family_id);

-- ── Access: signed-in users only, and only their own family ────────────────
revoke all on public.families, public.family_users, public.members,
  public.restaurants, public.visits, public.dish_logs from anon;

grant select, update on public.families to authenticated;
grant select on public.family_users to authenticated;
grant select, insert, update, delete on public.members, public.restaurants,
  public.visits, public.dish_logs to authenticated;

alter table public.families enable row level security;
alter table public.family_users enable row level security;
alter table public.members enable row level security;
alter table public.restaurants enable row level security;
alter table public.visits enable row level security;
alter table public.dish_logs enable row level security;

create policy "Read own families" on public.families
  for select to authenticated
  using (id in (select private.my_family_ids()));
create policy "Rename own families" on public.families
  for update to authenticated
  using (id in (select private.my_family_ids()))
  with check (id in (select private.my_family_ids()));

create policy "Read own memberships" on public.family_users
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Family members: own family only" on public.members
  for all to authenticated
  using (family_id in (select private.my_family_ids()))
  with check (family_id in (select private.my_family_ids()));

create policy "Restaurants: own family only" on public.restaurants
  for all to authenticated
  using (family_id in (select private.my_family_ids()))
  with check (family_id in (select private.my_family_ids()));

create policy "Visits: own family only" on public.visits
  for all to authenticated
  using (family_id in (select private.my_family_ids()))
  with check (family_id in (select private.my_family_ids()));

create policy "Dish logs: own family only" on public.dish_logs
  for all to authenticated
  using (family_id in (select private.my_family_ids()))
  with check (family_id in (select private.my_family_ids()));

-- ── Receipt and menu photos: private bucket, one folder per family ─────────
-- Path: {family_id}/{visit_id}.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('visit-photos', 'visit-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Photos: read own family" on storage.objects
  for select to authenticated
  using (bucket_id = 'visit-photos'
    and (storage.foldername(name))[1] in (select f::text from private.my_family_ids() f));
create policy "Photos: upload to own family" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'visit-photos'
    and (storage.foldername(name))[1] in (select f::text from private.my_family_ids() f));
create policy "Photos: replace own family" on storage.objects
  for update to authenticated
  using (bucket_id = 'visit-photos'
    and (storage.foldername(name))[1] in (select f::text from private.my_family_ids() f))
  with check (bucket_id = 'visit-photos'
    and (storage.foldername(name))[1] in (select f::text from private.my_family_ids() f));
create policy "Photos: delete own family" on storage.objects
  for delete to authenticated
  using (bucket_id = 'visit-photos'
    and (storage.foldername(name))[1] in (select f::text from private.my_family_ids() f));
