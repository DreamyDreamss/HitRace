-- ============================================================================
-- HitRace seed for Supabase.
--
-- Difference from db/seed.sql: no demo *player*. Real players arrive through
-- Supabase Auth (anonymous sign-in) and a trigger creates their profile. What we
-- seed here is the world: the engraving catalogue, three PvP bot opponents, the
-- active season, the store and the ops-tunable balance mirror.
--
--   npx supabase db push        # schema
--   npx supabase db seed        # this file (or psql -f)
-- ============================================================================

BEGIN;
SET search_path TO hitrace, public;

-- ── PvP bots ────────────────────────────────────────────────────────────────
-- They own the ghosts a new player fights before the population grows. Not auth
-- accounts on purpose: nobody logs in as them.
INSERT INTO users (id, handle, auth_provider, rank_rp) VALUES
  ('00000000-0000-4000-8000-00000000b001', '러너_2481', 'bot', 1452),
  ('00000000-0000-4000-8000-00000000b002', '새벽질주',  'bot', 1444),
  ('00000000-0000-4000-8000-00000000b003', '언덕왕',    'bot', 1460)
ON CONFLICT (id) DO NOTHING;

INSERT INTO ghosts (user_id, handle, sword, cp, rank_rp) VALUES
  ('00000000-0000-4000-8000-00000000b001', '러너_2481',
   '{"name":"북악 절단","stats":{"sharpness":760,"weight":520,"durability":600,"magic":340},"cadence":168,"engravings":[]}', 1680, 1452),
  ('00000000-0000-4000-8000-00000000b002', '새벽질주',
   '{"name":"청계 월광","stats":{"sharpness":690,"weight":610,"durability":540,"magic":420},"cadence":175,"engravings":[]}', 1712, 1444),
  ('00000000-0000-4000-8000-00000000b003', '언덕왕',
   '{"name":"관악 등정","stats":{"sharpness":640,"weight":800,"durability":580,"magic":300},"cadence":160,"engravings":[]}', 1735, 1460)
ON CONFLICT DO NOTHING;

-- ── Engraving catalogue ─────────────────────────────────────────────────────
INSERT INTO engraving_defs (id, name, rarity, mods, trigger) VALUES
  ('dawn_pierce',    '새벽 · 관통', 'SR',     '{"sharpness":60}',            'pierce'),
  ('mountain_might', '산 · 강타',   'SR',     '{"weight":80}',                NULL),
  ('steady_guard',   '지구 · 방벽', 'R',      '{"durability":70}',            NULL),
  ('arcane_surge',   '비전 · 폭주', 'LEGEND', '{"magic":90}',                 'magic_boost'),
  ('river_flow',     '유수 · 연격', 'R',      '{"sharpness":30,"magic":20}',  NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Season ──────────────────────────────────────────────────────────────────
INSERT INTO seasons (id, name, starts_at, ends_at, is_active) VALUES
  (3, '시즌 3 · 강철의 계절', now() - interval '32 days', now() + interval '24 days', true)
ON CONFLICT (id) DO NOTHING;

-- ── Store ───────────────────────────────────────────────────────────────────
INSERT INTO store_items (id, kind, name, price_krw, payload) VALUES
  ('pass_s3',    'season_pass', '시즌 3 프리미엄 패스', 5900, '{"season":3}'),
  ('skin_ember', 'skin',        '잔불 검신 이펙트',      2200, '{"fx":"ember"}'),
  ('skin_frost', 'skin',        '서리 검집',            3300, '{"fx":"frost"}'),
  ('skin_aurora','skin',        '오로라 주조 연출',      7700, '{"fx":"aurora"}')
ON CONFLICT (id) DO NOTHING;

-- ── Balance mirror (ops-tunable subset) ─────────────────────────────────────
INSERT INTO balance_config (key, value) VALUES
  ('economy.caps.oreDaily', '600'),
  ('economy.caps.engraveStoneWeekly', '5'),
  ('gacha.rates', '{"legendMaterial":0.012,"engraveStone":0.065,"upgradeOre":0.923}'),
  ('gacha.pityCount', '90'),
  ('run.maxForgesPerDay', '2')
ON CONFLICT (key) DO NOTHING;

COMMIT;
