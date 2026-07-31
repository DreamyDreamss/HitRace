import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { GpsPoint, RunTrack } from '@hitrace/game-core';
import { MemoryRepo, DEMO_USER_ID } from '../db/memory.js';
import { buildServer } from '../server.js';

// Minimal synthetic run generator (Seoul, ~configurable).
// Anchored near "now" on purpose: the running stats bucket by when the run *started*,
// so a track dated 2023 would never land in "this week".
function synthRun(
  distanceKm = 5,
  paceSecPerKm = 330,
  shape: 'line' | 'out_and_back' = 'line',
  startedAt = Date.now() - 2 * 60 * 60 * 1000,
): RunTrack {
  const base = { lat: 37.5285, lng: 126.9327 };
  const n = Math.max(20, Math.round(distanceKm * 40));
  const totalM = distanceKm * 1000;
  const totalSec = distanceKm * paceSecPerKm;
  const points: GpsPoint[] = [];
  const cadence: number[] = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const span = shape === 'out_and_back' ? totalM / 2 : totalM;
    const g = shape === 'out_and_back' ? (f < 0.5 ? f * 2 : (1 - f) * 2) : f;
    const dx = g * span;
    points.push({ lat: base.lat, lng: base.lng + dx / (111320 * Math.cos((base.lat * Math.PI) / 180)), ele: 20 + Math.sin(f * Math.PI) * 40, t: startedAt + Math.round(f * totalSec * 1000) });
    cadence.push(170 + Math.sin(i) * 2);
  }
  return { points, cadence, heartRate: points.map((_, i) => (i / n < 0.6 ? 152 : 95)), maxHeartRate: 190 };
}

let app: FastifyInstance;
let token: string;

async function auth() {
  const res = await app.inject({ method: 'POST', url: '/auth/dev/login', payload: { handle: 'demo' } });
  return JSON.parse(res.body).token as string;
}
const H = () => ({ authorization: `Bearer ${token}` });

beforeAll(async () => {
  app = buildServer({ repo: new MemoryRepo(true) });
  await app.ready();
  token = await auth();
});
afterAll(async () => { await app.close(); });

