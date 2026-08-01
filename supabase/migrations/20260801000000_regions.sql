-- Administrative regions — the board the boss content is played on.
--
-- Resolution is server-side and authoritative: a client cannot claim "I ran in 연남동". The route
-- stored with each run is matched against these polygons, so the damage a run deals is a fact
-- about where it happened, not a field the client fills in.
--
-- Two levels, both from datasets bundled with the project (no external geocoding service — see
-- docs/RUNDEX_LESSONS.md on depending on SLA-less public servers):
--   dong — 3,482 행정동, the "우리 동네" unit
--   gu   — 230 시군구, the parent unit the monthly raid runs on

create extension if not exists postgis;

create table if not exists hitrace.regions (
  code        text primary key,
  name        text not null,              -- '연남동' / '마포구'
  -- 중구·동구 등은 여러 시도에 동시에 존재합니다. 순위표에서 구를 구분하려면 시도가 필요합니다.
  sido        text,
  -- 'dong' | 'gu'. 'grid' is reserved for a future geohash fallback outside Korea.
  level       text not null check (level in ('dong', 'gu', 'grid')),
  parent_code text references hitrace.regions(code),
  geom        geometry(MultiPolygon, 4326) not null,
  centroid    geometry(Point, 4326) not null,
  -- Administrative boundaries get redrawn. Retired codes stay for historical kill records.
  valid_from  date not null default current_date,
  retired_at  date
);

create index if not exists regions_geom_gix on hitrace.regions using gist (geom);
create index if not exists regions_level_idx on hitrace.regions (level);
create index if not exists regions_parent_idx on hitrace.regions (parent_code);

comment on table hitrace.regions is
  'Administrative boundaries for boss content. Point-in-polygon lookups run against the GIST index.';

-- Which region contains this point? Returns at most one row per level.
create or replace function hitrace.region_at(p_lat double precision, p_lng double precision, p_level text)
returns text
language sql
stable
as $$
  select r.code
    from hitrace.regions r
   where r.level = p_level
     and r.retired_at is null
     and st_contains(r.geom, st_setsrid(st_makepoint(p_lng, p_lat), 4326))
   limit 1;
$$;

-- Regions are public reference data — everyone reads, nobody writes (writes go through the
-- Edge Function's service role, same as every other table here).
alter table hitrace.regions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'hitrace' and tablename = 'regions' and policyname = 'regions_readable'
  ) then
    create policy regions_readable on hitrace.regions for select using (true);
  end if;
end $$;
