-- 속성 — the weather a run happened in, carried by the sword it forged.
--
-- Nullable / 'none' by default: the weather service is allowed to be unavailable, and a run must
-- forge a sword regardless. A plain blade is a fine outcome; a failed forge is not.
alter table hitrace.swords add column if not exists element text not null default 'none';
alter table hitrace.bosses add column if not exists element text not null default 'none';

-- Kept alongside the sword so the app can say *why* it has the element it has, and so a future
-- balance change can be re-derived from the original reading rather than guessed at.
alter table hitrace.swords add column if not exists weather jsonb;

comment on column hitrace.swords.element is
  'fire | water | wind | ice | none — derived server-side from the weather at the run''s start.';
