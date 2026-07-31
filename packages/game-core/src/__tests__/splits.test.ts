import { describe, expect, it } from 'vitest';
import { bestKmPace, computeSplits } from '../splits.js';
import type { GpsPoint } from '../types.js';

/** A straight eastward run at a constant pace, sampled every `stepM` metres. */
function straightRun(distanceKm: number, paceSecPerKm: number, stepM = 50, elePerStep = 0): GpsPoint[] {
  const lat = 37.5285;
  const lngPerM = 1 / (111_320 * Math.cos((lat * Math.PI) / 180));
  const n = Math.round((distanceKm * 1000) / stepM);
  const secPerStep = (paceSecPerKm * stepM) / 1000;
  const pts: GpsPoint[] = [];
  for (let i = 0; i <= n; i++) {
    pts.push({
      lat,
      lng: 126.9327 + i * stepM * lngPerM,
      ele: 20 + i * elePerStep,
      t: 1_700_000_000_000 + Math.round(i * secPerStep * 1000),
    });
  }
  return pts;
}

describe('computeSplits', () => {
  it('returns nothing for a track with fewer than two points', () => {
    expect(computeSplits([])).toEqual([]);
    expect(computeSplits([{ lat: 37.5, lng: 127, t: 0 }])).toEqual([]);
  });

  it('cuts a 3km run into three 1km splits at the given pace', () => {
    const splits = computeSplits(straightRun(3, 300));
    expect(splits).toHaveLength(3);
    expect(splits.map((s) => s.km)).toEqual([1, 2, 3]);
    for (const s of splits) {
      expect(s.distanceKm).toBeCloseTo(1, 2);
      expect(s.paceSecPerKm).toBeGreaterThan(295);
      expect(s.paceSecPerKm).toBeLessThan(305);
    }
  });

  it('keeps a partial tail but drops sub-100m noise', () => {
    expect(computeSplits(straightRun(2.5, 300))).toHaveLength(3);
    const withNoise = computeSplits(straightRun(2.02, 300));
    expect(withNoise).toHaveLength(2);
  });

  it('normalises the tail pace to a full kilometre so it stays comparable', () => {
    const splits = computeSplits(straightRun(1.5, 300));
    const tail = splits[1]!;
    expect(tail.distanceKm).toBeCloseTo(0.5, 2);
    expect(tail.durationSec).toBeGreaterThan(140);
    expect(tail.durationSec).toBeLessThan(160);
    expect(tail.paceSecPerKm).toBeGreaterThan(290); // ~300, not ~150
    expect(tail.paceSecPerKm).toBeLessThan(310);
  });

  it('splits correctly when one sample spans more than a kilometre', () => {
    // Two points 2.5 km apart: the sparse-sample path must still emit 1km cuts.
    const lat = 37.5285;
    const lngPerM = 1 / (111_320 * Math.cos((lat * Math.PI) / 180));
    const pts: GpsPoint[] = [
      { lat, lng: 126.9327, t: 0 },
      { lat, lng: 126.9327 + 2500 * lngPerM, t: 750_000 },
    ];
    const splits = computeSplits(pts);
    expect(splits.map((s) => s.km)).toEqual([1, 2, 3]);
    expect(splits[0]!.paceSecPerKm).toBeGreaterThan(295);
  });

  it('accumulates elevation gain per split', () => {
    const splits = computeSplits(straightRun(2, 300, 50, 1)); // +1m each 50m step
    expect(splits[0]!.elevationGainM).toBeGreaterThan(15);
  });

  it('bestKmPace looks at full kilometres only', () => {
    const splits = computeSplits(straightRun(1.4, 300));
    expect(splits).toHaveLength(2);
    expect(bestKmPace(splits)).toBe(splits[0]!.paceSecPerKm);
    expect(bestKmPace([])).toBeUndefined();
  });
});
