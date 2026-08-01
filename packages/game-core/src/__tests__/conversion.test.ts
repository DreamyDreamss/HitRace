import { describe, expect, it } from 'vitest';
import { deriveMetrics, deriveShape, deriveStats, computeForgeScore, rarityFromScore, computeCP } from '../conversion.js';
import { forgeSword } from '../forge.js';
import { synthRun } from './fixtures.js';


describe('missing sensors are absent, not zero', () => {
  it('a run without heart rate gets a neutral magic rather than the floor', () => {
    const withHr = synthRun({ distanceKm: 5 });
    const noHr = { ...withHr, heartRate: undefined };
    const a = deriveStats(deriveMetrics(withHr));
    const b = deriveStats(deriveMetrics(noHr));
    // Not the floor — a runner without a watch must not be handed the worst possible stat.
    expect(b.magic).toBeGreaterThan(0);
    expect(Math.abs(b.magic - a.magic)).toBeLessThan(a.magic); // same order of magnitude
  });
  it('a run without cadence gets a neutral durability', () => {
    const noCadence = { ...synthRun({ distanceKm: 5 }), cadence: undefined };
    expect(deriveStats(deriveMetrics(noCadence)).durability).toBeGreaterThan(0);
  });
});

describe('deriveMetrics', () => {
  it('measures distance and duration from the track', () => {
    const m = deriveMetrics(synthRun({ distanceKm: 5, paceSecPerKm: 330 }));
    expect(m.distanceKm).toBeGreaterThan(4.8);
    expect(m.distanceKm).toBeLessThan(5.2);
    expect(m.avgPaceSecPerKm).toBeGreaterThan(300);
    expect(m.avgPaceSecPerKm).toBeLessThan(360);
  });

  it('detects an out-and-back as a round trip', () => {
    const m = deriveMetrics(synthRun({ shape: 'out_and_back' }));
    expect(m.isRoundTrip).toBe(true);
    expect(m.isClosedLoop).toBe(false);
  });

  it('detects a loop as a closed loop', () => {
    const m = deriveMetrics(synthRun({ shape: 'loop', distanceKm: 4 }));
    expect(m.isRoundTrip).toBe(true);
    expect(m.isClosedLoop).toBe(true);
  });

  it('accumulates elevation gain', () => {
    const flat = deriveMetrics(synthRun({ elevationGainM: 0 }));
    const hilly = deriveMetrics(synthRun({ elevationGainM: 120 }));
    expect(hilly.elevationGainM).toBeGreaterThan(flat.elevationGainM);
  });
});

describe('deriveStats', () => {
  it('faster pace yields higher sharpness', () => {
    const fast = deriveStats(deriveMetrics(synthRun({ paceSecPerKm: 260 })));
    const slow = deriveStats(deriveMetrics(synthRun({ paceSecPerKm: 400 })));
    expect(fast.sharpness).toBeGreaterThan(slow.sharpness);
  });

  it('more elevation yields higher weight', () => {
    const hilly = deriveStats(deriveMetrics(synthRun({ elevationGainM: 120 })));
    const flat = deriveStats(deriveMetrics(synthRun({ elevationGainM: 5 })));
    expect(hilly.weight).toBeGreaterThan(flat.weight);
  });

  it('steady cadence yields higher durability than erratic cadence', () => {
    const steady = deriveStats(deriveMetrics(synthRun({ cadenceJitter: 1 })));
    const erratic = deriveStats(deriveMetrics(synthRun({ cadenceJitter: 40 })));
    expect(steady.durability).toBeGreaterThanOrEqual(erratic.durability);
  });

  it('keeps stats within configured bounds', () => {
    const s = deriveStats(deriveMetrics(synthRun({ paceSecPerKm: 100, elevationGainM: 9999 })));
    expect(s.sharpness).toBeLessThanOrEqual(900);
    expect(s.weight).toBeLessThanOrEqual(900);
  });
});

