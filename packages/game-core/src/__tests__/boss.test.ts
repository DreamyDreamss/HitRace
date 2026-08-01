import { describe, expect, it } from 'vitest';
import { bossMaxHp, joinBoss, nextCycleStartTier } from '../boss/hp.js';
import { computeDamage, allocateRegions, swordFactor, paceFactor } from '../boss/damage.js';
import { bossName, bossSeed, weekKey, monthKey } from '../boss/naming.js';
import { distributeRewards } from '../boss/rewards.js';
import { awakenCost, awakenBonus, applyAwakening, maxAwakenStage } from '../boss/awaken.js';
import { BALANCE } from '../config/balance.js';

/** The reference run the whole curve is calibrated against: 6 km, 5'30", CP 1600. */
const referenceRun = { distanceKm: 6, paceSecPerKm: 330, elevationGainM: 40, equippedCp: 1600 };

describe('boss HP', () => {
  it('a soloist can finish a tier-1 boss in about four runs', () => {
    // If this stops being true the content is dead for a new app: one runner per 행정동.
    const hp = bossMaxHp(1, 1);
    const perRun = computeDamage(referenceRun).damage;
    const runs = hp / perRun;
    expect(runs).toBeGreaterThan(2.5);
    expect(runs).toBeLessThan(6);
  });

  it('more participants means less work each, not more', () => {
    // The reason anyone would tell a neighbour about this.
    const each = (n: number) => bossMaxHp(1, n) / n;
    expect(each(5)).toBeLessThan(each(1));
    expect(each(20)).toBeLessThan(each(5));
  });

  it('each tier is meaningfully harder', () => {
    expect(bossMaxHp(2, 1)).toBeGreaterThan(bossMaxHp(1, 1) * 1.5);
    expect(bossMaxHp(5, 1)).toBeGreaterThan(bossMaxHp(1, 1) * 6);
  });

  it('joining mid-fight preserves the damage already dealt', () => {
    const before = { tier: 1, participants: 2, maxHp: bossMaxHp(1, 2), hp: 0 };
    before.hp = Math.round(before.maxHp * 0.4); // 60% already chewed off
    const after = joinBoss(before);
    expect(after.participants).toBe(3);
    expect(after.maxHp).toBeGreaterThan(before.maxHp);
    // Same proportion remaining — nobody's contribution was diluted.
    expect(after.hp / after.maxHp).toBeCloseTo(before.hp / before.maxHp, 3);
  });

  it('next cycle carries progress without banking it', () => {
    expect(nextCycleStartTier(5)).toBe(4);
    expect(nextCycleStartTier(1)).toBe(1);
    expect(nextCycleStartTier(0)).toBe(1);
  });
});

describe('damage', () => {
  it('distance leads', () => {
    const half = computeDamage({ ...referenceRun, distanceKm: 3 }).damage;
    expect(computeDamage(referenceRun).damage).toBeCloseTo(half * 2, -2);
  });

  it('a sharper sword hits harder, but sub-linearly', () => {
    const base = computeDamage(referenceRun).damage;
    const tripled = computeDamage({ ...referenceRun, equippedCp: 4800 }).damage;
    // Triple CP → clearly more, but nowhere near triple.
    expect(tripled).toBeGreaterThan(base * 2);
    expect(tripled).toBeLessThan(base * 2.7);
  });

  it('a veteran cannot out-damage a neighbourhood of ordinary runners', () => {
    const veteran = computeDamage({ ...referenceRun, equippedCp: 8000 }).damage;
    const ordinary = computeDamage({ ...referenceRun, equippedCp: 1200 }).damage;
    expect(veteran).toBeLessThan(ordinary * 8);
  });

  it('running without a sword still counts for something', () => {
    const none = computeDamage({ ...referenceRun, equippedCp: 0 }).damage;
    expect(none).toBeGreaterThan(0);
    expect(none).toBeLessThan(computeDamage(referenceRun).damage);
    expect(swordFactor(0)).toBe(BALANCE.boss.noSwordFactor);
  });

  it('pace pays but is capped at both ends', () => {
    expect(paceFactor(360)).toBeCloseTo(1, 5); // 6'00" is neutral
    expect(paceFactor(240)).toBeCloseTo(BALANCE.boss.paceFactorRange.max, 5);
    expect(paceFactor(150)).toBe(BALANCE.boss.paceFactorRange.max); // a sprint earns no more
    expect(paceFactor(900)).toBe(BALANCE.boss.paceFactorRange.min); // a walk still earns some
  });

  it('hills and streaks add, within limits', () => {
    const flat = computeDamage({ ...referenceRun, elevationGainM: 0 }).damage;
    const hilly = computeDamage({ ...referenceRun, elevationGainM: 300 }).damage;
    expect(hilly).toBeGreaterThan(flat);
    const capped = computeDamage({ ...referenceRun, elevationGainM: 5000 });
    expect(capped.elevationFactor).toBe(BALANCE.boss.elevationFactorCap);
    expect(computeDamage({ ...referenceRun, streakDays: 100 }).streakFactor)
      .toBe(1 + BALANCE.boss.streakBonusCap);
  });
});

