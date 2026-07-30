import { describe, expect, it } from 'vitest';
import { forgeManual, generateProceduralTrack } from '../manual.js';
import { deriveMetrics } from '../conversion.js';
import { validateRun } from '../anticheat.js';

const ctx = (seed: number) => ({ ownerId: 'u', runId: 'r', swordId: 's', createdAt: 1, repeatIndex: 0, seed });

describe('generateProceduralTrack', () => {
  it('produces a track whose measured distance ≈ the requested distance', () => {
    const track = generateProceduralTrack(5, 330, 1);
    const m = deriveMetrics(track);
    expect(m.distanceKm).toBeGreaterThan(4);
    expect(m.distanceKm).toBeLessThan(6);
  });
  it('passes anti-cheat (plausible on-foot pace)', () => {
    expect(validateRun(generateProceduralTrack(5, 330, 2)).ok).toBe(true);
  });
  it('is deterministic for a seed', () => {
    const a = generateProceduralTrack(4, 300, 'x');
    const b = generateProceduralTrack(4, 300, 'x');
    expect(a.points).toEqual(b.points);
  });
});

describe('forgeManual', () => {
  it('never yields LEGEND (capped at SR) even for a strong input', () => {
    const { sword, score } = forgeManual(20, 240, ctx(3));
    expect(score.total).toBeLessThanOrEqual(89);
    expect(sword.rarity === 'LEGEND').toBe(false);
  });
  it('flags the blade procedural and not a true double edge', () => {
    const { sword } = forgeManual(6, 320, ctx(4));
    expect(sword.shape.procedural).toBe(true);
    expect(sword.shape.trueDoubleEdge).toBe(false);
  });
  it('uses a treadmill course bucket so repeats can decay', () => {
    const { sword } = forgeManual(5, 330, ctx(5));
    expect(sword.courseHash).toMatch(/^treadmill:/);
  });
  it('still produces real stats and CP', () => {
    const { sword } = forgeManual(8, 300, ctx(6));
    expect(sword.cp).toBeGreaterThan(0);
    expect(sword.stats.sharpness).toBeGreaterThan(0);
  });
});
