-- 동네 보스 — the live state of the content.
--
-- Bosses are created lazily: the first validated run inside a region spawns one. Pre-creating
-- 3,482 dong bosses every week would be 3,482 rows a week of mostly nothing.

create table if not exists hitrace.bosses (
  id           uuid primary key default gen_random_uuid(),
  region_code  text not null references hitrace.regions(code),
  level        text not null check (level in ('dong', 'gu')),
  -- '2026-W31' for dong (weekly), '2026-08' for gu (monthly).
  cycle_key    text not null,
  tier         int  not null default 1,
  name         text not null,
  seed         text not null,
  max_hp       bigint not null,
  hp           bigint not null,
  participants int not null default 0,
  spawned_at   timestamptz not null default now(),
  killed_at    timestamptz,
  unique (region_code, cycle_key, tier)
);

create index if not exists bosses_live_idx
  on hitrace.bosses (region_code, cycle_key) where killed_at is null;

-- Per-runner contribution to one boss. The primary key is what makes damage idempotent-ish:
-- a run adds to an existing row rather than inserting a new one.
create table if not exists hitrace.boss_damage (
  boss_id  uuid not null references hitrace.bosses(id) on delete cascade,
  user_id  uuid not null references hitrace.users(id) on delete cascade,
  damage   bigint not null default 0,
  runs     int    not null default 0,
  last_at  timestamptz not null default now(),
  primary key (boss_id, user_id)
);

create index if not exists boss_damage_user_idx on hitrace.boss_damage (user_id);

-- Kills are kept forever: they are the neighbourhood's history, and the thing a title hangs off.
create table if not exists hitrace.boss_kills (
  id           uuid primary key default gen_random_uuid(),
  boss_id      uuid not null references hitrace.bosses(id) on delete cascade,
  region_code  text not null references hitrace.regions(code),
  level        text not null,
  cycle_key    text not null,
  tier         int  not null,
  killed_at    timestamptz not null default now(),
  participants int  not null,
  top_user_id  uuid references hitrace.users(id) on delete set null,
  final_user_id uuid references hitrace.users(id) on delete set null
);

create index if not exists boss_kills_region_idx on hitrace.boss_kills (region_code, killed_at desc);

-- Which regions a run touched, and how far into each. Kept as an audit trail: when someone asks
-- why a run dealt the damage it did, this is the answer.
create table if not exists hitrace.run_regions (
  run_id      uuid not null references hitrace.runs(id) on delete cascade,
  region_code text not null references hitrace.regions(code),
  level       text not null,
  distance_km double precision not null,
  damage      bigint not null default 0,
  primary key (run_id, region_code)
);

-- ── Wallet & sword growth ────────────────────────────────────────────────────
-- Wallets are one row per currency, so a new currency is a new enum value — no schema change to
-- the table itself and every existing balance query keeps working.
alter type hitrace.currency add value if not exists 'manaStone';
alter table hitrace.swords add column if not exists awakening int not null default 0;

-- Opting out of the contribution leaderboard. Boss content reveals which neighbourhood someone
-- runs in — not their address, but more than some people want public. Off by default is wrong
-- (an empty board is a dead feature), so it is on with a way out.
alter table hitrace.users add column if not exists boss_anonymous boolean not null default false;

-- ── Region attribution for one run ───────────────────────────────────────────
--
-- Walks the stored route and adds each leg's length to whichever region its start point falls in.
-- Legs flagged `gap` (recording resumed after a blackout) contribute nothing — the same rule the
-- distance itself already follows.
--
-- Returns one row per region: (code, level, distance_km).
create or replace function hitrace.run_region_split(p_run_id uuid, p_level text)
returns table (region_code text, distance_km double precision)
language sql
stable
as $$
  with pts as (
    select
      ordinality as idx,
      (p->>'lat')::double precision as lat,
      (p->>'lng')::double precision as lng,
      coalesce((p->>'gap')::boolean, false) as gap
      from hitrace.runs r,
           lateral jsonb_array_elements(coalesce(r.track->'points', '[]'::jsonb))
             with ordinality as t(p, ordinality)
     where r.id = p_run_id
  ),
  legs as (
    select
      a.lat as lat, a.lng as lng,
      st_distance(
        st_setsrid(st_makepoint(a.lng, a.lat), 4326)::geography,
        st_setsrid(st_makepoint(b.lng, b.lat), 4326)::geography
      ) / 1000.0 as km
      from pts a
      join pts b on b.idx = a.idx + 1
     where not b.gap
  )
  select r.code, sum(l.km)
    from legs l
    join hitrace.regions r
      on r.level = p_level
     and r.retired_at is null
     and st_contains(r.geom, st_setsrid(st_makepoint(l.lng, l.lat), 4326))
   group by r.code
   having sum(l.km) > 0;
$$;

comment on function hitrace.run_region_split is
  'Distance of a run per region. Boundary runners are credited to every region they crossed rather than to one.';

-- ── RLS: read your own contribution, read bosses, write nothing ──────────────
alter table hitrace.bosses enable row level security;
alter table hitrace.boss_damage enable row level security;
alter table hitrace.boss_kills enable row level security;
alter table hitrace.run_regions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='hitrace' and tablename='bosses' and policyname='bosses_readable') then
    create policy bosses_readable on hitrace.bosses for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hitrace' and tablename='boss_kills' and policyname='boss_kills_readable') then
    create policy boss_kills_readable on hitrace.boss_kills for select using (true);
  end if;
  -- Contribution rows are public on purpose: the leaderboard is the point. Runners who opt out
  -- are filtered by the Edge Function, which is also what renders names.
  if not exists (select 1 from pg_policies where schemaname='hitrace' and tablename='boss_damage' and policyname='boss_damage_readable') then
    create policy boss_damage_readable on hitrace.boss_damage for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hitrace' and tablename='run_regions' and policyname='run_regions_own') then
    create policy run_regions_own on hitrace.run_regions for select
      using (exists (select 1 from hitrace.runs r where r.id = run_id and r.user_id = auth.uid()));
  end if;
end $$;