describe('auth & me', () => {
  it('logs in the demo user and returns a token', () => {
    expect(token).toBe(DEMO_USER_ID);
  });
  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);
  });
  it('returns dashboard for the demo user', async () => {
    const res = await app.inject({ method: 'GET', url: '/me', headers: H() });
    const body = JSON.parse(res.body);
    expect(body.user.handle).toBe('demo');
    expect(body.swordCount).toBe(3);
    expect(body.equipped.name).toBe('한강 새벽선');
    expect(body.wallet.ore).toBe(1240);
  });
  it('creates a fresh runner for an unknown handle (dev repo) with an empty account', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/dev/login', payload: { handle: 'newcomer' } });
    expect(res.statusCode).toBe(200);
    const { token: t, user } = JSON.parse(res.body);
    expect(user.handle).toBe('newcomer');
    expect(user.rankRp).toBe(0);

    const me = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${t}` } });
    const body = JSON.parse(me.body);
    expect(body.swordCount).toBe(0);
    expect(body.equipped ?? null).toBeNull();
    expect(body.wallet.ore).toBe(0);
  });
  it('rejects a blank handle', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/dev/login', payload: { handle: '   ' } });
    expect(res.statusCode).toBe(404);
  });
});

describe('runs → forge', () => {
  it('rejects a too-short run', async () => {
    const res = await app.inject({ method: 'POST', url: '/runs', headers: H(), payload: { track: synthRun(0.4) } });
    expect(res.statusCode).toBe(422);
  });

  it('forges a sword from a valid run and grants ore + ticket', async () => {
    const walletBefore = JSON.parse((await app.inject({ method: 'GET', url: '/wallet', headers: H() })).body);
    const res = await app.inject({ method: 'POST', url: '/runs', headers: H(), payload: { track: synthRun(8, 300, 'out_and_back'), forge: true } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.sword).toBeTruthy();
    expect(body.sword.cp).toBeGreaterThan(0);
    expect(body.rewards.ore).toBeGreaterThan(0);
    expect(body.rewards.forgeTicket).toBe(1); // 8km ≥ 3km
    const walletAfter = JSON.parse((await app.inject({ method: 'GET', url: '/wallet', headers: H() })).body);
    expect(walletAfter.ore).toBeGreaterThan(walletBefore.ore);
  });

  it('enforces the daily forge cap (2/day)', async () => {
    // already forged once above; forge a 2nd, then a 3rd must fail.
    const r2 = await app.inject({ method: 'POST', url: '/runs', headers: H(), payload: { track: synthRun(6, 320), forge: true } });
    expect(r2.statusCode).toBe(200);
    const r3 = await app.inject({ method: 'POST', url: '/runs', headers: H(), payload: { track: synthRun(5, 320), forge: true } });
    expect(r3.statusCode).toBe(429);
  });
});

describe('running log', () => {
  it('lists past runs newest first, without the route payload', async () => {
    const res = await app.inject({ method: 'GET', url: '/runs', headers: H() });
    expect(res.statusCode).toBe(200);
    const runs = JSON.parse(res.body);
    expect(runs.length).toBeGreaterThanOrEqual(2); // forged in the block above
    expect(runs[0].createdAt).toBeGreaterThanOrEqual(runs[1].createdAt);
    expect(runs[0].distanceKm).toBeGreaterThan(0);
    expect(runs[0].route).toBeUndefined();
  });

  it('returns route + per-km splits + the forged sword for one run', async () => {
    const list = JSON.parse((await app.inject({ method: 'GET', url: '/runs', headers: H() })).body);
    const forged = list.find((r: any) => r.swordId);
    expect(forged).toBeTruthy();

    const res = await app.inject({ method: 'GET', url: `/runs/${forged.id}`, headers: H() });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.route.length).toBeGreaterThan(1);
    expect(body.splits.length).toBeGreaterThanOrEqual(Math.floor(forged.distanceKm));
    expect(body.splits[0].km).toBe(1);
    expect(body.bestKmPaceSecPerKm).toBeGreaterThan(0);
    expect(body.sword.id).toBe(forged.swordId);
  });

  it('404s a run that belongs to someone else', async () => {
    const other = await app.inject({ method: 'POST', url: '/auth/dev/login', payload: { handle: 'nosy' } });
    const otherToken = JSON.parse(other.body).token;
    const list = JSON.parse((await app.inject({ method: 'GET', url: '/runs', headers: H() })).body);
    const res = await app.inject({
      method: 'GET', url: `/runs/${list[0].id}`, headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('summarises weekly/monthly volume and personal bests', async () => {
    const res = await app.inject({ method: 'GET', url: '/stats/running', headers: H() });
    expect(res.statusCode).toBe(200);
    const s = JSON.parse(res.body);
    expect(s.thisWeek.runs).toBeGreaterThanOrEqual(2);
    expect(s.thisWeek.distanceKm).toBeGreaterThan(0);
    expect(s.thisWeek.avgPaceSecPerKm).toBeGreaterThan(0);
    expect(s.weekly).toHaveLength(12);
    expect(s.weekly[11].distanceKm).toBeCloseTo(s.thisWeek.distanceKm, 1); // last bucket = this week
    expect(s.personalBests.longestKm).toBeGreaterThanOrEqual(6);
    expect(s.personalBests.fastestPaceSecPerKm).toBeGreaterThan(0);
  });
});

describe('inventory', () => {
  it('lists swords and gets one', async () => {
    const list = JSON.parse((await app.inject({ method: 'GET', url: '/swords', headers: H() })).body);
    expect(list.length).toBeGreaterThanOrEqual(3);
    const one = JSON.parse((await app.inject({ method: 'GET', url: `/swords/${list[0].id}`, headers: H() })).body);
    expect(one.id).toBe(list[0].id);
  });

  it('cannot dismantle the equipped sword', async () => {
    const res = await app.inject({ method: 'POST', url: '/swords/dismantle', headers: H(), payload: { swordIds: ['20000000-0000-0000-0000-000000000001'] } });
    expect(res.statusCode).toBe(409);
  });

  it('dismantles an unequipped sword for ore', async () => {
    const res = await app.inject({ method: 'POST', url: '/swords/dismantle', headers: H(), payload: { swordIds: ['20000000-0000-0000-0000-000000000003'] } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).ore).toBeGreaterThan(0);
  });
});

describe('upgrade', () => {
  it('spends ore and resolves success/failure', async () => {
    const before = JSON.parse((await app.inject({ method: 'GET', url: '/wallet', headers: H() })).body);
    const res = await app.inject({ method: 'POST', url: '/swords/20000000-0000-0000-0000-000000000002/upgrade', headers: H(), payload: { weeklyKm: 18 } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(typeof body.success).toBe('boolean');
    const after = JSON.parse((await app.inject({ method: 'GET', url: '/wallet', headers: H() })).body);
    expect(after.ore).toBe(before.ore - body.cost);
  });
});

describe('gacha', () => {
  it('pulls 10 with enough tickets and advances pity', async () => {
    const res = await app.inject({ method: 'POST', url: '/gacha/pull', headers: H(), payload: { count: 10 } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.pulls.length).toBe(10);
    expect(body.spentTickets).toBe(9);
    for (const p of body.pulls) expect(['legendMaterial', 'engraveStone', 'upgradeOre']).toContain(p.tier);
  });
  it('rejects when tickets are insufficient', async () => {
    // drain: pull until broke
    let res;
    for (let i = 0; i < 20; i++) {
      res = await app.inject({ method: 'POST', url: '/gacha/pull', headers: H(), payload: { count: 1 } });
      if (res.statusCode === 402) break;
    }
    expect(res!.statusCode).toBe(402);
  });
});

// These mutate the demo account in ways that would break other suites' shared
// state, so each gets its own fresh, seeded server instance.
async function freshApp() {
  const a = buildServer({ repo: new MemoryRepo(true) });
  await a.ready();
  const login = await a.inject({ method: 'POST', url: '/auth/dev/login', payload: { handle: 'demo' } });
  return { a, h: { authorization: `Bearer ${JSON.parse(login.body).token}` } };
}

describe('equip (empty-body POST)', () => {
  it('accepts a POST with content-type json and an empty body', async () => {
    const { a, h } = await freshApp();
    const res = await a.inject({ method: 'POST', url: '/swords/20000000-0000-0000-0000-000000000002/equip', headers: { ...h, 'content-type': 'application/json' }, payload: '' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).equippedSwordId).toBe('20000000-0000-0000-0000-000000000002');
    await a.close();
  });
});

describe('fusion', () => {
  it('rejects fusing below-SR swords', async () => {
    const { a, h } = await freshApp();
    const res = await a.inject({ method: 'POST', url: '/forge/fusion', headers: h, payload: { swordIds: ['20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003'] } });
    expect(res.statusCode).toBe(422);
    await a.close();
  });
  it('fuses two SR+ swords and consumes them', async () => {
    const { a, h } = await freshApp();
    await a.inject({ method: 'POST', url: '/swords/20000000-0000-0000-0000-000000000003/equip', headers: h });
    const res = await a.inject({ method: 'POST', url: '/forge/fusion', headers: h, payload: { swordIds: ['20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002'] } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.sword.rarity).toBe('LEGEND');
    expect(body.consumed.length).toBe(2);
    const gone = await a.inject({ method: 'GET', url: '/swords/20000000-0000-0000-0000-000000000001', headers: h });
    expect(gone.statusCode).toBe(404);
    await a.close();
  });
});

describe('codex', () => {
  it('records a forged course and keeps it after the sword is dismantled', async () => {
    const { a, h } = await freshApp();
    const before = JSON.parse((await a.inject({ method: 'GET', url: '/codex', headers: h })).body).totals.courses;
    // forge from a valid run (a new course not among the seeds)
    const forge = await a.inject({ method: 'POST', url: '/runs', headers: h, payload: { track: synthRun(6, 320), forge: true } });
    const sword = JSON.parse(forge.body).sword;
    let codex = JSON.parse((await a.inject({ method: 'GET', url: '/codex', headers: h })).body);
    expect(codex.totals.courses).toBe(before + 1);
    const newEntry = codex.entries.find((e: any) => e.courseHash === sword.courseHash);
    expect(newEntry).toBeTruthy();
    // dismantle the freshly forged sword
    await a.inject({ method: 'POST', url: '/swords/dismantle', headers: h, payload: { swordIds: [sword.id] } });
    // codex still remembers the course
    codex = JSON.parse((await a.inject({ method: 'GET', url: '/codex', headers: h })).body);
    expect(codex.totals.courses).toBe(before + 1);
    expect(codex.entries.find((e: any) => e.courseHash === sword.courseHash)).toBeTruthy();
    await a.close();
  });
});

describe('engravings', () => {
  it('applies an engraving, deducts engrave stones, and raises CP', async () => {
    const { a, h } = await freshApp();
    const walletBefore = JSON.parse((await a.inject({ method: 'GET', url: '/wallet', headers: h })).body);
    const swordBefore = JSON.parse((await a.inject({ method: 'GET', url: '/swords/20000000-0000-0000-0000-000000000001', headers: h })).body);
    const res = await a.inject({ method: 'POST', url: '/swords/20000000-0000-0000-0000-000000000001/engrave', headers: h, payload: { slot: 0, engravingId: 'dawn_pierce' } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.sword.engravings[0].id).toBe('dawn_pierce');
    expect(body.sword.cp).toBeGreaterThan(swordBefore.cp); // +60 sharpness → higher CP
    const walletAfter = JSON.parse((await a.inject({ method: 'GET', url: '/wallet', headers: h })).body);
    expect(walletAfter.engraveStone).toBe(walletBefore.engraveStone - 2); // dawn_pierce costs 2
    await a.close();
  });
  it('rejects when engrave stones are insufficient', async () => {
    const { a, h } = await freshApp();
    // drain: apply until broke (demo starts with 3 stones; each SR costs 2)
    await a.inject({ method: 'POST', url: '/swords/20000000-0000-0000-0000-000000000001/engrave', headers: h, payload: { slot: 0, engravingId: 'dawn_pierce' } });
    const res = await a.inject({ method: 'POST', url: '/swords/20000000-0000-0000-0000-000000000001/engrave', headers: h, payload: { slot: 1, engravingId: 'arcane_surge' } });
    expect(res.statusCode).toBe(402);
    await a.close();
  });
});

describe('course rivalry', () => {
  it('returns a ranked leaderboard for a seeded course', async () => {
    const { a, h } = await freshApp();
    const board = JSON.parse((await a.inject({ method: 'GET', url: '/courses/seed-course-hangang/leaderboard', headers: h })).body);
    expect(board.length).toBeGreaterThanOrEqual(2);
    expect(board[0].rank).toBe(1);
    // sorted by best score descending
    expect(board[0].bestScore).toBeGreaterThanOrEqual(board[1].bestScore);
    await a.close();
  });
});

describe('season & profile', () => {
  it('returns season pass with a reward track', async () => {
    const { a, h } = await freshApp();
    const body = JSON.parse((await a.inject({ method: 'GET', url: '/season', headers: h })).body);
    expect(body.pass.level).toBeGreaterThanOrEqual(0);
    expect(body.rewards.length).toBeGreaterThan(0);
    await a.close();
  });
  it('returns an aggregated profile', async () => {
    const { a, h } = await freshApp();
    const body = JSON.parse((await a.inject({ method: 'GET', url: '/profile', headers: h })).body);
    expect(body.totals.bestCp).toBeGreaterThan(0);
    expect(body.totals).toHaveProperty('byRarity');
    await a.close();
  });
});

describe('pvp', () => {
  it('finds a ghost within the CP band', async () => {
    const res = await app.inject({ method: 'GET', url: '/pvp/match?waitSec=61', headers: H() });
    const body = JSON.parse(res.body);
    expect(body.found).toBe(true);
    expect(body.opponent.cp).toBeGreaterThan(0);
  });
  it('resolves a match, updates RP, returns a combat log', async () => {
    const match = JSON.parse((await app.inject({ method: 'GET', url: '/pvp/match?waitSec=61', headers: H() })).body);
    const res = await app.inject({ method: 'POST', url: '/pvp/resolve', headers: H(), payload: { ghostId: match.opponent.id } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(typeof body.won).toBe('boolean');
    expect(body.combat.log.length).toBeGreaterThan(0);
    expect(body.rankRp).toBeGreaterThanOrEqual(0);
  });
  it('returns a ranking list', async () => {
    const res = await app.inject({ method: 'GET', url: '/pvp/ranking', headers: H() });
    const body = JSON.parse(res.body);
    expect(body[0].rank).toBe(1);
  });
});