describe('forge score & rarity', () => {
  it('maps score to the right rarity band', () => {
    expect(rarityFromScore(0)).toBe('N');
    expect(rarityFromScore(39)).toBe('N');
    expect(rarityFromScore(40)).toBe('R');
    expect(rarityFromScore(69)).toBe('R');
    expect(rarityFromScore(70)).toBe('SR');
    expect(rarityFromScore(89)).toBe('SR');
    expect(rarityFromScore(90)).toBe('LEGEND');
  });

  it('a strong long run scores higher than a short slow one', () => {
    const strong = computeForgeScore(deriveMetrics(synthRun({ distanceKm: 8, paceSecPerKm: 300, elevationGainM: 100 })), { repeatIndex: 0, isNewCourse: true });
    const weak = computeForgeScore(deriveMetrics(synthRun({ distanceKm: 1.2, paceSecPerKm: 420, elevationGainM: 0 })), { repeatIndex: 0, isNewCourse: false });
    expect(strong.total).toBeGreaterThan(weak.total);
  });

  it('applies repeat decay from the 3rd run', () => {
    const m = deriveMetrics(synthRun({ distanceKm: 8, paceSecPerKm: 300 }));
    const first = computeForgeScore(m, { repeatIndex: 0, isNewCourse: true });
    const fourth = computeForgeScore(m, { repeatIndex: 3, isNewCourse: false });
    expect(fourth.total).toBeLessThan(first.total);
    expect(fourth.breakdown.repeatPenalty).toBeLessThan(0);
  });

  it('exploration bonus only on a new course', () => {
    const m = deriveMetrics(synthRun());
    const fresh = computeForgeScore(m, { repeatIndex: 0, isNewCourse: true });
    const repeat = computeForgeScore(m, { repeatIndex: 1, isNewCourse: false });
    expect(fresh.breakdown.explorationBonus).toBe(10);
    expect(repeat.breakdown.explorationBonus).toBe(0);
  });
});

describe('deriveShape', () => {
  it('out-and-back becomes a true double edge', () => {
    const t = synthRun({ shape: 'out_and_back' });
    const shape = deriveShape(t, deriveMetrics(t));
    expect(shape.style).toBe('double_edge');
    expect(shape.trueDoubleEdge).toBe(true);
  });

  it('length scales with distance', () => {
    const short = deriveShape(synthRun({ distanceKm: 2 }), deriveMetrics(synthRun({ distanceKm: 2 })));
    const long = deriveShape(synthRun({ distanceKm: 10 }), deriveMetrics(synthRun({ distanceKm: 10 })));
    expect(long.lengthScale).toBeGreaterThan(short.lengthScale);
  });

  it('produces a normalized centerline within the unit box', () => {
    const t = synthRun({ shape: 'wiggle' });
    const shape = deriveShape(t, deriveMetrics(t));
    for (const p of shape.centerline) {
      expect(p.x).toBeGreaterThanOrEqual(-0.001);
      expect(p.x).toBeLessThanOrEqual(1.001);
      expect(p.y).toBeGreaterThanOrEqual(-0.001);
      expect(p.y).toBeLessThanOrEqual(1.001);
    }
  });
});

describe('forgeSword orchestration', () => {
  it('produces a complete sword with CP and rarity-based engraving slots', () => {
    const t = synthRun({ distanceKm: 8, paceSecPerKm: 300, elevationGainM: 100, shape: 'wiggle' });
    const { sword } = forgeSword(t, { ownerId: 'u1', runId: 'r1', swordId: 's1', repeatIndex: 0, createdAt: 1 });
    expect(sword.cp).toBe(computeCP(sword.stats));
    expect(sword.cp).toBeGreaterThan(0);
    expect(sword.engravings.length).toBe(sword.rarity === 'LEGEND' ? 3 : sword.rarity === 'SR' ? 2 : sword.rarity === 'R' ? 1 : 0);
    expect(sword.courseHash).toBeTruthy();
  });

  it('is deterministic — same track and context yields identical stats', () => {
    const t = synthRun({ distanceKm: 6, shape: 'wiggle' });
    const a = forgeSword(t, { ownerId: 'u', runId: 'r', swordId: 's', repeatIndex: 0, createdAt: 1 });
    const b = forgeSword(t, { ownerId: 'u', runId: 'r', swordId: 's', repeatIndex: 0, createdAt: 1 });
    expect(a.sword.stats).toEqual(b.sword.stats);
    expect(a.sword.cp).toEqual(b.sword.cp);
  });
});
