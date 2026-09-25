-- =====================================================================
-- OnlyFap — migration 002: engagement, discovery, moderation, compliance
--
-- Apply AFTER 001_initial_schema.sql (the previous build's schema, renamed;
-- the SQL is unchanged, so a database that already ran it needs only 002).
-- Run once in Supabase Dashboard → SQL Editor, or `supabase db push`.
-- Idempotent where practical.
--
-- Adds:
--   content.like_count / content.moderation_state
--   content_views          de-duplicated view events (hashed anonymous key)
--   content_daily_stats    per-day view/like aggregates (powers Trending)
--   content_likes          one like per user per item
--   search_queries         privacy-conscious search analytics
--   removal_requests       takedown / removal requests (admin-only)
--   content_reports        quick reports (admin-only)
--   moderation_actions     audit log of moderation decisions (admin-only)
--   content_compliance     consent / age-verification record pointers (admin-only)
--   site_settings          admin-managed switches (admin-only)
--   RPCs: record_view, toggle_like, browse_content, search_content (sort),
--         search_suggestions, log_search, related_content, liked_content,
--         submit_removal_request, submit_content_report,
--         admin_set_content_state, admin_dashboard_stats, admin_list_users
-- =====================================================================

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

-- Escape a user string for use inside LIKE/ILIKE patterns.
create or replace function public._like_escape(p text)
returns text language sql immutable as $$
  select replace(replace(replace(coalesce(p, ''), '\', '\\'), '%', '\%'), '_', '\_');
$$;

-- Hash an identifier so raw anonymous ids / user ids are never stored in
-- analytics tables.
create or replace function public._hash_key(p text)
returns text language sql immutable as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex');
$$;

-- Resolve the "who is acting" key for anti-abuse: the signed-in user if any,
-- otherwise the browser's random anonymous token (never an IP address).
create or replace function public._actor_key(p_anon text)
returns text language plpgsql stable set search_path = public as $$
begin
  if auth.uid() is not null then
    return public._hash_key('u:' || auth.uid()::text);
  end if;
  if p_anon is not null and p_anon ~ '^[A-Za-z0-9_-]{16,64}$' then
    return public._hash_key('a:' || p_anon);
  end if;
  return null;
end $$;

create or replace function public._utc_today()
returns date language sql stable as $$ select (now() at time zone 'utc')::date $$;

-- ---------------------------------------------------------------------
-- CONTENT: new columns
-- ---------------------------------------------------------------------
alter table public.content
  add column if not exists like_count bigint not null default 0,
  add column if not exists moderation_state text not null default 'active',
  add column if not exists moderated_at timestamptz,
  -- poster frame captured in the browser at upload (videos), stored in the same bucket
  add column if not exists thumbnail_url text,
  add column if not exists thumbnail_path text;

do $$ begin
  alter table public.content add constraint content_thumbnail_url_chk
    check (thumbnail_url is null or (char_length(thumbnail_url) <= 2000 and thumbnail_url ~* '^https?://'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.content add constraint content_like_count_nonneg check (like_count >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.content add constraint content_moderation_state_chk
    check (moderation_state in ('active', 'under_review', 'hidden', 'removed'));
exception when duplicate_object then null; end $$;

-- A post is public when it is published AND not hidden/removed by moderation.
-- 'under_review' stays visible: a request alone never takes content down.
create or replace function public.content_is_public(p_published boolean, p_state text)
returns boolean language sql immutable as $$
  select coalesce(p_published, false) and coalesce(p_state, 'active') in ('active', 'under_review');
$$;

-- Counter updates (views/likes) must not bump updated_at (used for sitemap
-- lastmod and cache keys). Only real edits do.
create or replace function public.content_set_updated_at()
returns trigger language plpgsql as $$
begin
  if (new.title, new.description, new.media_url, new.media_path, new.media_type,
      new.mime_type, new.is_published, new.moderation_state, new.thumbnail_url)
     is not distinct from
     (old.title, old.description, old.media_url, old.media_path, old.media_type,
      old.mime_type, old.is_published, old.moderation_state, old.thumbnail_url) then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists content_updated_at on public.content;
create trigger content_updated_at before update on public.content
  for each row execute function public.content_set_updated_at();

create index if not exists content_views_rank_idx on public.content (view_count desc, id desc);
create index if not exists content_likes_rank_idx on public.content (like_count desc, id desc);
create index if not exists content_created_asc_idx on public.content (created_at asc, id asc);
create index if not exists content_public_idx on public.content (created_at desc)
  where is_published and moderation_state in ('active', 'under_review');
create index if not exists content_moderation_idx on public.content (moderation_state)
  where moderation_state <> 'active';

-- Public visibility now also respects moderation.
drop policy if exists content_select on public.content;
create policy content_select on public.content for select
  using (public.content_is_public(is_published, moderation_state) or public.is_admin());

-- ---------------------------------------------------------------------
-- READ MODEL: content_feed gains like_count + moderation_state (appended,
-- so existing column order is unchanged).
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
  ) as tags,
  c.like_count,
  c.moderation_state,
  c.thumbnail_url
from public.content c
left join public.profiles p on p.id = c.admin_id;

grant select on public.content_feed to anon, authenticated;

-- ---------------------------------------------------------------------
-- VIEWS: de-duplicated events + daily aggregates
-- ---------------------------------------------------------------------
create table if not exists public.content_views (
  id          bigint generated always as identity primary key,
  content_id  uuid not null references public.content(id) on delete cascade,
  viewer_key  text not null check (char_length(viewer_key) = 64),  -- sha256 hex, never raw ids
  view_date   date not null default public._utc_today(),
  viewed_at   timestamptz not null default now(),
  unique (content_id, viewer_key, view_date)
);
create index if not exists content_views_viewer_idx on public.content_views (viewer_key, viewed_at desc);
create index if not exists content_views_time_idx on public.content_views (viewed_at);

create table if not exists public.content_daily_stats (
  content_id uuid not null references public.content(id) on delete cascade,
  day        date not null,
  views      integer not null default 0 check (views >= 0),
  likes      integer not null default 0,
  primary key (content_id, day)
);
create index if not exists content_daily_stats_day_idx on public.content_daily_stats (day, content_id);

alter table public.content_views       enable row level security;
alter table public.content_daily_stats enable row level security;

-- Only admins may read raw events/aggregates. Nobody writes directly:
-- all writes go through SECURITY DEFINER functions below.
drop policy if exists content_views_admin_read on public.content_views;
create policy content_views_admin_read on public.content_views for select using (public.is_admin());
drop policy if exists content_daily_stats_admin_read on public.content_daily_stats;
create policy content_daily_stats_admin_read on public.content_daily_stats for select using (public.is_admin());

revoke insert, update, delete on public.content_views, public.content_daily_stats from anon, authenticated;

-- The old unlimited increment RPC is replaced by record_view().
drop function if exists public.increment_view(uuid);

/**
 * record_view — counts at most ONE view per viewer per item per UTC day.
 * The browser calls it only after the media has actually been on screen for
 * a couple of seconds (see src/hooks/useViewTracker.ts).
 * Anti-abuse: a single viewer key registering more than 120 views in 10
 * minutes is ignored. Returns true when a new view was counted.
 */
create or replace function public.record_view(p_content_id uuid, p_viewer text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_key text := public._actor_key(p_viewer);
  v_recent int;
  v_rows int;
begin
  if p_content_id is null or v_key is null then return false; end if;
  if not exists (select 1 from public.content c
                 where c.id = p_content_id and public.content_is_public(c.is_published, c.moderation_state)) then
    return false;
  end if;

  select count(*) into v_recent from public.content_views
   where viewer_key = v_key and viewed_at > now() - interval '10 minutes';
  if v_recent >= 120 then return false; end if;

  insert into public.content_views (content_id, viewer_key)
  values (p_content_id, v_key)
  on conflict (content_id, viewer_key, view_date) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return false; end if;

  update public.content set view_count = view_count + 1 where id = p_content_id;
  insert into public.content_daily_stats (content_id, day, views)
  values (p_content_id, public._utc_today(), 1)
  on conflict (content_id, day) do update set views = public.content_daily_stats.views + 1;
  return true;
end $$;

-- Keep raw events small. Aggregates in content_daily_stats are kept.
-- Schedule with pg_cron if desired: select cron.schedule('prune-views','15 3 * * *',$$select public.prune_view_events(90)$$);
create or replace function public.prune_view_events(p_keep_days int default 90)
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  delete from public.content_views where viewed_at < now() - make_interval(days => greatest(p_keep_days, 7));
  get diagnostics v = row_count;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- LIKES
-- ---------------------------------------------------------------------
create table if not exists public.content_likes (
  content_id uuid not null references public.content(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (content_id, user_id)   -- prevents duplicate likes
);
create index if not exists content_likes_user_idx on public.content_likes (user_id, created_at desc);

alter table public.content_likes enable row level security;

drop policy if exists content_likes_select on public.content_likes;
create policy content_likes_select on public.content_likes for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists content_likes_insert on public.content_likes;
create policy content_likes_insert on public.content_likes for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.content c
                where c.id = content_id and public.content_is_public(c.is_published, c.moderation_state))
  );

drop policy if exists content_likes_delete on public.content_likes;
create policy content_likes_delete on public.content_likes for delete
  using (user_id = auth.uid());
-- no update policy: likes are immutable

grant select, insert, delete on public.content_likes to authenticated;
revoke all on public.content_likes from anon;

-- Rate limit: at most 60 new likes per user per 5 minutes.
create or replace function public.content_likes_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.content_likes
       where user_id = new.user_id and created_at > now() - interval '5 minutes') >= 60 then
    raise exception 'You are liking too fast. Try again in a few minutes.' using errcode = 'OF429';
  end if;
  return new;
end $$;

drop trigger if exists content_likes_rate on public.content_likes;
create trigger content_likes_rate before insert on public.content_likes
  for each row execute function public.content_likes_rate_limit();

-- Keep content.like_count and daily stats in sync (definer: users cannot
-- update content rows themselves).
create or replace function public.content_likes_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.content set like_count = like_count + 1 where id = new.content_id;
    insert into public.content_daily_stats (content_id, day, likes)
    values (new.content_id, public._utc_today(), 1)
    on conflict (content_id, day) do update set likes = public.content_daily_stats.likes + 1;
  elsif tg_op = 'DELETE' then
    update public.content set like_count = greatest(like_count - 1, 0) where id = old.content_id;
    update public.content_daily_stats set likes = likes - 1
     where content_id = old.content_id and day = public._utc_today();
  end if;
  return null;
end $$;

drop trigger if exists content_likes_counter on public.content_likes;
create trigger content_likes_counter after insert or delete on public.content_likes
  for each row execute function public.content_likes_count();

/** toggle_like — like if not liked, unlike if liked. Requires a session
 *  (a real account or a Supabase anonymous sign-in). */
create or replace function public.toggle_like(p_content_id uuid)
returns table (liked boolean, like_count bigint)
language plpgsql security invoker set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Log in to like posts.' using errcode = '28000';
  end if;
  delete from public.content_likes l where l.content_id = p_content_id and l.user_id = v_uid;
  if found then
    liked := false;
  else
    insert into public.content_likes (content_id, user_id) values (p_content_id, v_uid);
    liked := true;
  end if;
  select c.like_count into like_count from public.content c where c.id = p_content_id;
  return next;
end $$;

-- ---------------------------------------------------------------------
-- DISCOVERY: browse (Trending / Most viewed / New / Old)
-- ---------------------------------------------------------------------

/**
 * Trending score (kept deliberately simple, all in SQL):
 *
 *   recent = views in the last 2 days
 *          + 0.35 × views on days 3–7
 *          + 3    × likes in the last 7 days
 *   base   = recent + 1 + ln(1 + lifetime views)
 *   score  = base / (min(age_hours, 336) + 2) ^ 0.6
 *
 * - Recent activity (velocity) dominates, so a new video gaining views fast
 *   outranks an old video with a large lifetime total but few recent views.
 * - ln(lifetime) is a small tie-breaker for proven content.
 * - The age penalty stops growing after 14 days, so older content can still
 *   trend purely on renewed velocity.
 * Tune the constants here; the frontend never computes the ranking.
 */
create or replace function public.trending_score(
  p_views_2d bigint, p_views_3_7d bigint, p_likes_7d bigint,
  p_lifetime_views bigint, p_created_at timestamptz)
returns double precision language sql immutable as $$
  select (coalesce(p_views_2d, 0) + 0.35 * coalesce(p_views_3_7d, 0) + 3 * greatest(coalesce(p_likes_7d, 0), 0)
          + 1 + ln(1 + greatest(coalesce(p_lifetime_views, 0), 0)))
         / power(least(greatest(extract(epoch from (now() - p_created_at)) / 3600.0, 0), 336) + 2, 0.6);
$$;

-- Recent per-item activity for PUBLIC content only (aggregates, no viewer
-- data). SECURITY DEFINER because content_daily_stats itself is admin-only.
create or replace function public.content_recent_stats()
returns table (content_id uuid, v2 bigint, v37 bigint, l7 bigint)
language sql stable security definer set search_path = public as $$
  select s.content_id,
         coalesce(sum(s.views) filter (where s.day >= public._utc_today() - 1), 0)::bigint,
         coalesce(sum(s.views) filter (where s.day <  public._utc_today() - 1), 0)::bigint,
         coalesce(sum(s.likes), 0)::bigint
  from public.content_daily_stats s
  join public.content c on c.id = s.content_id and public.content_is_public(c.is_published, c.moderation_state)
  where s.day >= public._utc_today() - 6
  group by s.content_id;
$$;
grant execute on function public.content_recent_stats() to anon, authenticated;

create or replace function public.browse_content(
  p_sort text default 'trending',
  p_tag text default null,
  p_media_type text default null,
  p_limit int default 24,
  p_offset int default 0)
returns setof public.content_feed
language plpgsql stable security invoker set search_path = public as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 24), 1), 60);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_tag text := nullif(trim(coalesce(p_tag, '')), '');
  v_type text := case when p_media_type in ('image', 'video') then p_media_type else null end;
begin
  if p_sort = 'most_viewed' then
    return query
      select f.* from public.content_feed f
      where public.content_is_public(f.is_published, f.moderation_state)
        and (v_type is null or f.media_type = v_type)
        and (v_tag is null or exists (select 1 from public.content_tags ct join public.tags t on t.id = ct.tag_id
                                       where ct.content_id = f.id and t.slug = v_tag))
      order by f.view_count desc, f.id desc
      limit v_limit offset v_offset;
  elsif p_sort = 'new' then
    return query
      select f.* from public.content_feed f
      where public.content_is_public(f.is_published, f.moderation_state)
        and (v_type is null or f.media_type = v_type)
        and (v_tag is null or exists (select 1 from public.content_tags ct join public.tags t on t.id = ct.tag_id
                                       where ct.content_id = f.id and t.slug = v_tag))
      order by f.created_at desc, f.id desc
      limit v_limit offset v_offset;
  elsif p_sort = 'old' then
    return query
      select f.* from public.content_feed f
      where public.content_is_public(f.is_published, f.moderation_state)
        and (v_type is null or f.media_type = v_type)
        and (v_tag is null or exists (select 1 from public.content_tags ct join public.tags t on t.id = ct.tag_id
                                       where ct.content_id = f.id and t.slug = v_tag))
      order by f.created_at asc, f.id asc
      limit v_limit offset v_offset;
  else -- 'trending' (default)
    return query
      with stats as (select * from public.content_recent_stats())
      select f.* from public.content_feed f
      left join stats st on st.content_id = f.id
      where public.content_is_public(f.is_published, f.moderation_state)
        and (v_type is null or f.media_type = v_type)
        and (v_tag is null or exists (select 1 from public.content_tags ct join public.tags t on t.id = ct.tag_id
                                       where ct.content_id = f.id and t.slug = v_tag))
      order by public.trending_score(st.v2, st.v37, st.l7, f.view_count, f.created_at) desc,
               f.created_at desc, f.id desc
      limit v_limit offset v_offset;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- SEARCH: visibility-aware, media-type filter, sortable
-- ---------------------------------------------------------------------
drop function if exists public.search_content(text, text, int, int);
drop function if exists public.search_content_count(text, text);
drop function if exists public._search_content_ids(text, text);

create or replace function public._search_content_ids(p_query text, p_tag text, p_media_type text default null)
returns table (id uuid, rank real, created_at timestamptz, view_count bigint)
language sql stable security invoker set search_path = public as $$
  with params as (
    select
      nullif(trim(coalesce(p_query, '')), '') as q,
      nullif(trim(coalesce(p_tag, '')), '')   as tag,
      case when p_media_type in ('image', 'video') then p_media_type else null end as mt
  ), prepared as (
    select q, tag, mt,
      case when q is null then null else websearch_to_tsquery('simple', q) end as tsq,
      case when q is null then null else '%' || public._like_escape(q) || '%' end as pat
    from params
  )
  select c.id,
         coalesce(ts_rank(c.search_vector, pr.tsq), 0)::real as rank,
         c.created_at,
         c.view_count
  from public.content c, prepared pr
  where public.content_is_public(c.is_published, c.moderation_state)
    and (pr.mt is null or c.media_type = pr.mt)
    and (pr.tag is null or exists (
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

/** p_sort: 'relevance' (default) | 'most_viewed' | 'new' | 'old' */
create or replace function public.search_content(
  p_query text default null, p_tag text default null,
  p_limit int default 24, p_offset int default 0,
  p_sort text default 'relevance', p_media_type text default null)
returns setof public.content_feed
language sql stable security invoker set search_path = public as $$
  select f.*
  from public._search_content_ids(p_query, p_tag, p_media_type) s
  join public.content_feed f on f.id = s.id
  order by
    case when p_sort = 'most_viewed' then s.view_count end desc nulls last,
    case when p_sort = 'new' then s.created_at end desc nulls last,
    case when p_sort = 'old' then s.created_at end asc nulls last,
    s.rank desc, s.view_count desc, s.created_at desc, s.id desc
  limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0);
$$;

create or replace function public.search_content_count(
  p_query text default null, p_tag text default null, p_media_type text default null)
returns bigint language sql stable security invoker set search_path = public as $$
  select count(*) from public._search_content_ids(p_query, p_tag, p_media_type);
$$;

-- ---------------------------------------------------------------------
-- RELATED CONTENT: shared tags first, then popular items as a fallback
-- ---------------------------------------------------------------------
create or replace function public.related_content(p_content_id uuid, p_limit int default 8)
returns setof public.content_feed
language sql stable security invoker set search_path = public as $$
  with lim as (select least(greatest(coalesce(p_limit, 8), 1), 24) as n),
  shared as (
    select other.content_id as id, count(*)::float8 as shared_tags
    from public.content_tags mine
    join public.content_tags other on other.tag_id = mine.tag_id and other.content_id <> mine.content_id
    where mine.content_id = p_content_id
    group by other.content_id
  ),
  popular as (
    select c.id, 0::float8 as shared_tags
    from public.content c
    where c.id <> p_content_id and public.content_is_public(c.is_published, c.moderation_state)
    order by c.view_count desc, c.created_at desc
    limit (select n * 2 from lim)
  ),
  picks as (
    select id, max(shared_tags) as w from (select * from shared union all select * from popular) u group by id
  )
  select f.* from picks p
  join public.content_feed f on f.id = p.id
  where public.content_is_public(f.is_published, f.moderation_state)
  order by p.w desc, f.view_count desc, f.created_at desc
  limit (select n from lim);
$$;

/** Items the current user liked, newest like first. */
create or replace function public.liked_content(p_limit int default 24, p_offset int default 0)
returns setof public.content_feed
language sql stable security invoker set search_path = public as $$
  select f.* from public.content_likes l
  join public.content_feed f on f.id = l.content_id
  where l.user_id = auth.uid() and public.content_is_public(f.is_published, f.moderation_state)
  order by l.created_at desc
  limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0);
$$;

-- ---------------------------------------------------------------------
-- SEARCH ANALYTICS (privacy-conscious)
-- Stores only the normalised query text and counters. No user id, IP,
-- or session. Queries that look like emails, URLs or long numbers are
-- never stored. Suggestions only surface queries searched ≥ 3 times.
-- ---------------------------------------------------------------------
create table if not exists public.search_queries (
  id                uuid primary key default gen_random_uuid(),
  query             text not null unique check (char_length(query) between 2 and 80),
  search_count      bigint not null default 1 check (search_count >= 0),
  result_count      integer,
  is_blocked        boolean not null default false,
  first_searched_at timestamptz not null default now(),
  last_searched_at  timestamptz not null default now()
);
create index if not exists search_queries_popular_idx on public.search_queries (search_count desc) where not is_blocked;
create index if not exists search_queries_trgm_idx on public.search_queries using gin (query gin_trgm_ops);

alter table public.search_queries enable row level security;
drop policy if exists search_queries_admin on public.search_queries;
create policy search_queries_admin on public.search_queries for all
  using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on public.search_queries from anon;

create or replace function public._normalize_query(p text)
returns text language sql immutable as $$
  select lower(regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.log_search(p_query text, p_result_count int default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  q text := public._normalize_query(p_query);
  n int;
begin
  if char_length(q) < 2 or char_length(q) > 80 then return; end if;
  -- privacy: never store things that look like personal data
  if q ~ '@' or q ~ 'https?://' or q ~ 'www\.' or q ~ '\d{6,}' then return; end if;
  -- The result count is computed here (the client value is ignored), so a
  -- query can only become a suggestion if it really matches public content.
  n := least((select count(*) from public._search_content_ids(q, null, null)), 2147483647)::int;
  insert into public.search_queries (query, result_count)
  values (q, n)
  on conflict (query) do update
    set search_count = public.search_queries.search_count + 1,
        last_searched_at = now(),
        result_count = excluded.result_count;
end $$;

/**
 * Suggestions for the search box, all from real data:
 *   kind 'query'   popular searches (≥3 searches, had results, not blocked)
 *   kind 'tag'     tags ranked by the views of their public content
 *   kind 'content' matching titles (only when the user typed something)
 * Empty prefix → popular searches + popular tags.
 */
create or replace function public.search_suggestions(p_prefix text default '', p_limit int default 8)
returns table (kind text, label text, value text, weight double precision)
language plpgsql stable security definer set search_path = public as $$
declare
  q text := public._normalize_query(p_prefix);
  n int := least(greatest(coalesce(p_limit, 8), 1), 20);
  pre text := public._like_escape(q) || '%';
  mid text := '%' || public._like_escape(q) || '%';
begin
  if char_length(q) > 80 then return; end if;

  return query
    select 'query'::text, sq.query, sq.query, sq.search_count::float8
    from public.search_queries sq
    where not sq.is_blocked and sq.search_count >= 3 and coalesce(sq.result_count, 1) > 0
      and (q = '' or sq.query like pre or sq.query like '% ' || pre)
    order by (sq.query like pre) desc, sq.search_count desc, sq.last_searched_at desc
    limit case when q = '' then n else greatest(n / 2, 3) end;

  return query
    select 'tag'::text, t.name, t.slug, coalesce(sum(c.view_count), 0)::float8
    from public.tags t
    join public.content_tags ct on ct.tag_id = t.id
    join public.content c on c.id = ct.content_id and public.content_is_public(c.is_published, c.moderation_state)
    where q = '' or t.name ilike pre or t.name ilike mid
    group by t.id, t.name, t.slug
    order by (t.name ilike pre) desc, coalesce(sum(c.view_count), 0) desc, t.name
    limit case when q = '' then n else 4 end;

  if q <> '' then
    return query
      select 'content'::text, c.title, c.id::text, c.view_count::float8
      from public.content c
      where public.content_is_public(c.is_published, c.moderation_state)
        and c.title ilike mid
      order by c.view_count desc, c.created_at desc
      limit 4;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- SITE SETTINGS (admin only)
-- ---------------------------------------------------------------------
create table if not exists public.site_settings (
  key        text primary key check (key ~ '^[a-z0-9_]{2,60}$'),
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.site_settings enable row level security;
drop policy if exists site_settings_admin on public.site_settings;
create policy site_settings_admin on public.site_settings for all
  using (public.is_admin()) with check (public.is_admin());

drop trigger if exists site_settings_updated_at on public.site_settings;
create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

insert into public.site_settings (key, value) values
  ('auto_hide_urgent_requests', 'false'::jsonb),   -- hide content while an urgent (consent/minor) request is reviewed
  ('auto_hide_report_threshold', '0'::jsonb)       -- hide after N distinct serious reports (0 = off)
on conflict (key) do nothing;

create or replace function public._setting(p_key text, p_default jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.site_settings where key = p_key), p_default);
$$;
revoke all on function public._setting(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- MODERATION AUDIT LOG (admin only; written by definer functions/triggers)
-- ---------------------------------------------------------------------
create table if not exists public.moderation_actions (
  id                 bigint generated always as identity primary key,
  content_id         uuid,           -- no FK: the log must outlive deleted content
  removal_request_id uuid,
  report_id          uuid,
  actor_id           uuid,           -- null = system/automatic
  action             text not null check (action in (
                       'state_change', 'auto_hide', 'request_status', 'report_status',
                       'content_deleted', 'email_sent', 'note')),
  from_value         text,
  to_value           text,
  note               text check (note is null or char_length(note) <= 4000),
  created_at         timestamptz not null default now()
);
create index if not exists moderation_actions_content_idx on public.moderation_actions (content_id, created_at desc);
create index if not exists moderation_actions_request_idx on public.moderation_actions (removal_request_id, created_at desc);

alter table public.moderation_actions enable row level security;
drop policy if exists moderation_actions_admin_read on public.moderation_actions;
create policy moderation_actions_admin_read on public.moderation_actions for select using (public.is_admin());
revoke insert, update, delete on public.moderation_actions from anon, authenticated;

-- Log content deletions.
create or replace function public.log_content_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.moderation_actions (content_id, actor_id, action, from_value, note)
  values (old.id, auth.uid(), 'content_deleted', old.moderation_state, left(old.title, 200));
  return old;
end $$;
drop trigger if exists content_delete_log on public.content;
create trigger content_delete_log after delete on public.content
  for each row execute function public.log_content_delete();

/** Admin: change a post's moderation state and log it. */
create or replace function public.admin_set_content_state(
  p_content_id uuid, p_state text, p_note text default null, p_request_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_state not in ('active', 'under_review', 'hidden', 'removed') then
    raise exception 'Invalid state';
  end if;
  select moderation_state into v_old from public.content where id = p_content_id for update;
  if not found then raise exception 'Content not found'; end if;
  update public.content set moderation_state = p_state, moderated_at = now() where id = p_content_id;
  insert into public.moderation_actions (content_id, removal_request_id, actor_id, action, from_value, to_value, note)
  values (p_content_id, p_request_id, auth.uid(), 'state_change', v_old, p_state, left(p_note, 4000));
end $$;

-- ---------------------------------------------------------------------
-- REMOVAL REQUESTS (private: only admins can read or change)
-- ---------------------------------------------------------------------
create table if not exists public.removal_requests (
  id                   uuid primary key default gen_random_uuid(),
  reference            text not null unique
                         default ('RR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  content_id           uuid references public.content(id) on delete set null,
  content_url          text check (content_url is null or char_length(content_url) <= 2000),
  content_snapshot     jsonb,          -- title/url at submission; survives content deletion
  email                text not null check (char_length(email) <= 254
                                            and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name                 text check (name is null or char_length(name) <= 120),
  reason               text not null check (reason in (
                         'person_depicted', 'copyright_owner', 'no_permission', 'consent_issue',
                         'underage_concern', 'misleading', 'privacy', 'other')),
  details              text not null check (char_length(details) between 10 and 5000),
  additional_info      text check (additional_info is null or char_length(additional_info) <= 5000),
  good_faith_confirmed boolean not null default false,
  priority             text not null default 'normal' check (priority in ('normal', 'high', 'urgent')),
  status               text not null default 'pending'
                         check (status in ('pending', 'reviewing', 'resolved', 'rejected')),
  resolution           text check (resolution is null or resolution in (
                         'content_kept', 'content_hidden', 'content_removed', 'no_action_needed')),
  admin_notes          text check (admin_notes is null or char_length(admin_notes) <= 10000),
  requester_key        text,           -- hashed anonymous key, for rate limiting only
  ack_sent_at          timestamptz,
  last_response_at     timestamptz,
  resolved_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint removal_requests_target check (content_id is not null or content_url is not null)
);

create index if not exists removal_requests_status_idx on public.removal_requests (status, priority, created_at desc);
create index if not exists removal_requests_content_idx on public.removal_requests (content_id);
create index if not exists removal_requests_email_idx on public.removal_requests (lower(email), created_at desc);
create index if not exists removal_requests_requester_idx on public.removal_requests (requester_key, created_at desc);
-- one open request per content item per email address
create unique index if not exists removal_requests_open_dupe_uidx
  on public.removal_requests (content_id, lower(email))
  where status in ('pending', 'reviewing') and content_id is not null;

alter table public.removal_requests enable row level security;

drop policy if exists removal_requests_admin_select on public.removal_requests;
create policy removal_requests_admin_select on public.removal_requests for select using (public.is_admin());
drop policy if exists removal_requests_admin_update on public.removal_requests;
create policy removal_requests_admin_update on public.removal_requests for update
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists removal_requests_admin_delete on public.removal_requests;
create policy removal_requests_admin_delete on public.removal_requests for delete using (public.is_admin());
-- NO insert policy and no public select: submissions go through
-- submit_removal_request() and requesters can never read the table.
revoke all on public.removal_requests from anon;

create or replace function public.removal_requests_before_update()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status in ('resolved', 'rejected') and old.status not in ('resolved', 'rejected') then
    new.resolved_at := now();
  elsif new.status in ('pending', 'reviewing') then
    new.resolved_at := null;
  end if;
  -- immutable submission fields
  new.id := old.id; new.reference := old.reference; new.email := old.email;
  new.reason := old.reason; new.details := old.details; new.created_at := old.created_at;
  new.requester_key := old.requester_key;
  return new;
end $$;
drop trigger if exists removal_requests_bu on public.removal_requests;
create trigger removal_requests_bu before update on public.removal_requests
  for each row execute function public.removal_requests_before_update();

create or replace function public.removal_requests_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.moderation_actions (content_id, removal_request_id, actor_id, action, from_value, to_value, note)
    values (new.content_id, new.id, auth.uid(), 'request_status', old.status, new.status, new.resolution);
  end if;
  return null;
end $$;
drop trigger if exists removal_requests_au on public.removal_requests;
create trigger removal_requests_au after update on public.removal_requests
  for each row execute function public.removal_requests_after_update();

/**
 * Public entry point for removal requests. Validates, de-duplicates and
 * rate-limits, stores the request, and marks the post "under review".
 * It NEVER deletes content. If the admin enabled auto_hide_urgent_requests,
 * urgent reasons (minor/consent/person depicted) hide the post pending review.
 */
create or replace function public.submit_removal_request(
  p_content_id uuid,
  p_content_url text,
  p_email text,
  p_name text,
  p_reason text,
  p_details text,
  p_additional_info text,
  p_good_faith boolean,
  p_requester text default null)
returns table (id uuid, reference text, duplicate boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_key text := public._actor_key(p_requester);
  v_email text := lower(trim(coalesce(p_email, '')));
  v_priority text;
  v_existing record;
  v_content record;
  v_new record;
begin
  if v_key is null then raise exception 'Missing browser token. Reload the page and try again.'; end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;
  if p_reason not in ('person_depicted', 'copyright_owner', 'no_permission', 'consent_issue',
                      'underage_concern', 'misleading', 'privacy', 'other') then
    raise exception 'Choose a reason.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_details, ''))) < 10 then
    raise exception 'Add a few more details (at least 10 characters).' using errcode = '22023';
  end if;
  if not coalesce(p_good_faith, false) then
    raise exception 'Please confirm the statement at the end of the form.' using errcode = '22023';
  end if;
  if p_content_id is null and nullif(trim(coalesce(p_content_url, '')), '') is null then
    raise exception 'Tell us which content this is about.' using errcode = '22023';
  end if;

  -- rate limits (spam protection)
  if (select count(*) from public.removal_requests r
       where r.requester_key = v_key and r.created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.removal_requests r
          where lower(r.email) = v_email and r.created_at > now() - interval '24 hours') >= 20
     or (select count(*) from public.removal_requests r
          where r.created_at > now() - interval '10 minutes') >= 300 then
    raise exception 'Too many requests. Please wait a while and try again, or email us directly.' using errcode = 'OF429';
  end if;

  if p_content_id is not null then
    select c.id, c.title, c.media_url, c.moderation_state into v_content
      from public.content c where c.id = p_content_id;
    if not found then p_content_id := null; end if;
  end if;

  -- duplicate: same email + same content, still open → return the existing reference
  if p_content_id is not null then
    select r.id, r.reference into v_existing from public.removal_requests r
     where r.content_id = p_content_id and lower(r.email) = v_email and r.status in ('pending', 'reviewing')
     limit 1;
    if found then
      id := v_existing.id; reference := v_existing.reference; duplicate := true;
      return next; return;
    end if;
  end if;

  v_priority := case
    when p_reason in ('underage_concern', 'consent_issue', 'person_depicted') then 'urgent'
    when p_reason in ('privacy', 'no_permission') then 'high'
    else 'normal' end;

  insert into public.removal_requests
    (content_id, content_url, content_snapshot, email, name, reason, details, additional_info,
     good_faith_confirmed, priority, requester_key)
  values
    (p_content_id, left(nullif(trim(coalesce(p_content_url, '')), ''), 2000),
     case when p_content_id is null then null
          else jsonb_build_object('title', v_content.title, 'media_url', v_content.media_url) end,
     v_email, left(nullif(trim(coalesce(p_name, '')), ''), 120), p_reason, left(trim(p_details), 5000),
     left(nullif(trim(coalesce(p_additional_info, '')), ''), 5000), true, v_priority, v_key)
  returning removal_requests.id, removal_requests.reference into v_new;

  if p_content_id is not null then
    if v_priority = 'urgent' and public._setting('auto_hide_urgent_requests', 'false'::jsonb) = 'true'::jsonb
       and v_content.moderation_state in ('active', 'under_review') then
      update public.content set moderation_state = 'hidden', moderated_at = now() where content.id = p_content_id;
      insert into public.moderation_actions (content_id, removal_request_id, action, from_value, to_value, note)
      values (p_content_id, v_new.id, 'auto_hide', v_content.moderation_state, 'hidden', 'Urgent removal request');
    elsif v_content.moderation_state = 'active' then
      update public.content set moderation_state = 'under_review' where content.id = p_content_id;
    end if;
  end if;

  id := v_new.id; reference := v_new.reference; duplicate := false;
  return next;
end $$;

-- ---------------------------------------------------------------------
-- QUICK REPORTS (no email needed; admin only)
-- ---------------------------------------------------------------------
create table if not exists public.content_reports (
  id           uuid primary key default gen_random_uuid(),
  content_id   uuid not null references public.content(id) on delete cascade,
  reason       text not null check (reason in (
                 'underage_concern', 'non_consensual', 'illegal', 'violence',
                 'spam', 'broken_media', 'wrong_tags', 'other')),
  details      text check (details is null or char_length(details) <= 2000),
  reporter_key text not null,
  status       text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'actioned')),
  admin_notes  text check (admin_notes is null or char_length(admin_notes) <= 4000),
  reviewed_by  uuid references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (content_id, reporter_key)          -- one report per person per item
);
create index if not exists content_reports_status_idx on public.content_reports (status, created_at desc);
create index if not exists content_reports_reporter_idx on public.content_reports (reporter_key, created_at desc);

alter table public.content_reports enable row level security;
drop policy if exists content_reports_admin_select on public.content_reports;
create policy content_reports_admin_select on public.content_reports for select using (public.is_admin());
drop policy if exists content_reports_admin_update on public.content_reports;
create policy content_reports_admin_update on public.content_reports for update
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists content_reports_admin_delete on public.content_reports;
create policy content_reports_admin_delete on public.content_reports for delete using (public.is_admin());
revoke all on public.content_reports from anon;

create or replace function public.content_reports_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.moderation_actions (content_id, report_id, actor_id, action, from_value, to_value)
    values (new.content_id, new.id, auth.uid(), 'report_status', old.status, new.status);
  end if;
  return null;
end $$;
drop trigger if exists content_reports_au on public.content_reports;
create trigger content_reports_au after update on public.content_reports
  for each row execute function public.content_reports_after_update();

create or replace function public.submit_content_report(
  p_content_id uuid, p_reason text, p_details text default null, p_reporter text default null)
returns table (id uuid, duplicate boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_key text := public._actor_key(p_reporter);
  v_state text;
  v_id uuid;
  v_threshold int;
  v_serious int;
begin
  if v_key is null then raise exception 'Missing browser token. Reload the page and try again.'; end if;
  if p_reason not in ('underage_concern', 'non_consensual', 'illegal', 'violence',
                      'spam', 'broken_media', 'wrong_tags', 'other') then
    raise exception 'Choose a reason.' using errcode = '22023';
  end if;
  select moderation_state into v_state from public.content c
   where c.id = p_content_id and public.content_is_public(c.is_published, c.moderation_state);
  if not found then raise exception 'This post is not available.' using errcode = '22023'; end if;

  if (select count(*) from public.content_reports r
       where r.reporter_key = v_key and r.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many reports. Please wait a while and try again.' using errcode = 'OF429';
  end if;

  insert into public.content_reports (content_id, reason, details, reporter_key)
  values (p_content_id, p_reason, left(nullif(trim(coalesce(p_details, '')), ''), 2000), v_key)
  on conflict (content_id, reporter_key) do nothing
  returning content_reports.id into v_id;

  if v_id is null then
    select r.id into v_id from public.content_reports r where r.content_id = p_content_id and r.reporter_key = v_key;
    id := v_id; duplicate := true; return next; return;
  end if;

  if p_reason in ('underage_concern', 'non_consensual', 'illegal', 'violence') then
    v_threshold := coalesce((public._setting('auto_hide_report_threshold', '0'::jsonb))::text::int, 0);
    select count(*) into v_serious from public.content_reports r
     where r.content_id = p_content_id and r.status = 'open'
       and r.reason in ('underage_concern', 'non_consensual', 'illegal', 'violence');
    if v_threshold > 0 and v_serious >= v_threshold then
      update public.content set moderation_state = 'hidden', moderated_at = now() where content.id = p_content_id;
      insert into public.moderation_actions (content_id, report_id, action, from_value, to_value, note)
      values (p_content_id, v_id, 'auto_hide', v_state, 'hidden', v_serious || ' serious reports');
    elsif v_state = 'active' then
      update public.content set moderation_state = 'under_review' where content.id = p_content_id;
    end if;
  end if;

  id := v_id; duplicate := false;
  return next;
end $$;

-- ---------------------------------------------------------------------
-- COMPLIANCE RECORD POINTERS (admin only)
-- Stores STATUS and a REFERENCE to where records are kept by the
-- custodian of records. Do NOT upload ID documents or model releases into
-- the public media bucket or into this table.
-- ---------------------------------------------------------------------
create table if not exists public.content_compliance (
  content_id              uuid primary key references public.content(id) on delete cascade,
  consent_status          text not null default 'unknown'
                            check (consent_status in ('unknown', 'documented', 'missing', 'disputed')),
  age_verification_status text not null default 'unverified'
                            check (age_verification_status in ('unverified', 'verified', 'failed')),
  ownership_basis         text not null default 'unknown'
                            check (ownership_basis in ('unknown', 'owned', 'licensed', 'performer_submitted', 'other')),
  performer_count         integer check (performer_count is null or performer_count between 0 and 50),
  records_reference       text check (records_reference is null or char_length(records_reference) <= 500),
  custodian_note          text check (custodian_note is null or char_length(custodian_note) <= 2000),
  verified_by             uuid references public.profiles(id) on delete set null,
  verified_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
alter table public.content_compliance enable row level security;
drop policy if exists content_compliance_admin on public.content_compliance;
create policy content_compliance_admin on public.content_compliance for all
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.content_compliance from anon;

drop trigger if exists content_compliance_updated_at on public.content_compliance;
create trigger content_compliance_updated_at before update on public.content_compliance
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- ADMIN: dashboard numbers and user list
-- ---------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  select jsonb_build_object(
    'total_content',        (select count(*) from public.content),
    'public_content',       (select count(*) from public.content where public.content_is_public(is_published, moderation_state)),
    'hidden_content',       (select count(*) from public.content where moderation_state in ('hidden', 'removed')),
    'under_review',         (select count(*) from public.content where moderation_state = 'under_review'),
    'total_views',          (select coalesce(sum(view_count), 0) from public.content),
    'total_likes',          (select coalesce(sum(like_count), 0) from public.content),
    'views_7d',             (select coalesce(sum(views), 0) from public.content_daily_stats where day >= public._utc_today() - 6),
    'likes_7d',             (select coalesce(sum(likes), 0) from public.content_daily_stats where day >= public._utc_today() - 6),
    'active_ads',           (select count(*) from public.ads where is_active),
    'total_tags',           (select count(*) from public.tags),
    'pending_removals',     (select count(*) from public.removal_requests where status in ('pending', 'reviewing')),
    'urgent_removals',      (select count(*) from public.removal_requests where status in ('pending', 'reviewing') and priority = 'urgent'),
    'open_reports',         (select count(*) from public.content_reports where status = 'open'),
    'total_users',          (select count(*) from public.profiles),
    'missing_compliance',   (select count(*) from public.content c
                              left join public.content_compliance cc on cc.content_id = c.id
                              where cc.content_id is null or cc.consent_status <> 'documented'
                                 or cc.age_verification_status <> 'verified')
  ) into v;
  return v;
end $$;

create or replace function public.admin_list_users(p_limit int default 50, p_offset int default 0)
returns table (id uuid, email text, display_name text, role text, is_anonymous boolean,
               created_at timestamptz, last_sign_in_at timestamptz, like_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  return query
    select p.id, u.email::text, p.display_name, p.role,
           coalesce(u.is_anonymous, false), p.created_at, u.last_sign_in_at,
           (select count(*) from public.content_likes l where l.user_id = p.id)
    from public.profiles p
    left join auth.users u on u.id = p.id
    order by p.created_at desc
    limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end $$;

-- ---------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------
-- Supabase grants EXECUTE on new functions to anon/authenticated by default,
-- so revoke explicitly from those roles, then grant only what is needed.
revoke all on function public.record_view(uuid, text) from public, anon, authenticated;
revoke all on function public.toggle_like(uuid) from public, anon, authenticated;
revoke all on function public.log_search(text, int) from public, anon, authenticated;
revoke all on function public.search_suggestions(text, int) from public, anon, authenticated;
revoke all on function public.submit_removal_request(uuid, text, text, text, text, text, text, boolean, text) from public, anon, authenticated;
revoke all on function public.submit_content_report(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.liked_content(int, int) from public, anon, authenticated;
revoke all on function public.admin_set_content_state(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_dashboard_stats() from public, anon, authenticated;
revoke all on function public.admin_list_users(int, int) from public, anon, authenticated;
revoke all on function public.prune_view_events(int) from public, anon, authenticated;
revoke all on function public.content_likes_rate_limit() from public, anon, authenticated;
revoke all on function public.content_likes_count() from public, anon, authenticated;
revoke all on function public.log_content_delete() from public, anon, authenticated;
revoke all on function public.removal_requests_after_update() from public, anon, authenticated;
revoke all on function public.content_reports_after_update() from public, anon, authenticated;

grant execute on function public.record_view(uuid, text) to anon, authenticated;
grant execute on function public.toggle_like(uuid) to authenticated;
grant execute on function public.log_search(text, int) to anon, authenticated;
grant execute on function public.search_suggestions(text, int) to anon, authenticated;
grant execute on function public.submit_removal_request(uuid, text, text, text, text, text, text, boolean, text) to anon, authenticated;
grant execute on function public.submit_content_report(uuid, text, text, text) to anon, authenticated;
grant execute on function public.browse_content(text, text, text, int, int) to anon, authenticated;
grant execute on function public.search_content(text, text, int, int, text, text) to anon, authenticated;
grant execute on function public.search_content_count(text, text, text) to anon, authenticated;
grant execute on function public.related_content(uuid, int) to anon, authenticated;
grant execute on function public.liked_content(int, int) to authenticated;
grant execute on function public.admin_set_content_state(uuid, text, text, uuid) to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.admin_list_users(int, int) to authenticated;
grant execute on function public.prune_view_events(int) to authenticated;

-- =====================================================================
-- Starter categories for an adult catalogue are NOT inserted here; create
-- your own in /admin/tags. The generic categories from 001 can be renamed
-- or deleted there (tags in use cannot be deleted).
-- =====================================================================
