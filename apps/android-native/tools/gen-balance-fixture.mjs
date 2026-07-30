// Generates the parity fixture the native app's unit test checks itself against.
// `data/Balance.kt` is a hand-written mirror of packages/game-core; this fixture is
// the engine's own answers, so drift in either direction fails the Kotlin test.
//
//   cd apps/android-native && node --import tsx tools/gen-balance-fixture.mjs
//
// Re-run it whenever game-core's balance or economy math changes.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// file:// URL — a bare Windows path is not a supported ESM specifier.
const core = pathToFileURL(resolve(here, '../../../packages/game-core/src/index.ts')).href;

const {
  BALANCE,
  upgradeCost,
  upgradeSuccessChance,
  streakBonus,
  applyUpgrade,
  computeCP,
  tierFromRp,
  previewFusion,
  ENGRAVING_CATALOG,
} = await import(core);

const STATS = [
  { sharpness: 560, weight: 480, durability: 520, magic: 610 },
  { sharpness: 842, weight: 610, durability: 733, magic: 418 },
  { sharpness: 250, weight: 120, durability: 760, magic: 120 },
];

const fixture = {
  gacha: {
    pityCount: BALANCE.gacha.pityCount,
    ticketPerPull: BALANCE.gacha.ticketPerPull,
    ticketPer10Pull: BALANCE.gacha.ticketPer10Pull,
    rates: BALANCE.gacha.rates,
  },
  upgradeCost: Object.fromEntries([0, 1, 2, 3, 5, 7, 10].map((p) => [p, upgradeCost(p)])),
  upgradeSuccessChance: [
    [0, 0, 0],
    [3, 18.6, 3],
    [7, 40, 7],
    [12, 100, 30],
  ].map(([plus, weeklyKm, streak]) => ({
    plus, weeklyKm, streak, chance: upgradeSuccessChance(plus, weeklyKm, streak),
  })),
  streakBonus: Object.fromEntries([0, 1, 3, 7, 12].map((d) => [d, streakBonus(d)])),
  applyUpgrade: STATS.map((s) => ({ from: s, to: applyUpgrade(s, 0) })),
  computeCP: STATS.map((s) => ({ stats: s, cp: computeCP(s) })),
  tierLabel: Object.fromEntries([0, 99, 100, 399, 400, 1449, 5200].map((rp) => [rp, tierFromRp(rp).label])),
  fusion: (() => {
    const mk = (id, stats, cp, rarity) => ({
      id, ownerId: 'u', name: id, rarity, stats, shape: { style: 'straight', lengthScale: 0.5, trueDoubleEdge: false, centerline: [], runeAnchors: [] },
      plus: 0, cp, engravings: [], createdAt: 0,
    });
    const a = mk('a', STATS[0], computeCP(STATS[0]), 'SR');
    const b = mk('b', STATS[1], computeCP(STATS[1]), 'LEGEND');
    return { a: { stats: a.stats, cp: a.cp }, b: { stats: b.stats, cp: b.cp }, blended: previewFusion(a, b) };
  })(),
  engravings: ENGRAVING_CATALOG.map((e) => ({ id: e.id, name: e.name, rarity: e.rarity, cost: e.cost, set: e.set ?? null })),
};

const out = resolve(here, '../app/src/test/resources/balance-fixture.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(fixture, null, 2) + '\n');
console.log('wrote', out);
