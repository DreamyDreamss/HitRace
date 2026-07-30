import { describe, expect, it } from 'vitest';
import { validateRun } from '../anticheat.js';
import { upgradeCost, upgradeSuccessChance, streakBonus, nextStreak, applyUpgrade, dismantleYield, runOreReward, runTicketReward, grantCapped } from '../economy.js';
import { pull, pullMany } from '../gacha.js';
import { simulateCombat } from '../combat.js';
import { matchBand, inBand, rpDelta, tierFromRp, seasonSoftReset } from '../matching.js';
import { Rng } from '../rng.js';
import type { Combatant } from '../types.js';
import { synthRun } from './fixtures.js';

describe('anti-cheat validateRun', () => {
  it('passes a normal run', () => {
    expect(validateRun(synthRun({ distanceKm: 5 })).ok).toBe(true);
  });
  it('rejects a too-short run', () => {
    const v = validateRun(synthRun({ distanceKm: 0.5 }));
    expect(v.ok).toBe(false);
    expect(v.reasons).toContain('below_min_distance');
  });
  it('rejects an implausibly fast run', () => {
    const v = validateRun(synthRun({ distanceKm: 5, paceSecPerKm: 120 }));
    expect(v.ok).toBe(false);
    expect(v.reasons).toContain('pace_too_fast');
  });
  it('flags a GPS teleport', () => {
    const v = validateRun(synthRun({ distanceKm: 5, teleportAt: 0.5 }));
    expect(v.ok).toBe(false);
    expect(v.reasons).toContain('gps_jump');
  });
  it('carries the repeat index through', () => {
    expect(validateRun(synthRun(), { priorRepeats: 2 }).repeatIndex).toBe(2);
  });
});

describe('economy', () => {
  it('upgrade cost grows exponentially', () => {
    expect(upgradeCost(0)).toBe(120);
    expect(upgradeCost(1)).toBeGreaterThan(upgradeCost(0));
    expect(upgradeCost(5)).toBeGreaterThan(upgradeCost(4));
  });
  it('success chance falls with plus and rises with weekly km, within bounds', () => {
    expect(upgradeSuccessChance(0, 0)).toBeGreaterThan(upgradeSuccessChance(8, 0));
    expect(upgradeSuccessChance(3, 30)).toBeGreaterThan(upgradeSuccessChance(3, 0));
    expect(upgradeSuccessChance(20, 0)).toBeGreaterThanOrEqual(0.25);
  });
  it('a running streak raises upgrade success, capped', () => {
    expect(upgradeSuccessChance(3, 0, 5)).toBeGreaterThan(upgradeSuccessChance(3, 0, 0));
    expect(streakBonus(100)).toBeLessThanOrEqual(0.07);
    expect(streakBonus(3)).toBeCloseTo(0.03, 5);
  });
  it('nextStreak increments consecutive days, holds same-day, resets on a gap', () => {
    expect(nextStreak(0, null, 100)).toBe(1); // first ever
    expect(nextStreak(3, 100, 100)).toBe(3); // same day
    expect(nextStreak(3, 100, 101)).toBe(4); // consecutive
    expect(nextStreak(3, 100, 105)).toBe(1); // gap → reset
  });
  it('applies upgrade stat gains', () => {
    const before = { sharpness: 100, weight: 100, durability: 100, magic: 100 };
    const after = applyUpgrade(before, 0);
    expect(after.sharpness).toBeGreaterThan(before.sharpness);
  });
  it('dismantle yield scales by rarity', () => {
    expect(dismantleYield('LEGEND')).toBeGreaterThan(dismantleYield('N'));
    expect(dismantleYield('SR', 5)).toBeGreaterThan(dismantleYield('SR', 0));
  });
  it('run rewards: ore per km and tickets at 3km', () => {
    expect(runOreReward(5)).toBe(40);
    expect(runTicketReward(2)).toBe(0);
    expect(runTicketReward(3)).toBe(1);
  });
  it('grantCapped respects the cap', () => {
    expect(grantCapped(590, 50, 600)).toEqual({ granted: 10, total: 600 });
    expect(grantCapped(600, 50, 600)).toEqual({ granted: 0, total: 600 });
  });
});

