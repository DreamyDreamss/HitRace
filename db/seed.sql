-- ============================================================================
-- HitRace — seed data. Run AFTER schema.sql:
--   psql "$DATABASE_URL" -f db/seed.sql
-- Creates a ready-to-play demo account (handle: demo) plus catalogue data.
-- ============================================================================

BEGIN;
SET search_path TO hitrace, public;

-- Fixed demo IDs so the app/tests can reference them.
-- demo user:   11111111-1111-1111-1111-111111111111
-- swords:      2000....01 / 02 / 03

INSERT INTO users (id, handle, email, auth_provider, password_hash, rank_rp, gacha_pity, streak_days, last_run_day, onboarded_at)
VALUES ('11111111-1111-1111-1111-111111111111', 'demo', 'demo@hitrace.app', 'dev',
        -- bcrypt hash of "hitrace" (dev only)
        '$2a$10$devdevdevdevdevdevdevdeO', 1449, 37, 3, (extract(epoch from now())/86400)::int, now());

INSERT INTO wallets (user_id, currency, balance) VALUES
  ('11111111-1111-1111-1111-111111111111', 'ore', 1240),
  ('11111111-1111-1111-1111-111111111111', 'engraveStone', 3),
  ('11111111-1111-1111-1111-111111111111', 'forgeTicket', 11);

-- ── Engraving catalogue ─────────────────────────────────────────────────────
INSERT INTO engraving_defs (id, name, rarity, mods, trigger) VALUES
  ('dawn_pierce',   '새벽 · 관통', 'SR',     '{"sharpness": 60}',          'pierce'),
  ('mountain_might','산 · 강타',   'SR',     '{"weight": 80}',             NULL),
  ('steady_guard',  '지구 · 방벽', 'R',      '{"durability": 70}',         NULL),
  ('arcane_surge',  '비전 · 폭주', 'LEGEND', '{"magic": 90}',              'magic_boost'),
  ('river_flow',    '유수 · 연격', 'R',      '{"sharpness": 30, "magic": 20}', NULL);

-- ── Demo swords (shape JSONB is a compact placeholder; app regenerates on forge) ──
INSERT INTO swords (id, owner_id, name, rarity, style, true_double_edge,
  base_sharpness, base_weight, base_durability, base_magic,
  sharpness, weight, durability, magic, plus, cp, shape, course_hash) VALUES
  ('20000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   '한강 새벽선', 'LEGEND', 'double_edge', true,
   740, 540, 650, 370,  842, 610, 733, 418, 7, 1740,
   '{"style":"double_edge","lengthScale":0.66,"centerline":[],"runeAnchors":[],"trueDoubleEdge":true}', 'seed-course-hangang'),
  ('20000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   '남산 곡도', 'SR', 'curved', false,
   560, 480, 520, 610,  560, 480, 520, 610, 3, 1452,
   '{"style":"curved","lengthScale":0.42,"centerline":[],"runeAnchors":[],"trueDoubleEdge":false}', 'seed-course-namsan'),
  ('20000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   '잠실 순환환', 'R', 'chakram', false,
   420, 300, 480, 260,  420, 300, 480, 260, 1, 1010,
   '{"style":"chakram","lengthScale":0.30,"centerline":[],"runeAnchors":[],"trueDoubleEdge":false}', 'seed-course-jamsil');

UPDATE users SET equipped_sword_id = '20000000-0000-0000-0000-000000000001'
WHERE id = '11111111-1111-1111-1111-111111111111';

INSERT INTO sword_engravings (sword_id, slot, engraving_id) VALUES
  ('20000000-0000-0000-0000-000000000001', 0, 'dawn_pierce'),
  ('20000000-0000-0000-0000-000000000001', 1, 'arcane_surge'),
  ('20000000-0000-0000-0000-000000000001', 2, NULL),
  ('20000000-0000-0000-0000-000000000002', 0, 'steady_guard'),
  ('20000000-0000-0000-0000-000000000002', 1, NULL);

-- ── PvP ghosts (opponents for async battles) ────────────────────────────────
INSERT INTO ghosts (user_id, handle, sword, cp, rank_rp) VALUES
  ('11111111-1111-1111-1111-111111111111', '러너_2481',
   '{"name":"북악 절단","stats":{"sharpness":760,"weight":520,"durability":600,"magic":340},"cadence":168,"engravings":[]}', 1680, 1452),
  ('11111111-1111-1111-1111-111111111111', '새벽질주',
   '{"name":"청계 월광","stats":{"sharpness":690,"weight":610,"durability":540,"magic":420},"cadence":175,"engravings":[]}', 1712, 1444),
  ('11111111-1111-1111-1111-111111111111', '언덕왕',
   '{"name":"관악 등정","stats":{"sharpness":640,"weight":800,"durability":580,"magic":300},"cadence":160,"engravings":[]}', 1735, 1460);

