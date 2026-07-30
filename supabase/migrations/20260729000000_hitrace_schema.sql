-- ============================================================================
-- HitRace (러닝 RPG) — PostgreSQL schema (DDL)
-- Target: PostgreSQL 14+ (developed against 17).
-- Run:    psql "$DATABASE_URL" -f db/schema.sql
-- Idempotent-ish: drops & recreates the `hitrace` schema. See MIGRATIONS note.
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS hitrace;
SET search_path TO hitrace, public;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE rarity      AS ENUM ('N', 'R', 'SR', 'LEGEND');
CREATE TYPE blade_style AS ENUM ('straight', 'curved', 'double_edge', 'chakram');
CREATE TYPE currency    AS ENUM ('ore', 'engraveStone', 'forgeTicket');
CREATE TYPE run_status  AS ENUM ('recorded', 'forged', 'rejected');
CREATE TYPE match_result AS ENUM ('win', 'loss');

-- ── Users & auth ────────────────────────────────────────────────────────────
CREATE TABLE users (
  -- For real players this is the auth.users id (Supabase Auth owns identity, this row owns
  -- game state). Deliberately NOT a foreign key: PvP ghost/bot accounts live here too, and
  -- account deletion is handled by the on_auth_user_deleted trigger instead.
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle          TEXT NOT NULL UNIQUE,
  email           TEXT UNIQUE,
  -- Pluggable auth: provider + subject; password_hash only for the dev provider.
  auth_provider   TEXT NOT NULL DEFAULT 'supabase', -- supabase | (legacy: dev)
  auth_subject    TEXT,
  password_hash   TEXT,
  max_heart_rate  INT  NOT NULL DEFAULT 190,
  rank_rp         INT  NOT NULL DEFAULT 0,
  equipped_sword_id UUID,                          -- FK added after swords table
  gacha_pity      INT  NOT NULL DEFAULT 0,
  streak_days     INT  NOT NULL DEFAULT 0,          -- consecutive-day running streak
  last_run_day    INT,                              -- epoch-day int of last run

  onboarded_at    TIMESTAMPTZ,
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (auth_provider, auth_subject)
);

-- ── Wallet (one row per user × currency) + immutable ledger ─────────────────
CREATE TABLE wallets (
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency  currency NOT NULL,
  balance   INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  PRIMARY KEY (user_id, currency)
);