describe('region allocation', () => {
  it('splits a run across the neighbourhoods it crossed', () => {
    const out = allocateRegions([
      { code: 'A', distanceKm: 3.4 },
      { code: 'B', distanceKm: 2.5 },
    ]);
    expect(out.map((r) => r.code)).toEqual(['A', 'B']);
  });

  it('drops a corner that was merely clipped', () => {
    // 0.3 km of a 6.2 km run is not a visit to that neighbourhood.
    const out = allocateRegions([
      { code: 'A', distanceKm: 3.4 },
      { code: 'B', distanceKm: 2.5 },
      { code: 'C', distanceKm: 0.3 },
    ]);
    expect(out.map((r) => r.code)).toEqual(['A', 'B']);
  });

  it('never credits more than the cap', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ code: `R${i}`, distanceKm: 1 }));
    expect(allocateRegions(many)).toHaveLength(BALANCE.boss.maxRegionsPerRun);
  });

  it('an empty or zero-distance run credits nothing', () => {
    expect(allocateRegions([])).toEqual([]);
    expect(allocateRegions([{ code: 'A', distanceKm: 0 }])).toEqual([]);
  });
});

describe('rewards', () => {
  const kill = [
    { userId: 'carry', damage: 60_000 },
    { userId: 'regular', damage: 30_000 },
    { userId: 'casual', damage: 10_000 },
  ];

  it('the top contributor earns most but does not take it all', () => {
    const payouts = distributeRewards(kill, 1, 'regular');
    const carry = payouts.find((p) => p.userId === 'carry')!;
    const casual = payouts.find((p) => p.userId === 'casual')!;
    expect(carry.manaStone).toBeGreaterThan(casual.manaStone);
    // Six times the damage must not mean six times the reward — showing up has to be worth it.
    expect(carry.manaStone).toBeLessThan(casual.manaStone * 4);
    expect(casual.manaStone).toBeGreaterThan(0);
  });

  it('flags the top contributor and the final blow', () => {
    const payouts = distributeRewards(kill, 1, 'regular');
    expect(payouts.find((p) => p.topContributor)!.userId).toBe('carry');
    expect(payouts.find((p) => p.finalBlow)!.userId).toBe('regular');
  });

  it('a token hit earns nothing', () => {
    const payouts = distributeRewards(
      [{ userId: 'real', damage: 100_000 }, { userId: 'tourist', damage: 50 }],
      1,
    );
    expect(payouts.map((p) => p.userId)).toEqual(['real']);
  });

  it('bigger bosses drop more', () => {
    const one = distributeRewards(kill, 1).reduce((s, p) => s + p.manaStone, 0);
    const five = distributeRewards(kill, 5).reduce((s, p) => s + p.manaStone, 0);
    expect(five).toBeGreaterThan(one * 2);
  });

  it('a boss nobody touched pays nobody', () => {
    expect(distributeRewards([], 1)).toEqual([]);
  });
});

describe('naming', () => {
  it('is deterministic for a region and tier', () => {
    const seed = bossSeed('1114066', '2026-W31');
    expect(bossName('서교동', 1, seed)).toBe(bossName('서교동', 1, seed));
  });

  it('different neighbourhoods get different bosses', () => {
    const seedA = bossSeed('1114066', '2026-W31');
    const seedB = bossSeed('1114067', '2026-W31');
    expect(bossName('서교동', 1, seedA)).not.toBe(bossName('연남동', 1, seedB));
  });

  it('higher tiers read heavier', () => {
    const seed = bossSeed('1114066', '2026-W31');
    expect(bossName('서교동', 1, seed)).toContain('서교동의 ');
    expect(bossName('서교동', 6, seed).length).toBeGreaterThan(bossName('서교동', 1, seed).length);
  });

  it('cycle keys bucket by KST week and month', () => {
    const kst = Date.UTC(2026, 7, 1, 3, 0, 0); // 2026-08-01 12:00 KST
    expect(monthKey(kst)).toBe('2026-08');
    expect(weekKey(kst)).toMatch(/^2026-W\d\d$/);
    // Just before KST midnight the day must not have rolled over yet.
    expect(monthKey(Date.UTC(2026, 6, 31, 14, 0, 0))).toBe('2026-07');
    expect(monthKey(Date.UTC(2026, 6, 31, 16, 0, 0))).toBe('2026-08'); // 01:00 KST Aug 1
  });
});

describe('awakening', () => {
  it('costs rise and stop at the ceiling', () => {
    expect(awakenCost(0)!.manaStone).toBeLessThan(awakenCost(4)!.manaStone);
    expect(awakenCost(maxAwakenStage())).toBeNull();
  });

  it('raises every stat and never lowers one', () => {
    const stats = { sharpness: 700, weight: 450, durability: 480, magic: 470 };
    const awakened = applyAwakening(stats, 3);
    expect(awakened.sharpness).toBeGreaterThan(stats.sharpness);
    expect(awakened.magic).toBeGreaterThan(stats.magic);
    expect(applyAwakening(stats, 0)).toEqual(stats);
  });

  it('bonus grows with the stage', () => {
    expect(awakenBonus(0)).toBe(0);
    expect(awakenBonus(5)).toBeGreaterThan(awakenBonus(1));
    expect(awakenBonus(99)).toBe(awakenBonus(maxAwakenStage()));
  });
});
