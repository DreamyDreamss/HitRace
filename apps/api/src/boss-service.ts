import {
  BALANCE,
  allocateRegions,
  bossElement,
  elementAdvantage,
  elementMatchup,
  awakenCost,
  bossMaxHp,
  bossName,
  bossSeed,
  computeDamage,
  distributeRewards,
  joinBoss,
  monthKey,
  nextCycleStartTier,
  previousCycleKey,
  weekKey,
} from '@hitrace/game-core';
import type { Element } from '@hitrace/game-core';
import type { BossRepo, BossRow, RegionRow } from './db/boss-repo.js';

export interface RunFacts {
  runId: string;
  userId: string;
  paceSecPerKm: number;
  elevationGainM: number;
  equippedCp?: number;
  equippedElement?: Element;
  streakDays?: number;
  at: number;
}

export interface RegionHit {
  region: RegionRow;
  distanceKm: number;
  damage: number;
  boss: { id: string; name: string; tier: number; hp: number; maxHp: number; element: Element };
  killed: boolean;
  manaStone: number;
  /** 'strong' | 'weak' | 'even' — so the app can say why the number looks like it does. */
  matchup: 'strong' | 'weak' | 'even';
}

export interface BossOutcome {
  hits: RegionHit[];
  manaStone: number;
}

const startOfDay = (ms: number) => {
  // KST: the daily cap should roll over when the runner's day does, not at UTC midnight.
  const kst = ms + 9 * 3600_000;
  return Math.floor(kst / 86_400_000) * 86_400_000 - 9 * 3600_000;
};

export const cycleKeyFor = (level: 'dong' | 'gu', at: number) =>
  level === 'dong' ? weekKey(at) : monthKey(at);

/**
 * Everything that happens to 동네 보스 when a run is filed.
 *
 * Called from inside `submitRun`. Running *is* the attack: there is no endpoint a client can call
 * to deal damage, and no number a client can send. If any of this fails the run itself must still
 * be saved — bosses are a layer on top of a running log, never a gate in front of it.
 */
export class BossService {
  constructor(private repo: BossRepo) {}

  async applyRun(facts: RunFacts): Promise<BossOutcome> {
    const hits: RegionHit[] = [];
    let manaStone = 0;
    const audit: Array<{ code: string; level: 'dong' | 'gu'; distanceKm: number; damage: number }> = [];

    for (const level of ['dong', 'gu'] as const) {
      // A run that crossed three 행정동 damages all three, and the 구 above them as well — one
      // run, two layers of content.
      const split = await this.repo.regionSplit(facts.runId, level);
      const credited = allocateRegions(split.map((s) => ({ code: s.code, distanceKm: s.distanceKm })));

      for (const share of credited) {
        const region = await this.repo.getRegion(share.code);
        if (!region) continue;

        const already = await this.repo.damagingRunsToday(facts.userId, region.code, startOfDay(facts.at));
        if (already >= BALANCE.boss.maxDamagingRunsPerDay) {
          audit.push({ code: region.code, level, distanceKm: share.distanceKm, damage: 0 });
          continue;
        }

        const boss = await this.ensureBoss(region, level, facts.at);
        const base = computeDamage({
          distanceKm: share.distanceKm,
          paceSecPerKm: facts.paceSecPerKm,
          elevationGainM: facts.elevationGainM,
          equippedCp: facts.equippedCp,
          streakDays: facts.streakDays,
        }).damage;
        // 속성 상성. Weather is not chosen, so this is a nudge worth about a 1.5x power gap —
        // enough that checking the forecast is a real decision, not enough to make it the game.
        const element = facts.equippedElement ?? 'none';
        const matchup = elementMatchup(element, boss.element);
        const damage = Math.round(base * elementAdvantage(element, boss.element));
        if (damage <= 0) continue;

        const joinHp = await this.joinHpIfNew(boss, facts.userId);
        const after = await this.repo.dealDamage(boss.id, facts.userId, damage, joinHp);

        let earned = 0;
        if (after.killed) {
          earned = await this.settleKill(boss, level, after.participants, facts.userId);
          manaStone += earned;
        }

        audit.push({ code: region.code, level, distanceKm: share.distanceKm, damage });
        hits.push({
          region,
          distanceKm: share.distanceKm,
          damage,
          boss: {
            id: boss.id, name: boss.name, tier: boss.tier,
            hp: after.hp, maxHp: after.maxHp, element: boss.element,
          },
          killed: after.killed,
          manaStone: earned,
          matchup,
        });
      }
    }

    await this.repo.recordRunRegions(facts.runId, audit);
    return { hits, manaStone };
  }

