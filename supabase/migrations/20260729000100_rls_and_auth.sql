-- ============================================================================
-- HitRace on Supabase — identity linkage + row-level security.
--
-- Security posture: the game is server-authoritative. Every mutation goes through
-- the `game` Edge Function (service role, bypasses RLS). Clients get READ access to
-- their own rows and to public leaderboards — and NO write policies at all, so a
-- stolen anon key still can't mint ore or edit a sword.
-- ============================================================================

BEGIN;
SET search_path TO hitrace, public;

-- ── A game profile per auth user ────────────────────────────────────────────
-- Anonymous sign-in gives us an auth.users row immediately; this creates the
-- matching game row so the client can start playing without a second round-trip.
CREATE OR REPLACE FUNCTION hitrace.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = hitrace, public
AS $$
DECLARE
  wanted TEXT := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'handle'), ''), NULL);
  final_handle TEXT;
BEGIN
  -- Prefer the handle the app asked for; fall back to a runner-#### name, and
  -- de-duplicate by suffixing the short uuid when taken.
  final_handle := COALESCE(wanted, 'runner_' || substr(NEW.id::text, 1, 4));
  IF EXISTS (SELECT 1 FROM hitrace.users u WHERE u.handle = final_handle) THEN
    final_handle := final_handle || '_' || substr(NEW.id::text, 1, 4);
  END IF;

  INSERT INTO hitrace.users (id, handle, email, auth_provider, auth_subject)
  VALUES (NEW.id, final_handle, NEW.email, 'supabase', NEW.id::text)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO hitrace.wallets (user_id, currency, balance)
  VALUES (NEW.id, 'ore', 0), (NEW.id, 'engraveStone', 0), (NEW.id, 'forgeTicket', 0)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION hitrace.handle_new_auth_user();

-- Deleting the account takes the game state with it (what the FK used to do, minus the
-- constraint that would have blocked bot/ghost accounts).
CREATE OR REPLACE FUNCTION hitrace.handle_deleted_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = hitrace, public
AS $$
BEGIN
  DELETE FROM hitrace.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION hitrace.handle_deleted_auth_user();

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_ledger    ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE swords             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sword_engravings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE upgrade_attempts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE gacha_pulls        ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials          ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_pass        ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases          ENABLE ROW LEVEL SECURITY;
ALTER TABLE codex_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE quests             ENABLE ROW LEVEL SECURITY;
-- Public-by-design tables (still read-only to clients).
ALTER TABLE ghosts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE engraving_defs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_config     ENABLE ROW LEVEL SECURITY;

-- Own rows, read only.
CREATE POLICY own_user      ON users            FOR SELECT USING (id = auth.uid());
CREATE POLICY own_wallet    ON wallets          FOR SELECT USING (user_id = auth.uid());
CREATE POLICY own_ledger    ON currency_ledger  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY own_runs      ON runs             FOR SELECT USING (user_id = auth.uid());
CREATE POLICY own_swords    ON swords           FOR SELECT USING (owner_id = auth.uid());
-- upgrade_attempts is keyed by sword, not user — reach ownership through swords.
CREATE POLICY own_upgrades  ON upgrade_attempts FOR SELECT
  USING (EXISTS (SELECT 1 FROM swords s WHERE s.id = upgrade_attempts.sword_id AND s.owner_id = auth.uid()));
CREATE POLICY own_gacha     ON gacha_pulls      FOR SELECT USING (user_id = auth.uid());
CREATE POLICY own_materials ON materials        FOR SELECT USING (user_id = auth.uid());
CREATE POLICY own_matches   ON matches          FOR SELECT USING (a_user_id = auth.uid());
CREATE POLICY own_pass      ON season_pass      FOR SELECT USING (user_id = auth.uid());
CREATE POLICY own_purchases ON purchases        FOR SELECT USING (user_id = auth.uid());
CREATE POLICY own_codex     ON codex_entries    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY own_quests    ON quests           FOR SELECT USING (user_id = auth.uid());
CREATE POLICY own_engravings ON sword_engravings FOR SELECT
  USING (EXISTS (SELECT 1 FROM swords s WHERE s.id = sword_engravings.sword_id AND s.owner_id = auth.uid()));

-- Public reads: leaderboards, rivals, catalogues.
CREATE POLICY read_ghosts   ON ghosts             FOR SELECT USING (true);
CREATE POLICY read_courselb ON course_leaderboard FOR SELECT USING (true);
CREATE POLICY read_seasons  ON seasons            FOR SELECT USING (true);
CREATE POLICY read_engdefs  ON engraving_defs     FOR SELECT USING (true);
CREATE POLICY read_store    ON store_items        FOR SELECT USING (true);
CREATE POLICY read_balance  ON balance_config     FOR SELECT USING (true);

-- No INSERT/UPDATE/DELETE policies anywhere on purpose: writes are the Edge
-- Function's job (service role). Adding one here would open a cheat path.

-- PostgREST needs usage on the schema to serve the read policies above.
GRANT USAGE ON SCHEMA hitrace TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA hitrace TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA hitrace GRANT SELECT ON TABLES TO anon, authenticated;

COMMIT;