-- Every currency change is appended here → auditable, cap logic can query "today".
CREATE TABLE currency_ledger (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency   currency NOT NULL,
  delta      INT NOT NULL,
  reason     TEXT NOT NULL,                 -- run_reward | dismantle | upgrade | gacha | quest ...
  ref_id     UUID,                          -- related run/sword/match id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_user_time ON currency_ledger (user_id, created_at DESC);
CREATE INDEX idx_ledger_user_cur_day ON currency_ledger (user_id, currency, created_at);

-- ── Runs (the raw achievement + derived metrics) ────────────────────────────
CREATE TABLE runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          run_status NOT NULL DEFAULT 'recorded',
  -- Full GPS track stored as JSONB (points/cadence/hr). Compress at app tier if large.
  track           JSONB NOT NULL,
  course_hash     TEXT NOT NULL,
  repeat_index    INT  NOT NULL DEFAULT 0,
  -- Derived metrics (server-authoritative; mirror of engine output).
  distance_km       NUMERIC(6,2) NOT NULL,
  duration_sec      INT NOT NULL,
  avg_pace_sec_km   INT NOT NULL,
  elevation_gain_m  INT NOT NULL,
  avg_cadence       INT NOT NULL,
  hr_zone_fraction  NUMERIC(4,3) NOT NULL DEFAULT 0,
  is_round_trip     BOOLEAN NOT NULL DEFAULT false,
  is_closed_loop    BOOLEAN NOT NULL DEFAULT false,
  forge_score       INT,
  reject_reasons    TEXT[],                -- anti-cheat reasons when status='rejected'
  started_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_runs_user_time ON runs (user_id, created_at DESC);
CREATE INDEX idx_runs_user_course ON runs (user_id, course_hash);

-- ── Swords ──────────────────────────────────────────────────────────────────
CREATE TABLE swords (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  run_id        UUID REFERENCES runs(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  rarity        rarity NOT NULL,
  style         blade_style NOT NULL,
  true_double_edge BOOLEAN NOT NULL DEFAULT false,
  -- Base stats (pre-upgrade) and current stats (post-upgrade), plus level.
  base_sharpness INT NOT NULL, base_weight INT NOT NULL, base_durability INT NOT NULL, base_magic INT NOT NULL,
  sharpness INT NOT NULL, weight INT NOT NULL, durability INT NOT NULL, magic INT NOT NULL,
  plus          INT NOT NULL DEFAULT 0,
  cp            INT NOT NULL,
  -- Geometry for rendering: normalized centerline + rune anchors + length scale.
  shape         JSONB NOT NULL,
  course_hash   TEXT NOT NULL,
  is_locked     BOOLEAN NOT NULL DEFAULT false,   -- protect from bulk-dismantle
  dismantled_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_swords_owner ON swords (owner_id) WHERE dismantled_at IS NULL;
CREATE INDEX idx_swords_owner_cp ON swords (owner_id, cp DESC) WHERE dismantled_at IS NULL;

ALTER TABLE users
  ADD CONSTRAINT fk_equipped_sword FOREIGN KEY (equipped_sword_id) REFERENCES swords(id) ON DELETE SET NULL;

-- ── Engravings (catalogue + per-sword slot fills) ───────────────────────────
CREATE TABLE engraving_defs (
  id       TEXT PRIMARY KEY,               -- e.g. 'dawn_pierce'
  name     TEXT NOT NULL,
  rarity   rarity NOT NULL,
  mods     JSONB NOT NULL,                 -- { "sharpness": 40, "magic": 0.12 }
  trigger  TEXT                            -- combat trigger key (nullable)
);

CREATE TABLE sword_engravings (
  sword_id     UUID NOT NULL REFERENCES swords(id) ON DELETE CASCADE,
  slot         INT  NOT NULL,             -- 0-based
  engraving_id TEXT REFERENCES engraving_defs(id),
  PRIMARY KEY (sword_id, slot)
);

-- ── Upgrade history (audit of enhance attempts) ─────────────────────────────
CREATE TABLE upgrade_attempts (
  id         BIGSERIAL PRIMARY KEY,
  sword_id   UUID NOT NULL REFERENCES swords(id) ON DELETE CASCADE,
  from_plus  INT NOT NULL,
  to_plus    INT NOT NULL,
  ore_cost   INT NOT NULL,
  success    BOOLEAN NOT NULL,
  chance     NUMERIC(4,3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Gacha pulls (audit) ─────────────────────────────────────────────────────
CREATE TABLE gacha_pulls (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier        TEXT NOT NULL,              -- legendMaterial | engraveStone | upgradeOre
  pity        BOOLEAN NOT NULL DEFAULT false,
  batch_id    UUID NOT NULL,              -- groups a 10-pull
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Material inventory (from gacha / dismantle) — stackable items.
CREATE TABLE materials (
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id  TEXT NOT NULL,                 -- 'legend_material' | 'whetstone' ...
  qty      INT NOT NULL DEFAULT 0 CHECK (qty >= 0),
  PRIMARY KEY (user_id, item_id)
);

-- ── PvP ─────────────────────────────────────────────────────────────────────
CREATE TABLE matches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id     INT NOT NULL,
  a_user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  a_sword_id    UUID NOT NULL REFERENCES swords(id) ON DELETE CASCADE,
  b_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,   -- null ⇒ ghost
  b_sword_id    UUID REFERENCES swords(id) ON DELETE SET NULL,
  b_is_ghost    BOOLEAN NOT NULL DEFAULT false,
  seed          TEXT NOT NULL,            -- deterministic replay seed
  result        match_result NOT NULL,
  rp_delta      INT NOT NULL,
  log           JSONB,                    -- optional cached event log
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_matches_user_time ON matches (a_user_id, created_at DESC);

-- Ghost snapshots: recorded loadouts other players fight when no live match exists.
CREATE TABLE ghosts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  handle     TEXT NOT NULL,
  sword      JSONB NOT NULL,             -- denormalized combatant snapshot
  cp         INT NOT NULL,
  rank_rp    INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ghosts_cp ON ghosts (cp);

-- ── Seasons & season pass ───────────────────────────────────────────────────
CREATE TABLE seasons (
  id          INT PRIMARY KEY,
  name        TEXT NOT NULL,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE season_pass (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id  INT  NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  level      INT NOT NULL DEFAULT 0,
  km_progress NUMERIC(7,2) NOT NULL DEFAULT 0,   -- levels up by km run
  claimed_free    INT[] NOT NULL DEFAULT '{}',
  claimed_premium INT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, season_id)
);

-- ── Daily quests ────────────────────────────────────────────────────────────
CREATE TABLE quests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_date  DATE NOT NULL,
  code        TEXT NOT NULL,             -- 'pace_5k' | 'distance_3k' ...
  description TEXT NOT NULL,
  target      NUMERIC NOT NULL,
  progress    NUMERIC NOT NULL DEFAULT 0,
  reward_currency currency NOT NULL,
  reward_amount   INT NOT NULL,
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, quest_date, code)
);

-- ── Store & purchases (season pass, skins) ──────────────────────────────────
CREATE TABLE store_items (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,             -- season_pass | skin | title
  name        TEXT NOT NULL,
  price_krw   INT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE purchases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     TEXT NOT NULL REFERENCES store_items(id),
  price_krw   INT NOT NULL,
  provider    TEXT NOT NULL DEFAULT 'mock',   -- mock | play | app_store
  provider_ref TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Codex (도감) — a permanent record of every course ever forged ───────────
-- Survives dismantling the sword: deleting a duplicate becomes a memory kept.
CREATE TABLE codex_entries (
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_hash    TEXT NOT NULL,
  name           TEXT NOT NULL,
  best_rarity    rarity NOT NULL,
  style          blade_style NOT NULL,
  best_cp        INT NOT NULL,
  times_forged   INT NOT NULL DEFAULT 1,
  shape          JSONB NOT NULL,
  first_forged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_forged_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_hash)
);
CREATE INDEX idx_codex_user_time ON codex_entries (user_id, last_forged_at DESC);

-- ── Per-course rivalry leaderboard — best forge-score per runner per course ──
CREATE TABLE course_leaderboard (
  course_hash  TEXT NOT NULL,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  handle       TEXT NOT NULL,
  best_score   INT  NOT NULL,
  best_cp      INT  NOT NULL DEFAULT 0,
  at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (course_hash, user_id)
);
CREATE INDEX idx_course_lb ON course_leaderboard (course_hash, best_score DESC);

-- ── Runtime-tunable balance (mirrors game-core BALANCE; ops can override) ────
CREATE TABLE balance_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;

-- MIGRATIONS: this file rebuilds from scratch (dev). For prod, freeze this as
-- 0001_init.sql and add forward-only migrations under db/migrations/.
