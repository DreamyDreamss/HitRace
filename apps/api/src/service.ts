// GameService — all business logic. Server-authoritative: the client submits a run
// track and we decide the reward; the client never mints its own currency or swords.

import {
  BALANCE,
  applyUpgrade,
  computeCP,
  computeForgeScore,
  dismantleYield,
  forgeSword,
  grantCapped,
  matchBand,
  pull,
  pullMany,
  rpDelta,
  runOreReward,
  runTicketReward,
  simulateCombat,
  fuseSwords,
  validateFusion,
  forgeManual,
  effectiveStats,
  activeSynergies,
  getEngraving,
  nextStreak,
  upgradeCost,
  upgradeSuccessChance,
  validateRun,
  type Combatant,
  type Currency,
  type GachaPull,
  type RunTrack,
  type Sword,
  Rng,
  fingerprint,
} from '@hitrace/game-core';
import { randomUUID } from 'node:crypto';
import type { LedgerEntry, MatchRecord, Repo, RunRecord } from './db/repo.js';

// Entity ids must be valid UUIDs — the Postgres schema uses uuid PKs. (The
// in-memory repo accepts any string, so this only surfaces against a real DB.)
// The `prefix` arg is kept for call-site readability; the value is a UUID.
function id(_prefix?: string): string {
  return randomUUID();
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function epochDay(ts: number): number {
  return Math.floor(ts / 86_400_000);
}
function startOfWeek(ts: number): number {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7; // Monday=0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export class ServiceError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}

export class GameService {
  constructor(private repo: Repo) {}

  // ── Runs → forge ───────────────────────────────────────────────────────────
  async submitRun(userId: string, track: RunTrack, opts: { forge: boolean; name?: string }) {
    const user = await this.repo.getUser(userId);
    if (!user) throw new ServiceError('no_user', 404);

    const courseHash = fingerprint(track);
    const priorRepeats = await this.repo.countRunsForCourse(userId, courseHash);
    const validation = validateRun(track, { priorRepeats });

    const now = Date.now();
    const runId = id('run');

    if (!validation.ok) {
      const rec: RunRecord = {
        id: runId, userId, status: 'rejected', courseHash, repeatIndex: priorRepeats,
        distanceKm: 0, durationSec: 0, avgPaceSecPerKm: 0, elevationGainM: 0,
        rejectReasons: validation.reasons, startedAt: track.points[0]?.t ?? now, createdAt: now,
      };
      await this.repo.createRun(rec);
      throw new ServiceError('run_rejected:' + validation.reasons.join(','), 422);
    }

    // Daily forge cap.
    if (opts.forge) {
      const forgedToday = await this.repo.countForgesOnDay(userId, startOfDay(now));
      if (forgedToday >= BALANCE.run.maxForgesPerDay) {
        throw new ServiceError('daily_forge_cap', 429);
      }
    }

    const swordId = id('sword');
    const outcome = forgeSword(track, {
      ownerId: userId, runId, swordId, repeatIndex: priorRepeats, createdAt: now, name: opts.name,
    });
    const { sword, metrics } = outcome;

    const rec: RunRecord = {
      id: runId, userId, status: opts.forge ? 'forged' : 'recorded', courseHash, repeatIndex: priorRepeats,
      distanceKm: metrics.distanceKm, durationSec: Math.round(metrics.durationSec), avgPaceSecPerKm: Math.round(metrics.avgPaceSecPerKm),
      elevationGainM: Math.round(metrics.elevationGainM), forgeScore: undefined,
      startedAt: track.points[0]!.t, createdAt: now,
    };
    await this.repo.createRun(rec);

    // Rewards (ore capped daily; tickets uncapped) — always granted for a valid run.
    const rewards = await this.grantRunRewards(userId, metrics.distanceKm, runId, now);
    await this.bumpStreak(userId, now);

    if (opts.forge) {
      await this.repo.addSword(sword);
      await this.repo.recordCodex(userId, sword); // permanent course record (survives dismantle)
      const score = computeForgeScore(metrics, { repeatIndex: priorRepeats, isNewCourse: priorRepeats === 0 });
      await this.repo.recordCourseScore({ courseHash, userId, handle: user.handle, bestScore: score.total, bestCp: sword.cp, at: now });
    }

    return { run: rec, sword: opts.forge ? sword : undefined, metrics, rewards };
  }

  // ── Manual / treadmill forge (no GPS) ──────────────────────────────────────
  async manualRun(userId: string, distanceKm: number, paceSecPerKm: number, name?: string) {
    const user = await this.repo.getUser(userId);
    if (!user) throw new ServiceError('no_user', 404);
    if (!(distanceKm >= BALANCE.run.minDistanceKm)) throw new ServiceError('below_min_distance', 422);
    if (!(paceSecPerKm >= BALANCE.run.minPlausiblePaceSecPerKm)) throw new ServiceError('pace_too_fast', 422);

    const now = Date.now();
    const forgedToday = await this.repo.countForgesOnDay(userId, startOfDay(now));
    if (forgedToday >= BALANCE.run.maxForgesPerDay) throw new ServiceError('daily_forge_cap', 429);

    const courseHash = `treadmill:${Math.round(distanceKm)}`;
    const repeatIndex = await this.repo.countRunsForCourse(userId, courseHash);
    const runId = id('run');
    const swordId = id('sword');
    const { sword } = forgeManual(distanceKm, paceSecPerKm, {
      ownerId: userId, runId, swordId, createdAt: now, repeatIndex, seed: `${userId}:${now}`, name,
    });

    await this.repo.createRun({
      id: runId, userId, status: 'forged', courseHash, repeatIndex,
      distanceKm, durationSec: Math.round(distanceKm * paceSecPerKm), avgPaceSecPerKm: Math.round(paceSecPerKm),
      elevationGainM: 0, startedAt: now, createdAt: now,
    });
    await this.repo.addSword(sword);
    // Note: procedural blades are intentionally NOT recorded in the codex (kept for real GPS routes).

    // Ore reward, but no forge ticket (tickets stay a GPS incentive).
    const oreEarnedToday = await this.repo.earnedSince(userId, 'ore', startOfDay(now));
    const { granted: ore } = grantCapped(oreEarnedToday, runOreReward(distanceKm), BALANCE.economy.caps.oreDaily);
    if (ore > 0) await this.repo.applyCurrency({ userId, currency: 'ore', delta: ore, reason: 'run_reward', refId: runId, createdAt: now });
    await this.repo.addSeasonKm(userId, distanceKm);
    await this.bumpStreak(userId, now);

    return { sword, rewards: { ore, forgeTicket: 0 } };
  }

  private async grantRunRewards(userId: string, distanceKm: number, refId: string, now: number) {
    const wallet = await this.repo.getWallet(userId);
    const oreEarnedToday = await this.repo.earnedSince(userId, 'ore', startOfDay(now));
    const oreReward = runOreReward(distanceKm);
    const { granted: oreGranted } = grantCapped(oreEarnedToday, oreReward, BALANCE.economy.caps.oreDaily);
    if (oreGranted > 0) {
      await this.repo.applyCurrency({ userId, currency: 'ore', delta: oreGranted, reason: 'run_reward', refId, createdAt: now });
    }
    const ticket = runTicketReward(distanceKm);
    if (ticket > 0) {
      await this.repo.applyCurrency({ userId, currency: 'forgeTicket', delta: ticket, reason: 'run_reward', refId, createdAt: now });
    }
    // Season pass levels by kilometres run.
    await this.repo.addSeasonKm(userId, distanceKm);
    return { ore: oreGranted, oreCapped: oreGranted < oreReward, forgeTicket: ticket };
  }

  /** Advance the consecutive-day running streak. */
  private async bumpStreak(userId: string, now: number): Promise<number> {
    const user = await this.repo.getUser(userId);
    if (!user) return 0;
    const today = epochDay(now);
    const streak = nextStreak(user.streakDays ?? 0, user.lastRunDay ?? null, today);
    await this.repo.updateUser(userId, { streakDays: streak, lastRunDay: today });
    return streak;
  }

  // ── Inventory ──────────────────────────────────────────────────────────────
  async listSwords(userId: string) {
    return this.repo.listSwords(userId);
  }
  async getSword(userId: string, swordId: string) {
    const s = await this.mustOwn(userId, swordId);
    return s;
  }
  async equip(userId: string, swordId: string) {
    await this.mustOwn(userId, swordId);
    return this.repo.updateUser(userId, { equippedSwordId: swordId });
  }
  async dismantle(userId: string, swordIds: string[]) {
    const user = await this.repo.getUser(userId);
    let ore = 0;
    for (const sid of swordIds) {
      const s = await this.mustOwn(userId, sid);
      if (user?.equippedSwordId === sid) throw new ServiceError('cannot_dismantle_equipped', 409);
      ore += dismantleYield(s.rarity, s.plus);
      await this.repo.removeSword(sid);
    }
    const now = Date.now();
    const total = await this.repo.applyCurrency({ userId, currency: 'ore', delta: ore, reason: 'dismantle', createdAt: now });
    return { ore, walletOre: total, count: swordIds.length };
  }

  // ── Upgrade ────────────────────────────────────────────────────────────────
  async upgrade(userId: string, swordId: string, weeklyKm: number) {
    const s = await this.mustOwn(userId, swordId);
    const user = await this.repo.getUser(userId);
    const cost = upgradeCost(s.plus);
    const wallet = await this.repo.getWallet(userId);
    if (wallet.ore < cost) throw new ServiceError('insufficient_ore', 402);

    const chance = upgradeSuccessChance(s.plus, weeklyKm, user?.streakDays ?? 0);
    const rng = new Rng(id('upg'));
    const success = rng.chance(chance);
    const now = Date.now();
    await this.repo.applyCurrency({ userId, currency: 'ore', delta: -cost, reason: 'upgrade', refId: swordId, createdAt: now });

    let updated: Sword;
    if (success) {
      const stats = applyUpgrade(s.stats, s.plus);
      updated = await this.repo.updateSword(swordId, { stats, plus: s.plus + 1, cp: computeCP(stats) });
    } else {
      const newPlus = Math.max(0, s.plus - 1);
      updated = await this.repo.updateSword(swordId, { plus: newPlus });
    }
    return { success, chance, cost, sword: updated };
  }

  // ── Gacha ──────────────────────────────────────────────────────────────────
  async gacha(userId: string, count: 1 | 10) {
    const price = count === 10 ? BALANCE.gacha.ticketPer10Pull : BALANCE.gacha.ticketPerPull;
    const wallet = await this.repo.getWallet(userId);
    if (wallet.forgeTicket < price) throw new ServiceError('insufficient_tickets', 402);

    const now = Date.now();
    await this.repo.applyCurrency({ userId, currency: 'forgeTicket', delta: -price, reason: 'gacha', createdAt: now });

    const state = await this.repo.getGachaState(userId);
    const rng = new Rng(id('gacha'));
    const res = count === 10 ? pullMany(state, 10, rng) : (() => { const r = pull(state, rng); return { pulls: [r.pull], state: r.state }; })();
    await this.repo.setGachaState(userId, res.state);
    await this.repo.updateUser(userId, { gachaPity: res.state.pityCounter });

    // Grant materials/currency per pull.
    const grants = await this.grantGacha(userId, res.pulls, now);
    return { pulls: res.pulls, grants, pity: res.state.pityCounter, spentTickets: price };
  }

  private async grantGacha(userId: string, pulls: GachaPull[], now: number) {
    let ore = 0, engraveStone = 0, legendMaterial = 0;
    for (const p of pulls) {
      if (p.tier === 'upgradeOre') ore += 60;
      else if (p.tier === 'engraveStone') engraveStone += 1;
      else legendMaterial += 1;
    }
    if (ore > 0) await this.repo.applyCurrency({ userId, currency: 'ore', delta: ore, reason: 'gacha', createdAt: now });
    if (engraveStone > 0) {
      const earned = await this.repo.earnedSince(userId, 'engraveStone', startOfWeek(now));
      const { granted } = grantCapped(earned, engraveStone, BALANCE.economy.caps.engraveStoneWeekly);
      if (granted > 0) await this.repo.applyCurrency({ userId, currency: 'engraveStone', delta: granted, reason: 'gacha', createdAt: now });
    }
    if (legendMaterial > 0) await this.repo.addMaterial(userId, 'legend_material', legendMaterial);
    return { ore, engraveStone, legendMaterial };
  }

  // ── PvP ────────────────────────────────────────────────────────────────────
  async findMatch(userId: string, waitSec: number) {
    const user = await this.repo.getUser(userId);
    if (!user?.equippedSwordId) throw new ServiceError('no_equipped_sword', 409);
    const my = await this.repo.getSword(user.equippedSwordId);
    if (!my) throw new ServiceError('no_equipped_sword', 409);
    const { band, ghost } = matchBand(waitSec);
    const opponent = await this.repo.findGhostInBand(my.cp, band, userId);
    if (!opponent) return { found: false, band, ghostFallback: ghost };
    return { found: true, band, opponent: { id: opponent.id, handle: opponent.handle, cp: opponent.cp, sword: opponent.sword } };
  }

  async resolveMatch(userId: string, ghostId: string) {
    const user = await this.repo.getUser(userId);
    if (!user?.equippedSwordId) throw new ServiceError('no_equipped_sword', 409);
    const my = await this.repo.getSword(user.equippedSwordId);
    const ghost = await this.repo.getGhost(ghostId);
    if (!my) throw new ServiceError('no_equipped_sword', 409);
    if (!ghost) throw new ServiceError('no_ghost', 404);

    const matchId = id('match');
    const seed = matchId;
    const a: Combatant = { id: my.id, name: my.name, stats: effectiveStats(my.stats, my.engravings), cadence: 172, engravings: my.engravings };
    const b: Combatant = { id: ghost.id, name: ghost.sword.name, stats: effectiveStats(ghost.sword.stats, ghost.sword.engravings), cadence: ghost.sword.cadence, engravings: ghost.sword.engravings };
    const combat = simulateCombat(a, b, seed);
    const won = combat.winner === 'a';
    const delta = rpDelta(won, seed);
    const newRp = Math.max(0, user.rankRp + delta);
    await this.repo.updateUser(userId, { rankRp: newRp });

    const rec: MatchRecord = { id: matchId, aUserId: userId, aSwordId: my.id, bIsGhost: true, bGhostId: ghostId, seed, result: won ? 'win' : 'loss', rpDelta: delta, createdAt: Date.now() };
    await this.repo.recordMatch(rec);

    // Compact, self-contained replay payload — anyone can re-simulate it from these
    // inputs and get an identical fight (combat is deterministic from the seed).
    const replay = {
      seed,
      a: { name: a.name, stats: a.stats, cadence: a.cadence },
      b: { name: b.name, stats: b.stats, cadence: b.cadence },
    };
    return { matchId, seed, combat, won, rpDelta: delta, rankRp: newRp, opponent: { handle: ghost.handle, sword: ghost.sword }, replay };
  }

  async ranking() {
    const ghosts = await this.repo.listGhostsByCp();
    return ghosts.map((g, i) => ({ rank: i + 1, handle: g.handle, cp: g.cp, rankRp: g.rankRp }));
  }

  async courseBoard(courseHash: string) {
    const rows = await this.repo.courseLeaderboard(courseHash);
    return rows.map((r, i) => ({ rank: i + 1, userId: r.userId, handle: r.handle, bestScore: r.bestScore, bestCp: r.bestCp }));
  }

  async codex(userId: string) {
    const entries = await this.repo.listCodex(userId);
    return {
      entries,
      totals: {
        courses: entries.length,
        legend: entries.filter((e) => e.bestRarity === 'LEGEND').length,
      },
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  private async mustOwn(userId: string, swordId: string): Promise<Sword> {
    const s = await this.repo.getSword(swordId);
    if (!s || s.ownerId !== userId) throw new ServiceError('not_found_or_not_owned', 404);
    return s;
  }

  /** Dashboard payload. Lives here so the Fastify server and the Edge Function agree. */
  async me(userId: string) {
    const user = await this.repo.getUser(userId);
    const wallet = await this.wallet(userId);
    const swords = await this.listSwords(userId);
    const equipped = user?.equippedSwordId ? swords.find((s) => s.id === user.equippedSwordId) : undefined;
    return { user, wallet, swordCount: swords.length, equipped };
  }

  async wallet(userId: string): Promise<Record<Currency, number>> {
    return this.repo.getWallet(userId);
  }

  // ── Season ─────────────────────────────────────────────────────────────────
  async season(userId: string) {
    const pass = await this.repo.getSeasonPass(userId);
    const KM_PER_LEVEL = 12;
    const intoLevel = pass.kmProgress - pass.level * KM_PER_LEVEL;
    // Static season meta (single active season in this build).
    const rewards = Array.from({ length: 20 }, (_, i) => ({
      level: i + 1,
      free: i % 2 === 0 ? { kind: 'ore', amount: 120 } : { kind: 'forgeTicket', amount: 1 },
      premium: i % 5 === 4 ? { kind: 'skin', amount: 1 } : { kind: 'engraveStone', amount: 1 },
      claimed: i + 1 <= pass.level,
    }));
    return {
      season: { id: pass.seasonId, name: '시즌 3 · 강철의 계절', daysLeft: 24 },
      pass,
      progress: { intoLevel, perLevel: KM_PER_LEVEL, pct: Math.min(1, intoLevel / KM_PER_LEVEL) },
      rewards,
    };
  }

  // ── Profile ────────────────────────────────────────────────────────────────
  async profile(userId: string) {
    const user = await this.repo.getUser(userId);
    if (!user) throw new ServiceError('no_user', 404);
    const swords = await this.repo.listSwords(userId);
    const stats = await this.repo.runStats(userId);
    const byRarity = { N: 0, R: 0, SR: 0, LEGEND: 0 } as Record<string, number>;
    let bestCp = 0;
    for (const s of swords) {
      byRarity[s.rarity] = (byRarity[s.rarity] ?? 0) + 1;
      if (s.cp > bestCp) bestCp = s.cp;
    }
    return {
      user,
      totals: { swords: swords.length, byRarity, bestCp, totalKm: Math.round(stats.totalKm * 10) / 10, runCount: stats.runCount },
    };
  }

  // ── Reforge (cosmetic shape transform) ─────────────────────────────────────
  async reforge(userId: string, swordId: string, shape: Sword['shape']) {
    const s = await this.mustOwn(userId, swordId);
    // Transforms are cosmetic-only: preserve stats/plus/cp; only shape geometry changes.
    return this.repo.updateSword(swordId, { shape: { ...s.shape, ...shape } });
  }

  // ── Engravings ─────────────────────────────────────────────────────────────
  async applyEngraving(userId: string, swordId: string, slot: number, engravingId: string) {
    const sword = await this.mustOwn(userId, swordId);
    if (slot < 0 || slot >= sword.engravings.length) throw new ServiceError('invalid_slot', 400);
    const def = getEngraving(engravingId);
    if (!def) throw new ServiceError('unknown_engraving', 404);

    const wallet = await this.repo.getWallet(userId);
    if (wallet.engraveStone < def.cost) throw new ServiceError('insufficient_engrave_stones', 402);

    const now = Date.now();
    await this.repo.applyCurrency({ userId, currency: 'engraveStone', delta: -def.cost, reason: 'engrave', refId: swordId, createdAt: now });

    const engravings = [...sword.engravings];
    engravings[slot] = { id: def.id, name: def.name, rarity: def.rarity, mods: def.mods, trigger: def.trigger };
    const cp = computeCP(effectiveStats(sword.stats, engravings));
    const updated = await this.repo.updateSword(swordId, { engravings, cp });
    return { sword: updated, synergies: activeSynergies(engravings) };
  }

  // ── Fusion (합주조) ────────────────────────────────────────────────────────
  async fusion(userId: string, aId: string, bId: string, name?: string) {
    const user = await this.repo.getUser(userId);
    const a = await this.mustOwn(userId, aId);
    const b = await this.mustOwn(userId, bId);
    const v = validateFusion(a, b);
    if (!v.ok) throw new ServiceError('fusion_invalid:' + v.reason, 422);
    if (user?.equippedSwordId === aId || user?.equippedSwordId === bId) {
      throw new ServiceError('cannot_fuse_equipped', 409);
    }
    const newId = id('sword');
    const fused = fuseSwords(a, b, { id: newId, ownerId: userId, createdAt: Date.now(), name });
    await this.repo.addSword(fused);
    await this.repo.removeSword(aId);
    await this.repo.removeSword(bId);
    return { sword: fused, consumed: [aId, bId] };
  }
}