  /** The live boss for a region, spawning one the first time anybody runs there this cycle. */
  async ensureBoss(region: RegionRow, level: 'dong' | 'gu', at: number): Promise<BossRow> {
    const cycleKey = cycleKeyFor(level, at);
    const existing = await this.repo.liveBoss(region.code, cycleKey);
    if (existing) return existing;

    // Progress carries two ways.
    //
    // Within a cycle: each kill spawns the next tier up.
    // Across cycles: a neighbourhood that reached tier 5 last week starts this week at 4 —
    // progress is kept but re-earned, so a good week is worth repeating rather than banked
    // forever.
    //
    // Both are read at spawn time rather than written by a scheduled job. A weekly cron that
    // failed one Sunday would silently reset every 행정동 in the country to tier 1.
    const cleared = await this.repo.bestTierCleared(region.code, cycleKey);
    const tier = cleared > 0
      ? cleared + 1
      : nextCycleStartTier(await this.repo.bestTierCleared(region.code, previousCycleKey(level, at)));
    const seed = bossSeed(region.code, cycleKey);
    const maxHp = bossMaxHp(tier, 1);
    return this.repo.createBoss({
      regionCode: region.code,
      level,
      cycleKey,
      tier,
      name: bossName(region.name, tier, seed),
      seed,
      // Seeded, not taken from local weather: a Korean summer would otherwise hand every boss 炎
      // for two months and the counter would stop being a choice.
      element: bossElement(seed),
      maxHp,
      hp: maxHp,
      participants: 0,
    });
  }

  /**
   * A runner who has not hit this boss before raises its ceiling. Returns the new max HP, or null
   * when they are already a participant.
   */
  private async joinHpIfNew(boss: BossRow, userId: string): Promise<number | null> {
    const contributions = await this.repo.contributions(boss.id);
    if (contributions.some((c) => c.userId === userId)) return null;
    return joinBoss({
      maxHp: boss.maxHp,
      hp: boss.hp,
      tier: boss.tier,
      participants: boss.participants,
    }).maxHp;
  }

  /** Pays everyone who contributed and files the kill. Returns what the killer themselves earned. */
  private async settleKill(
    boss: BossRow,
    level: 'dong' | 'gu',
    participants: number,
    finalUserId: string,
  ): Promise<number> {
    const contributions = await this.repo.contributions(boss.id);
    const payouts = distributeRewards(
      contributions.map((c) => ({ userId: c.userId, damage: c.damage })),
      boss.tier,
      finalUserId,
    );

    let mine = 0;
    for (const p of payouts) {
      await this.repo.grantManaStone(p.userId, p.manaStone);
      if (p.userId === finalUserId) mine = p.manaStone;
    }

    await this.repo.recordKill({
      bossId: boss.id,
      regionCode: boss.regionCode,
      level,
      cycleKey: boss.cycleKey,
      tier: boss.tier,
      participants,
      topUserId: payouts.find((p) => p.topContributor)?.userId,
      finalUserId,
    });
    return mine;
  }

  /** What the boss screen shows: the live boss for a region plus who is on it. */
  async status(regionCode: string, level: 'dong' | 'gu', at: number) {
    const region = await this.repo.getRegion(regionCode);
    if (!region) return undefined;
    const boss = await this.ensureBoss(region, level, at);
    const contributions = await this.repo.contributions(boss.id);
    return {
      region: { code: region.code, name: region.name, sido: region.sido, level: region.level },
      boss: {
        id: boss.id,
        name: boss.name,
        tier: boss.tier,
        hp: boss.hp,
        maxHp: boss.maxHp,
        seed: boss.seed,
        element: boss.element,
        participants: boss.participants,
        cycleKey: boss.cycleKey,
      },
      // Opted-out runners still count toward the fight; they just are not named.
      leaderboard: contributions.map((c, i) => ({
        rank: i + 1,
        userId: c.userId,
        handle: c.anonymous ? '익명의 러너' : c.handle,
        damage: c.damage,
        runs: c.runs,
      })),
    };
  }

  /** 각성 — deterministic, so it either succeeds or tells you exactly what is missing. */
  async awaken(userId: string, swordId: string, ore: number) {
    const stage = await this.repo.getAwakening(swordId);
    const cost = awakenCost(stage);
    if (!cost) return { ok: false as const, reason: 'max_awakening' };
    const stones = await this.repo.getManaStone(userId);
    if (stones < cost.manaStone) return { ok: false as const, reason: 'need_mana_stone', cost };
    if (ore < cost.ore) return { ok: false as const, reason: 'need_ore', cost };
    await this.repo.grantManaStone(userId, -cost.manaStone);
    await this.repo.setAwakening(swordId, stage + 1);
    return { ok: true as const, stage: stage + 1, cost };
  }
}