describe('gacha', () => {
  it('never exceeds pity and guarantees a legend at the ceiling', () => {
    let state = { pityCounter: 89 };
    const r = pull(state, new Rng(1));
    expect(r.pull.tier).toBe('legendMaterial');
    expect(r.pull.pity).toBe(true);
    expect(r.state.pityCounter).toBe(0);
  });
  it('resets pity when a legend is pulled naturally', () => {
    // Force an early legend by scanning seeds.
    let found = false;
    for (let s = 0; s < 500 && !found; s++) {
      const r = pull({ pityCounter: 0 }, new Rng(s));
      if (r.pull.tier === 'legendMaterial') {
        expect(r.state.pityCounter).toBe(0);
        found = true;
      }
    }
    expect(found).toBe(true);
  });
  it('10-pull advances pity deterministically', () => {
    const a = pullMany({ pityCounter: 0 }, 10, new Rng('match'));
    const b = pullMany({ pityCounter: 0 }, 10, new Rng('match'));
    expect(a.pulls.map((p) => p.tier)).toEqual(b.pulls.map((p) => p.tier));
    expect(a.state.pityCounter).toBe(10); // no natural legend in this seed likely; counter advanced
  });
});

describe('combat', () => {
  const mk = (name: string, s: Partial<Combatant['stats']>, cadence: number): Combatant => ({
    id: name,
    name,
    cadence,
    stats: { sharpness: 500, weight: 400, durability: 500, magic: 400, ...s },
    engravings: [],
  });

  it('is deterministic for a given seed', () => {
    const a = mk('A', { sharpness: 700 }, 180);
    const b = mk('B', { sharpness: 500 }, 170);
    const r1 = simulateCombat(a, b, 'seed-1');
    const r2 = simulateCombat(a, b, 'seed-1');
    expect(r1.winner).toBe(r2.winner);
    expect(r1.log.length).toBe(r2.log.length);
  });

  it('a much stronger sword reliably wins', () => {
    const strong = mk('S', { sharpness: 900, weight: 700 }, 190);
    const weak = mk('W', { sharpness: 300, durability: 200 }, 150);
    expect(simulateCombat(strong, weak, 'x').winner).toBe('a');
  });

  it('produces an event log with HP tracking', () => {
    const r = simulateCombat(mk('A', {}, 180), mk('B', {}, 170), 's');
    expect(r.log.length).toBeGreaterThan(0);
    expect(r.log[0]!.aHp).toBeLessThanOrEqual(3000);
  });

  it('higher cadence strikes first', () => {
    const r = simulateCombat(mk('A', {}, 200), mk('B', {}, 100), 's');
    expect(r.log[0]!.actor).toBe('a');
  });
});

describe('matchmaking', () => {
  it('band widens with wait then falls back to ghost', () => {
    expect(matchBand(0).band).toBe(0.08);
    expect(matchBand(31).band).toBe(0.15);
    expect(matchBand(61).ghost).toBe(true);
  });
  it('inBand respects the tolerance', () => {
    expect(inBand(1000, 1050, 0)).toBe(true);
    expect(inBand(1000, 1200, 0)).toBe(false);
    expect(inBand(1000, 1120, 31)).toBe(true);
  });
  it('rp delta is positive on win, negative on loss, and reproducible', () => {
    expect(rpDelta(true, 'm1')).toBeGreaterThan(0);
    expect(rpDelta(false, 'm1')).toBeLessThan(0);
    expect(rpDelta(true, 'm1')).toBe(rpDelta(true, 'm1'));
  });
  it('tier ladder maps rp to a label', () => {
    expect(tierFromRp(0).tier).toBe('Iron');
    expect(tierFromRp(100000).tier).toBe('Legend');
    expect(tierFromRp(500).label).toMatch(/^[A-Z]\d$/);
  });
  it('season soft reset drops but never below zero', () => {
    expect(seasonSoftReset(50)).toBe(0);
    expect(seasonSoftReset(2000)).toBeLessThan(2000);
  });
});
