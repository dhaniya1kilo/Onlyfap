-- =====================================================================
-- OnlyFap — initial schema (001). Apply first, then 002_onlyfap_engagement_moderation.sql.
-- Run once in Supabase Dashboard → SQL Editor (or `supabase db push`).
-- Idempotent where practical.
-- =====================================================================

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'user' check (role in ('user', 'admin')),
  display_name text check (display_name is null or char_length(display_name) between 1 and 60),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically for every new auth user (always role 'user').
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, display_name)
  values (new.id, 'user', nullif(split_part(coalesce(new.email, ''), '@', 1), ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Block role changes from API clients. Only the SQL editor / service role
-- (where auth.role() is not 'authenticated' / 'anon') can change roles.
create or replace function public.protect_profile_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role
     and coalesce(auth.role(), '') in ('authenticated', 'anon') then
    raise exception 'Changing role is not allowed';
  end if;
  if new.id is distinct from old.id then
    raise exception 'Changing profile id is not allowed';
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Admin check. SECURITY DEFINER so it reads profiles without triggering
-- profiles RLS (prevents circular policies).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- CONTENT
-- ---------------------------------------------------------------------
create table if not exists public.content (
  id            uuid primary key default gen_random_uuid(),
  admin_id      uuid not null references public.profiles(id) on delete restrict,
  media_path    text not null,
  media_url     text not null,
  media_type    text not null check (media_type in ('image', 'video')),
  mime_type     text,
  title         text not null check (char_length(title) between 1 and 200),
  description   text not null check (char_length(description) between 1 and 5000),
  is_published  boolean not null default true,
  view_count    bigint not null default 0 check (view_count >= 0),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists content_created_at_idx on public.content (created_at desc, id desc);
create index if not exists content_admin_id_idx   on public.content (admin_id);
create index if not exists content_search_idx     on public.content using gin (search_vector);
create index if not exists content_title_trgm_idx on public.content using gin (title gin_trgm_ops);
create index if not exists content_desc_trgm_idx  on public.content using gin (description gin_trgm_ops);

drop trigger if exists content_updated_at on public.content;
create trigger content_updated_at before update on public.content
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- TAGS
-- ---------------------------------------------------------------------
create table if not exists public.tags (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  is_category boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists tags_name_lower_uidx on public.tags (lower(name));
create index if not exists tags_name_trgm_idx on public.tags using gin (name gin_trgm_ops);
create index if not exists tags_category_idx on public.tags (is_category, sort_order) where is_category;

drop trigger if exists tags_updated_at on public.tags;
create trigger tags_updated_at before update on public.tags
  for each row execute function public.set_updated_at();

create table if not exists public.content_tags (
  content_id uuid not null references public.content(id) on delete cascade,
  -- RESTRICT: a tag that is still in use cannot be deleted.
  tag_id     uuid not null references public.tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (content_id, tag_id)
);

create index if not exists content_tags_tag_idx on public.content_tags (tag_id, content_id);

-- ---------------------------------------------------------------------
-- ADS (never stored in content)
-- ---------------------------------------------------------------------
create table if not exists public.ads (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid not null references public.profiles(id) on delete restrict,
  ad_type    text not null check (ad_type in ('link', 'html', 'embed')),
  label      text check (label is null or char_length(label) <= 120),
  ad_content text not null check (char_length(ad_content) between 1 and 20000),
  is_active  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ads_link_is_url check (ad_type <> 'link' or ad_content ~* '^https?://')
);

create index if not exists ads_active_idx on public.ads (is_active, created_at);
create index if not exists ads_admin_id_idx on public.ads (admin_id);

drop trigger if exists ads_updated_at on public.ads;
create trigger ads_updated_at before update on public.ads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.content      enable row level security;
alter table public.tags         enable row level security;
alter table public.content_tags enable row level security;
alter table public.ads          enable row level security;

-- profiles: you can read yourself; anyone can read admin profiles (they are
-- the public uploaders); admins can read everyone.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or role = 'admin' or public.is_admin());

-- users may edit their own display_name (role change blocked by trigger)
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
-- no insert/delete policies: rows are created by the auth trigger only.

-- content
drop policy if exists content_select on public.content;
create policy content_select on public.content for select
  using (is_published or public.is_admin());

drop policy if exists content_insert on public.content;
create policy content_insert on public.content for insert
  with check (public.is_admin() and admin_id = auth.uid());

drop policy if exists content_update on public.content;
create policy content_update on public.content for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists content_delete on public.content;
create policy content_delete on public.content for delete
  using (public.is_admin());

-- tags
drop policy if exists tags_select on public.tags;
create policy tags_select on public.tags for select using (true);

drop policy if exists tags_write on public.tags;
create policy tags_write on public.tags for all
  using (public.is_admin()) with check (public.is_admin());

-- content_tags
drop policy if exists content_tags_select on public.content_tags;
create policy content_tags_select on public.content_tags for select using (true);

drop policy if exists content_tags_write on public.content_tags;
create policy content_tags_write on public.content_tags for all
  using (public.is_admin()) with check (public.is_admin());

-- ads: public sees active only; admins see and manage all
drop policy if exists ads_select on public.ads;
create policy ads_select on public.ads for select
  using (is_active or public.is_admin());

drop policy if exists ads_insert on public.ads;
create policy ads_insert on public.ads for insert
  with check (public.is_admin() and admin_id = auth.uid());

drop policy if exists ads_update on public.ads;
create policy ads_update on public.ads for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists ads_delete on public.ads;
create policy ads_delete on public.ads for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- READ MODEL: content_feed view (respects caller's RLS)
-- ---------------------------------------------------------------------
create or replace view public.content_feed
with (security_invoker = true) as
select
  c.id, c.admin_id, c.media_path, c.media_url, c.media_type, c.mime_type,
  c.title, c.description, c.is_published, c.view_count, c.created_at, c.updated_at,
  p.display_name as uploader_name,
  coalesce(
    (select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug) order by t.name)
       from public.content_tags ct join public.tags t on t.id = ct.tag_id
      where ct.content_id = c.id),
    '[]'::jsonb
  ) as tags
from public.content c
left join public.profiles p on p.id = c.admin_id;

grant select on public.content_feed to anon, authenticated;

-- tag usage (admin tag manager)
create or replace view public.tag_usage
with (security_invoker = true) as
select t.id, t.name, t.slug, t.is_category, t.sort_order, t.created_at, t.updated_at,
       (select count(*) from public.content_tags ct where ct.tag_id = t.id) as usage_count
from public.tags t;

grant select on public.tag_usage to anon, authenticated;

-- ---------------------------------------------------------------------
-- SEARCH (database-side; title, description, tags)
-- ---------------------------------------------------------------------
create or replace function public._search_content_ids(p_query text, p_tag text)
returns table (id uuid, rank real, created_at timestamptz)
language sql stable security invoker set search_path = public as $$
  with params as (
    select
      nullif(trim(coalesce(p_query, '')), '') as q,
      nullif(trim(coalesce(p_tag, '')), '')   as tag
  ), prepared as (
    select q, tag,
      case when q is null then null else websearch_to_tsquery('simple', q) end as tsq,
      case when q is null then null
           else '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%' end as pat
    from params
  )
  select c.id,
         coalesce(ts_rank(c.search_vector, pr.tsq), 0)::real as rank,
         c.created_at
  from public.content c, prepared pr
  where (pr.tag is null or exists (
          select 1 from public.content_tags ct join public.tags t on t.id = ct.tag_id
          where ct.content_id = c.id and t.slug = pr.tag))
    and (pr.q is null
         or c.search_vector @@ pr.tsq
         or c.title ilike pr.pat
         or c.description ilike pr.pat
         or exists (
              select 1 from public.content_tags ct join public.tags t on t.id = ct.tag_id
              where ct.content_id = c.id and t.name ilike pr.pat));
$$;

create or replace function public.search_content(
  p_query text default null, p_tag text default null,
  p_limit int default 24, p_offset int default 0)
returns setof public.content_feed
language sql stable security invoker set search_path = public as $$
  select f.*
  from public._search_content_ids(p_query, p_tag) s
  join public.content_feed f on f.id = s.id
  order by s.rank desc, s.created_at desc, s.id desc
  limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0);
$$;

create or replace function public.search_content_count(p_query text default null, p_tag text default null)
returns bigint language sql stable security invoker set search_path = public as $$
  select count(*) from public._search_content_ids(p_query, p_tag);
$$;

-- ---------------------------------------------------------------------
-- RELATED CONTENT (shared tags)
-- ---------------------------------------------------------------------
create or replace function public.related_content(p_content_id uuid, p_limit int default 8)
returns setof public.content_feed
language sql stable security invoker set search_path = public as $$
  with shared as (
    select other.content_id, count(*) as shared_tags
    from public.content_tags mine
    join public.content_tags other on other.tag_id = mine.tag_id and other.content_id <> mine.content_id
    where mine.content_id = p_content_id
    group by other.content_id
  )
  select f.* from shared s
  join public.content_feed f on f.id = s.content_id
  order by s.shared_tags desc, f.created_at desc
  limit least(greatest(p_limit, 1), 24);
$$;

-- ---------------------------------------------------------------------
-- TAG ASSIGNMENT (atomic replace)
-- ---------------------------------------------------------------------
create or replace function public.set_content_tags(p_content_id uuid, p_tag_ids uuid[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  delete from public.content_tags
   where content_id = p_content_id and not (tag_id = any(coalesce(p_tag_ids, '{}')));
  insert into public.content_tags (content_id, tag_id)
  select p_content_id, t from unnest(coalesce(p_tag_ids, '{}')) as t
  on conflict do nothing;
end $$;

-- ---------------------------------------------------------------------
-- VIEW COUNT (only increments, only published content)
-- ---------------------------------------------------------------------
create or replace function public.increment_view(p_content_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.content set view_count = view_count + 1
  where id = p_content_id and is_published;
$$;

revoke all on function public.increment_view(uuid) from public;
grant execute on function public.increment_view(uuid) to anon, authenticated;
grant execute on function public.search_content(text, text, int, int) to anon, authenticated;
grant execute on function public.search_content_count(text, text) to anon, authenticated;
grant execute on function public.related_content(uuid, int) to anon, authenticated;
grant execute on function public.set_content_tags(uuid, uuid[]) to authenticated;

-- updated_at trigger must not bump on view counts? Acceptable for MVP:
-- view increments update updated_at. Kept simple deliberately.

-- ---------------------------------------------------------------------
-- STORAGE: content-media bucket (public read, admin write)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-media', 'content-media', true, 52428800,  -- 50 MB (Supabase free-tier max)
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "content-media public read" on storage.objects;
create policy "content-media public read" on storage.objects for select
  using (bucket_id = 'content-media');

drop policy if exists "content-media admin insert" on storage.objects;
create policy "content-media admin insert" on storage.objects for insert
  with check (bucket_id = 'content-media' and public.is_admin());

drop policy if exists "content-media admin update" on storage.objects;
create policy "content-media admin update" on storage.objects for update
  using (bucket_id = 'content-media' and public.is_admin());

drop policy if exists "content-media admin delete" on storage.objects;
create policy "content-media admin delete" on storage.objects for delete
  using (bucket_id = 'content-media' and public.is_admin());

-- ---------------------------------------------------------------------
-- STARTER CATEGORIES (editable in /admin/tags; not hardcoded in the app)
-- ---------------------------------------------------------------------
insert into public.tags (name, slug, is_category, sort_order) values
  ('Technology', 'technology', true, 10),
  ('Gaming', 'gaming', true, 20),
  ('Travel', 'travel', true, 30),
  ('Sports', 'sports', true, 40),
  ('Entertainment', 'entertainment', true, 50),
  ('Education', 'education', true, 60),
  ('News', 'news', true, 70)
on conflict (slug) do nothing;

-- =====================================================================
-- MAKE YOURSELF ADMIN (run separately, after signing up in the app):
--
--   update public.profiles set role = 'admin'
--   where id = '<your-auth-user-uuid>';
--
-- Find the UUID under Authentication → Users. The SQL editor runs as the
-- postgres role, so the role-protection trigger allows this change.
-- =====================================================================
