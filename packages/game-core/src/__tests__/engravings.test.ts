import { describe, expect, it } from 'vitest';
import { activeSynergies, effectiveStats, getEngraving } from '../config/engravings.js';
import type { Engraving, Stats } from '../types.js';

const base: Stats = { sharpness: 500, weight: 500, durability: 500, magic: 500 };
const eng = (id: string) => getEngraving(id) as Engraving;

describe('effectiveStats', () => {
  it('adds flat engraving mods', () => {
    const s = effectiveStats(base, [eng('dawn_pierce'), null, null]); // +60 sharpness
    expect(s.sharpness).toBe(560);
  });
  it('does not add trigger-only percentage values as flat stats', () => {
    // arcane_surge has magic:90 (flat) — that DOES add; ensure nothing spurious added elsewhere
    const s = effectiveStats(base, [eng('arcane_surge'), null, null]);
    expect(s.magic).toBe(590);
    expect(s.sharpness).toBe(500);
  });
  it('applies a +6% synergy when a set has two engravings', () => {
    // dawn set: dawn_pierce (+60 sharp) + arcane_surge (+90 magic), then ×1.06 all
    const s = effectiveStats(base, [eng('dawn_pierce'), eng('arcane_surge')]);
    expect(s.sharpness).toBe(Math.round(560 * 1.06));
    expect(s.magic).toBe(Math.round(590 * 1.06));
  });
  it('no synergy with a single engraving', () => {
    const s = effectiveStats(base, [eng('dawn_pierce'), null]);
    expect(s.sharpness).toBe(560); // no ×1.06
  });
});

describe('activeSynergies', () => {
  it('detects a completed set', () => {
    const syn = activeSynergies([eng('mountain_might'), eng('steady_guard')]); // both mountain
    expect(syn.length).toBe(1);
    expect(syn[0]!.set).toBe('mountain');
  });
  it('none when sets differ', () => {
    expect(activeSynergies([eng('dawn_pierce'), eng('mountain_might')]).length).toBe(0);
  });
});