-- ── Season + pass ───────────────────────────────────────────────────────────
INSERT INTO seasons (id, name, starts_at, ends_at, is_active) VALUES
  (3, '시즌 3 · 강철의 계절', now() - interval '32 days', now() + interval '24 days', true);

INSERT INTO season_pass (user_id, season_id, is_premium, level, km_progress) VALUES
  ('11111111-1111-1111-1111-111111111111', 3, false, 12, 148.6);

-- ── Daily quests for demo ───────────────────────────────────────────────────
INSERT INTO quests (user_id, quest_date, code, description, target, progress, reward_currency, reward_amount) VALUES
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE, 'pace_5k',
   '평균 페이스 5''30" 이하로 5km — 예리함 보너스', 5, 2.1, 'ore', 300),
  ('11111111-1111-1111-1111-111111111111', CURRENT_DATE, 'explore_new',
   '새로운 코스 1개 탐험', 1, 0, 'forgeTicket', 1);

-- ── Store ───────────────────────────────────────────────────────────────────
INSERT INTO store_items (id, kind, name, price_krw, payload) VALUES
  ('pass_s3',    'season_pass', '시즌 3 프리미엄 패스', 5900, '{"season":3}'),
  ('skin_ember', 'skin',        '잔불 검신 이펙트',      2200, '{"fx":"ember"}'),
  ('skin_frost', 'skin',        '서리 검집',            3300, '{"fx":"frost"}'),
  ('skin_aurora','skin',        '오로라 주조 연출',      7700, '{"fx":"aurora"}');

-- ── Balance mirror (ops-tunable subset) ─────────────────────────────────────
INSERT INTO balance_config (key, value) VALUES
  ('economy.caps.oreDaily', '600'),
  ('economy.caps.engraveStoneWeekly', '5'),
  ('gacha.rates', '{"legendMaterial":0.012,"engraveStone":0.065,"upgradeOre":0.923}'),
  ('gacha.pityCount', '90'),
  ('run.maxForgesPerDay', '2');

-- Materials the demo already owns
INSERT INTO materials (user_id, item_id, qty) VALUES
  ('11111111-1111-1111-1111-111111111111', 'whetstone', 4),
  ('11111111-1111-1111-1111-111111111111', 'legend_material', 1);

-- ── Codex entries for the demo's three seeded courses ───────────────────────
INSERT INTO codex_entries (user_id, course_hash, name, best_rarity, style, best_cp, times_forged, shape) VALUES
  ('11111111-1111-1111-1111-111111111111', 'seed-course-hangang', '한강 새벽선', 'LEGEND', 'double_edge', 1740, 1, '{"style":"double_edge","lengthScale":0.66,"centerline":[],"runeAnchors":[],"trueDoubleEdge":true}'),
  ('11111111-1111-1111-1111-111111111111', 'seed-course-namsan', '남산 곡도', 'SR', 'curved', 1452, 1, '{"style":"curved","lengthScale":0.42,"centerline":[],"runeAnchors":[],"trueDoubleEdge":false}'),
  ('11111111-1111-1111-1111-111111111111', 'seed-course-jamsil', '잠실 순환환', 'R', 'chakram', 1010, 1, '{"style":"chakram","lengthScale":0.30,"centerline":[],"runeAnchors":[],"trueDoubleEdge":false}');

-- ── Rival users + per-course leaderboard rows ───────────────────────────────
INSERT INTO users (id, handle, auth_provider) VALUES
  ('33333333-0000-0000-0000-000000000001', '새벽질주', 'dev'),
  ('33333333-0000-0000-0000-000000000002', '언덕왕', 'dev'),
  ('33333333-0000-0000-0000-000000000003', '강변러너', 'dev');

INSERT INTO course_leaderboard (course_hash, user_id, handle, best_score, best_cp) VALUES
  ('seed-course-hangang', '11111111-1111-1111-1111-111111111111', 'demo', 93, 1740),
  ('seed-course-hangang', '33333333-0000-0000-0000-000000000001', '새벽질주', 88, 1700),
  ('seed-course-hangang', '33333333-0000-0000-0000-000000000002', '언덕왕', 79, 1660),
  ('seed-course-namsan',  '11111111-1111-1111-1111-111111111111', 'demo', 81, 1452),
  ('seed-course-namsan',  '33333333-0000-0000-0000-000000000003', '강변러너', 72, 1400);

COMMIT;
