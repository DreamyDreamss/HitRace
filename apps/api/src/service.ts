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
  computeSplits,
  bestKmPace,
  decimate,
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
  sanitizeTrack,
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
const DEFAULT_WEEKLY_GOAL_KM = 20;

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function startOfMonth(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.getTime();
}
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
/** Distance-weighted average pace — the only average that matches a runner's expectation. */
function avgPace(runs: Array<{ distanceKm: number; durationSec: number }>): number {
  const km = runs.reduce((a, r) => a + r.distanceKm, 0);
  const sec = runs.reduce((a, r) => a + r.durationSec, 0);
  return km > 0 ? Math.round(sec / km) : 0;
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

    // A retry of an upload that actually succeeded must not forge a second sword or burn a
    // second slot of the daily cap. The track is byte-identical on retry, so its first sample's
    // timestamp identifies the run: if we already have it, hand back what we stored.
    const startedAt = track.points?.[0]?.t;
    if (startedAt != null) {
      const existing = await this.repo.findRunByStart(userId, startedAt);
      if (existing) {
        const sword = existing.swordId ? await this.repo.getSword(existing.swordId) : undefined;
        return {
          run: existing,
          sword,
          metrics: undefined,
          rewards: { ore: 0, forgeTicket: 0 },
          records: undefined,
          weeklyGoal: undefined,
          duplicate: true as const,
        };
      }
    }

    // The fingerprint is taken on the cleaned track so one bad fix can't move a familiar course
    // to a new one. Validation gets the **raw** track — it has to see the outliers to judge
    // whether they are sensor noise or a fabricated route — and hands back the cleaned version
    // that everything downstream scores and stores.
    const courseHash = fingerprint(sanitizeTrack(track).track);
    const priorRepeats = await this.repo.countRunsForCourse(userId, courseHash);
    const validation = validateRun(track, { priorRepeats });
    const clean = validation.track;

    const now = Date.now();
    const runId = id('run');

    // Two different kinds of "no".
    //
    // "Too short" is not a data problem — a 300 m walk is something the person actually did, and
    // refusing to even file it (which is what used to happen: 기록만 저장 failed too) throws away
    // a real record to enforce a *forge* rule. Short runs are recorded, earn nothing, and forge
    // nothing. Everything else in `reasons` means the track can't be trusted at all, and that is
    // still a rejection.
    const belowThreshold = validation.reasons.filter(
      (r) => r === 'below_min_distance' || r === 'below_min_duration',
    );
    const untrustworthy = validation.reasons.filter(
      (r) => r !== 'below_min_distance' && r !== 'below_min_duration',
    );

    if (untrustworthy.length > 0) {
      const rec: RunRecord = {
        id: runId, userId, status: 'rejected', courseHash, repeatIndex: priorRepeats,
        distanceKm: 0, durationSec: 0, avgPaceSecPerKm: 0, elevationGainM: 0,
        rejectReasons: validation.reasons, startedAt: clean.points[0]?.t ?? now, createdAt: now,
      };
      await this.repo.createRun(rec);
      throw new ServiceError('run_rejected:' + validation.reasons.join(','), 422);
    }

    // A sword needs a real run behind it; the record does not.
    const tooShortToForge = belowThreshold.length > 0;
    if (opts.forge && tooShortToForge) {
      throw new ServiceError('run_rejected:' + belowThreshold.join(','), 422);
    }

    // Daily forge cap.
    if (opts.forge) {
      const forgedToday = await this.repo.countForgesOnDay(userId, startOfDay(now));
      if (forgedToday >= BALANCE.run.maxForgesPerDay) {
        throw new ServiceError('daily_forge_cap', 429);
      }
    }

    const swordId = id('sword');
    const outcome = forgeSword(clean, {
      ownerId: userId, runId, swordId, repeatIndex: priorRepeats, createdAt: now, name: opts.name,
    });
    const { sword, metrics } = outcome;

    const rec: RunRecord = {
      id: runId, userId, status: opts.forge ? 'forged' : 'recorded', courseHash, repeatIndex: priorRepeats,
      distanceKm: metrics.distanceKm, durationSec: Math.round(metrics.durationSec), avgPaceSecPerKm: Math.round(metrics.avgPaceSecPerKm),
      elevationGainM: Math.round(metrics.elevationGainM), forgeScore: undefined,
      startedAt: clean.points[0]!.t, createdAt: now,
      // Keep a downsampled polyline: enough to draw the route and compute splits,
      // small enough that a year of running stays cheap to store.
      route: decimate(clean.points, 300),
      swordId: opts.forge ? swordId : undefined,
    };
    // Personal bests, rewards and the streak all belong to runs that met the bar. A short walk
    // is filed as history and nothing more — otherwise a 300 m stroll could set a pace record or
    // farm ore, which is the abuse the minimums exist to stop.
    const records = tooShortToForge ? undefined : await this.detectRecords(userId, rec);
    await this.repo.createRun(rec);

    const rewards = tooShortToForge
      ? { ore: 0, forgeTicket: 0 }
      : await this.grantRunRewards(userId, metrics.distanceKm, runId, now);
    if (!tooShortToForge) await this.bumpStreak(userId, now);

    if (opts.forge) {
      await this.repo.addSword(sword);
      await this.repo.recordCodex(userId, sword); // permanent course record (survives dismantle)
      const score = computeForgeScore(metrics, { repeatIndex: priorRepeats, isNewCourse: priorRepeats === 0 });
      await this.repo.recordCourseScore({ courseHash, userId, handle: user.handle, bestScore: score.total, bestCp: sword.cp, at: now });
    }

    const weeklyGoal = tooShortToForge
      ? undefined
      : await this.grantWeeklyGoalBonus(userId, metrics.distanceKm, now);

    return {
      run: rec,
      sword: opts.forge ? sword : undefined,
      metrics,
      rewards,
      records,
      weeklyGoal,
      // Told plainly so the client can say "저장했지만 보상은 없습니다" instead of implying a payout.
      belowThreshold: tooShortToForge ? belowThreshold : undefined,
    };
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

    const rec = {
      id: runId, userId, status: 'forged' as const, courseHash, repeatIndex,
      distanceKm, durationSec: Math.round(distanceKm * paceSecPerKm), avgPaceSecPerKm: Math.round(paceSecPerKm),
      elevationGainM: 0, startedAt: now, createdAt: now, swordId,
    };
    const records = await this.detectRecords(userId, rec);
    await this.repo.createRun(rec);
    await this.repo.addSword(sword);
    // Note: procedural blades are intentionally NOT recorded in the codex (kept for real GPS routes).

    // Ore reward, but no forge ticket (tickets stay a GPS incentive).
    const oreEarnedToday = await this.repo.earnedSince(userId, 'ore', startOfDay(now));
    const { granted: ore } = grantCapped(oreEarnedToday, runOreReward(distanceKm), BALANCE.economy.caps.oreDaily);
    if (ore > 0) await this.repo.applyCurrency({ userId, currency: 'ore', delta: ore, reason: 'run_reward', refId: runId, createdAt: now });
    await this.repo.addSeasonKm(userId, distanceKm);
    await this.bumpStreak(userId, now);

    const weeklyGoal = await this.grantWeeklyGoalBonus(userId, distanceKm, now);

    return { sword, rewards: { ore, forgeTicket: 0 }, records, weeklyGoal };
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

  // ── Running log ────────────────────────────────────────────────────────────
  // The game side (swords) is only half the app; these are the numbers a runner
  // actually comes back for.

  /** Recent runs, newest first. Summaries only — no route payload. */
  async listRuns(userId: string, limit = 50) {
    const runs = await this.repo.listRuns(userId, Math.min(200, Math.max(1, limit)));
    return runs.map((r) => ({
      id: r.id,
      status: r.status,
      distanceKm: r.distanceKm,
      durationSec: r.durationSec,
      avgPaceSecPerKm: r.avgPaceSecPerKm,
      elevationGainM: r.elevationGainM,
      courseHash: r.courseHash,
      swordId: r.swordId,
      startedAt: r.startedAt,
      createdAt: r.createdAt,
    }));
  }

  /** One run with its route and per-kilometre splits, plus the sword it forged. */
  async runDetail(userId: string, runId: string) {
    const run = await this.repo.getRun(userId, runId);
    if (!run) throw new ServiceError('run_not_found', 404);
    const route = run.route ?? [];
    const splits = computeSplits(route);
    const sword = run.swordId ? await this.repo.getSword(run.swordId) : undefined;

    // Same-course history: "3rd time here, and your fastest" is the comparison that makes
    // a runner want to repeat a route.
    const sameCourse = (await this.repo.listRuns(userId, 200))
      .filter((r) => r.courseHash === run.courseHash && r.distanceKm >= 1 && r.avgPaceSecPerKm > 0);
    const coursePaces = sameCourse.map((r) => r.avgPaceSecPerKm);
    const courseBestPace = coursePaces.length ? Math.min(...coursePaces) : undefined;
    const previous = sameCourse
      .filter((r) => r.id !== run.id && r.startedAt < run.startedAt)
      .sort((a, b) => b.startedAt - a.startedAt)[0];

    return {
      course: {
        totalRuns: sameCourse.length,
        // Attempt number of *this* run on this course, oldest = 1.
        attempt: sameCourse.filter((r) => r.startedAt <= run.startedAt).length,
        bestPaceSecPerKm: courseBestPace,
        isCourseBest: courseBestPace != null && run.avgPaceSecPerKm <= courseBestPace,
        previousPaceSecPerKm: previous?.avgPaceSecPerKm,
        deltaVsPreviousSec: previous ? run.avgPaceSecPerKm - previous.avgPaceSecPerKm : undefined,
      },
      run: {
        id: run.id, status: run.status, distanceKm: run.distanceKm, durationSec: run.durationSec,
        avgPaceSecPerKm: run.avgPaceSecPerKm, elevationGainM: run.elevationGainM,
        courseHash: run.courseHash, startedAt: run.startedAt, createdAt: run.createdAt,
      },
      route,
      splits,
      bestKmPaceSecPerKm: bestKmPace(splits),
      sword: sword && sword.ownerId === userId ? sword : undefined,
    };
  }

  /**
   * The running dashboard: this week vs last, a 12-week trend, and personal bests.
   * Computed from the run log rather than stored counters so it can never drift.
   */
  async runningStats(userId: string, now = Date.now()) {
    const runs = await this.repo.listRuns(userId, 200);
    const weekStart = startOfWeek(now);
    const lastWeekStart = weekStart - 7 * 86_400_000;
    const monthStart = startOfMonth(now);

    const sum = (rs: typeof runs) => ({
      runs: rs.length,
      distanceKm: round1(rs.reduce((a, r) => a + r.distanceKm, 0)),
      durationSec: rs.reduce((a, r) => a + r.durationSec, 0),
    });
    const inRange = (from: number, to = Infinity) =>
      runs.filter((r) => r.startedAt >= from && r.startedAt < to);

    const thisWeek = sum(inRange(weekStart));
    const lastWeek = sum(inRange(lastWeekStart, weekStart));

    // Oldest → newest so a chart can render it left to right.
    const weekly = Array.from({ length: 12 }, (_, i) => {
      const from = weekStart - (11 - i) * 7 * 86_400_000;
      const s = sum(inRange(from, from + 7 * 86_400_000));
      return { weekStart: from, distanceKm: s.distanceKm, runs: s.runs };
    });

    const paced = runs.filter((r) => r.distanceKm >= 1 && r.avgPaceSecPerKm > 0);
    const user = await this.repo.getUser(userId);
    const all = sum(runs);
    const goalKm = user?.weeklyGoalKm ?? DEFAULT_WEEKLY_GOAL_KM;

    return {
      goal: {
        weeklyGoalKm: goalKm,
        // Days left counts today, so "1" on Sunday reads correctly.
        daysLeftInWeek: 7 - Math.floor((now - weekStart) / 86_400_000),
        remainingKm: round1(Math.max(0, goalKm - thisWeek.distanceKm)),
        progress: goalKm > 0 ? Math.min(1, round2(thisWeek.distanceKm / goalKm)) : 0,
        achieved: goalKm > 0 && thisWeek.distanceKm >= goalKm,
      },
      thisWeek: { ...thisWeek, avgPaceSecPerKm: avgPace(inRange(weekStart)) },
      lastWeek,
      thisMonth: sum(inRange(monthStart)),
      allTime: { ...all, avgPaceSecPerKm: avgPace(runs) },
      weekly,
      personalBests: {
        longestKm: runs.length ? round1(Math.max(...runs.map((r) => r.distanceKm))) : 0,
        longestDurationSec: runs.length ? Math.max(...runs.map((r) => r.durationSec)) : 0,
        fastestPaceSecPerKm: paced.length ? Math.min(...paced.map((r) => r.avgPaceSecPerKm)) : 0,
        biggestClimbM: runs.length ? Math.max(...runs.map((r) => r.elevationGainM)) : 0,
        longestStreakDays: user?.streakDays ?? 0,
      },
    };
  }

  /**
   * Bonus for crossing the weekly goal, granted by the run that crosses it.
   *
   * No "already claimed this week" flag needed: only one run can take the total from
   * below the goal to at or above it, so the crossing itself is the idempotency key.
   */
  private async grantWeeklyGoalBonus(userId: string, runKm: number, now: number) {
    const user = await this.repo.getUser(userId);
    const goal = user?.weeklyGoalKm ?? DEFAULT_WEEKLY_GOAL_KM;
    if (goal <= 0) return { achieved: false as const };

    const weekStart = startOfWeek(now);
    // listRuns already contains the run we just stored.
    const weekKm = (await this.repo.listRuns(userId, 200))
      .filter((r) => r.startedAt >= weekStart)
      .reduce((a, r) => a + r.distanceKm, 0);
    const before = weekKm - runKm;
    if (!(before < goal && weekKm >= goal)) return { achieved: false as const };

    const ticket = BALANCE.economy.ticket.weekly3RunsBonus > 0 ? 1 : 0;
    const oreEarned = await this.repo.earnedSince(userId, 'ore', startOfDay(now));
    const { granted: ore } = grantCapped(oreEarned, 150, BALANCE.economy.caps.oreDaily);
    if (ore > 0) {
      await this.repo.applyCurrency({ userId, currency: 'ore', delta: ore, reason: 'weekly_goal', createdAt: now });
    }
    if (ticket > 0) {
      await this.repo.applyCurrency({ userId, currency: 'forgeTicket', delta: ticket, reason: 'weekly_goal', createdAt: now });
    }
    return { achieved: true as const, goalKm: goal, weekKm: round1(weekKm), bonus: { ore, forgeTicket: ticket } };
  }

  /** Change the weekly distance target. 0 turns the goal off. */
  async setWeeklyGoal(userId: string, km: number) {
    if (!Number.isFinite(km) || km < 0 || km > 500) throw new ServiceError('invalid_goal', 422);
    const user = await this.repo.updateUser(userId, { weeklyGoalKm: Math.round(km) });
    return { weeklyGoalKm: user.weeklyGoalKm ?? DEFAULT_WEEKLY_GOAL_KM };
  }

  /**
   * Which personal bests this run just beat. Called *before* the run is stored, so the
   * comparison is against history only — otherwise every run would tie with itself.
   */
  private async detectRecords(
    userId: string,
    run: { distanceKm: number; durationSec: number; avgPaceSecPerKm: number; elevationGainM: number },
  ) {
    const prior = await this.repo.listRuns(userId, 200);
    const best = <T>(pick: (r: (typeof prior)[number]) => T, cmp: (a: T, b: T) => boolean, init: T) =>
      prior.reduce((acc, r) => (cmp(pick(r), acc) ? pick(r) : acc), init);

    const longest = best((r) => r.distanceKm, (a, b) => a > b, 0);
    const longestTime = best((r) => r.durationSec, (a, b) => a > b, 0);
    const climb = best((r) => r.elevationGainM, (a, b) => a > b, 0);
    const paced = prior.filter((r) => r.distanceKm >= 1 && r.avgPaceSecPerKm > 0);
    const fastest = paced.length ? Math.min(...paced.map((r) => r.avgPaceSecPerKm)) : Infinity;

    return {
      firstRun: prior.length === 0,
      longestDistance: run.distanceKm > longest,
      longestDuration: run.durationSec > longestTime,
      // A pace record only counts over a kilometre — a 300m dash is not a PB.
      fastestPace: run.distanceKm >= 1 && run.avgPaceSecPerKm > 0 && run.avgPaceSecPerKm < fastest,
      biggestClimb: run.elevationGainM > 0 && run.elevationGainM > climb,
    };
  }

  /** Dashboard payload. Lives here so the Fastify server and the Edge Function agree. */
  async me(userId: string) {
    const user = await this.repo.getUser(userId);
    const wallet = await this.wallet(userId);
    const swords = await this.listSwords(userId);
    const equipped = user?.equippedSwordId ? swords.find((s) => s.id === user.equippedSwordId) : undefined;
    // Today's forge budget, so the client can say "2/2 used" instead of letting the user
    // tap a button that will fail.
    const forgedToday = await this.repo.countForgesOnDay(userId, startOfDay(Date.now()));
    return {
      user,
      wallet,
      swordCount: swords.length,
      equipped,
      forge: { today: forgedToday, max: BALANCE.run.maxForgesPerDay },
    };
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
