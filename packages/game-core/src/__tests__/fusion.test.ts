import { describe, expect, it } from 'vitest';
import { fuseSwords, previewFusion, validateFusion } from '../fusion.js';
import { computeCP } from '../conversion.js';
import type { Sword } from '../types.js';

function mk(id: string, rarity: Sword['rarity'], s: Partial<Sword['stats']>, cp = 1500): Sword {
  const stats = { sharpness: 600, weight: 500, durability: 550, magic: 400, ...s };
  return {
    id, ownerId: 'u', name: id, rarity, stats,
    shape: { style: 'straight', centerline: [], lengthScale: 0.5, runeAnchors: [], trueDoubleEdge: false },
    plus: 0, cp: cp || computeCP(stats), engravings: rarity === 'SR' ? [{ id: 'e', name: '각인', rarity: 'SR', mods: {} }, null] : [null],
    runId: 'r', courseHash: 'c-' + id, createdAt: 0,
  };
}

describe('validateFusion', () => {
  it('rejects fusing a sword with itself', () => {
    const a = mk('a', 'SR', {});
    expect(validateFusion(a, a).ok).toBe(false);
  });
  it('rejects below-SR parents', () => {
    expect(validateFusion(mk('a', 'R', {}), mk('b', 'SR', {})).ok).toBe(false);
  });
  it('accepts two distinct SR+ swords', () => {
    expect(validateFusion(mk('a', 'SR', {}), mk('b', 'LEGEND', {})).ok).toBe(true);
  });
});

describe('fuseSwords', () => {
  it('applies the −10% weighted-average penalty', () => {
    const a = mk('a', 'SR', { sharpness: 800 }, 1000);
    const b = mk('b', 'SR', { sharpness: 800 }, 1000);
    const fused = fuseSwords(a, b, { id: 'f', ownerId: 'u', createdAt: 1 });
    // equal parents at 800 → avg 800 → ×0.9 = 720
    expect(fused.stats.sharpness).toBe(720);
  });
  it('weights by CP', () => {
    const strong = mk('a', 'SR', { sharpness: 900 }, 3000);
    const weak = mk('b', 'SR', { sharpness: 300 }, 1000);
    const fused = fuseSwords(strong, weak, { id: 'f', ownerId: 'u', createdAt: 1 });
    // weighted toward the 3000-CP parent, then ×0.9
    expect(fused.stats.sharpness).toBeGreaterThan(600);
    expect(fused.stats.sharpness).toBeLessThan(810);
  });
  it('takes the higher parent rarity and inherits one engraving', () => {
    const fused = fuseSwords(mk('a', 'SR', {}), mk('b', 'LEGEND', {}), { id: 'f', ownerId: 'u', createdAt: 1 });
    expect(fused.rarity).toBe('LEGEND');
    expect(fused.engravings.filter(Boolean).length).toBe(1);
  });
  it('preview matches the constructed sword', () => {
    const a = mk('a', 'SR', {}); const b = mk('b', 'SR', {});
    const p = previewFusion(a, b);
    const f = fuseSwords(a, b, { id: 'f', ownerId: 'u', createdAt: 1 });
    expect(p.cp).toBe(f.cp);
    expect(p.stats).toEqual(f.stats);
  });
});
