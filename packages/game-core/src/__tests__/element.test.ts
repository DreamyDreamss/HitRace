import { describe, expect, it } from 'vitest';
import {
  ELEMENTS,
  ELEMENT_ADVANTAGE,
  ELEMENT_DISADVANTAGE,
  bossElement,
  elementAdvantage,
  elementFromWeather,
  elementMatchup,
} from '../element.js';
import type { Element, WeatherSample } from '../element.js';
import { simulateCombat } from '../combat.js';
import type { Combatant } from '../types.js';

const day = (p: Partial<WeatherSample>): WeatherSample => ({
  temperatureC: 18,
  precipitationMm: 0,
  windKmh: 6,
  cloudPercent: 40,
  ...p,
});

describe('weather → element', () => {
  it('reads the days a runner would describe the same way', () => {
    expect(elementFromWeather(day({ precipitationMm: 3 }))).toBe('water');
    expect(elementFromWeather(day({ temperatureC: -4 }))).toBe('ice');
    expect(elementFromWeather(day({ windKmh: 32 }))).toBe('wind');
    expect(elementFromWeather(day({ temperatureC: 31, cloudPercent: 10 }))).toBe('fire');
  });

  it('a mild day makes a plain sword', () => {
    // Nothing about 18 °C, still and dry is worth naming.
    expect(elementFromWeather(day({}))).toBe('none');
  });

  it('rain wins over heat — it is what the run felt like', () => {
    expect(elementFromWeather(day({ temperatureC: 30, cloudPercent: 90, precipitationMm: 4 }))).toBe('water');
  });

  it('heat under heavy cloud is muggy, not blazing', () => {
    expect(elementFromWeather(day({ temperatureC: 29, cloudPercent: 100 }))).not.toBe('fire');
  });

  it('a breeze is not weather', () => {
    expect(elementFromWeather(day({ windKmh: 13 }))).toBe('none');
  });

  it('no reading at all is plain, never an error', () => {
    // The weather service is allowed to be down; forging is not allowed to fail.
    expect(elementFromWeather(null)).toBe('none');
    expect(elementFromWeather(undefined)).toBe('none');
  });

  it('does not jump between swords a minute apart', () => {
    // Scored rather than threshold-chained: 25.9 °C and 26.1 °C must not be different elements.
    const a = elementFromWeather(day({ temperatureC: 25.9, cloudPercent: 20 }));
    const b = elementFromWeather(day({ temperatureC: 26.1, cloudPercent: 20 }));
    expect(a).toBe(b);
  });
});

describe('counter cycle', () => {
  it('runs the ring 炎 → 氷 → 風 → 水 → 炎', () => {
    expect(elementAdvantage('fire', 'ice')).toBe(ELEMENT_ADVANTAGE);
    expect(elementAdvantage('ice', 'wind')).toBe(ELEMENT_ADVANTAGE);
    expect(elementAdvantage('wind', 'water')).toBe(ELEMENT_ADVANTAGE);
    expect(elementAdvantage('water', 'fire')).toBe(ELEMENT_ADVANTAGE);
  });

  it('is symmetric — losing costs what winning gains is worth', () => {
    expect(elementAdvantage('ice', 'fire')).toBe(ELEMENT_DISADVANTAGE);
    expect(elementAdvantage('fire', 'water')).toBe(ELEMENT_DISADVANTAGE);
  });

  it('same element is even, and so is anything against itself', () => {
    for (const el of ELEMENTS) expect(elementAdvantage(el, el)).toBe(1);
  });

  it('every element beats exactly one and loses to exactly one', () => {
    // A ring, not a hierarchy: no element is the safe pick.
    for (const el of ELEMENTS) {
      const beats = ELEMENTS.filter((other) => elementAdvantage(el, other) > 1);
      const loses = ELEMENTS.filter((other) => elementAdvantage(el, other) < 1);
      expect(beats).toHaveLength(1);
      expect(loses).toHaveLength(1);
    }
  });

  it('a plain sword is never punished for being plain', () => {
    for (const el of ELEMENTS) {
      expect(elementAdvantage('none', el)).toBe(1);
      expect(elementAdvantage(el, 'none')).toBe(1);
    }
  });

  it('is worth exactly a 1.5x power gap — no more', () => {
    // The honest number: ±20% means a counter beats anything under 1.2/0.8 = 1.5x CP, and loses
    // to anything above it. Worth stating plainly rather than claiming the element "never
    // decides" — at a 1.4x gap it does.
    const breakEven = ELEMENT_ADVANTAGE / ELEMENT_DISADVANTAGE;
    expect(breakEven).toBeCloseTo(1.5, 5);

    const weak = 1700;
    // A 1.4x lead is not enough to survive being countered…
    expect(weak * 1.4 * ELEMENT_DISADVANTAGE).toBeLessThan(weak * ELEMENT_ADVANTAGE);
    // …but a 1.6x lead is.
    expect(weak * 1.6 * ELEMENT_DISADVANTAGE).toBeGreaterThan(weak * ELEMENT_ADVANTAGE);
  });

  it('reports the matchup in words for the UI', () => {
    expect(elementMatchup('water', 'fire')).toBe('strong');
    expect(elementMatchup('fire', 'water')).toBe('weak');
    expect(elementMatchup('fire', 'fire')).toBe('even');
  });
});

describe('boss element', () => {
  it('is fixed for a region and cycle', () => {
    expect(bossElement('1114066:2026-W31')).toBe(bossElement('1114066:2026-W31'));
  });

  it('changes week to week, so the counter stays a question', () => {
    const weeks = ['2026-W31', '2026-W32', '2026-W33', '2026-W34', '2026-W35', '2026-W36'];
    const seen = new Set(weeks.map((w) => bossElement(`1114066:${w}`)));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('spreads across all four rather than favouring one', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 400; i++) {
      const el = bossElement(`region-${i}:2026-W31`);
      counts.set(el, (counts.get(el) ?? 0) + 1);
    }
    expect(counts.size).toBe(4);
    for (const n of counts.values()) expect(n).toBeGreaterThan(400 / 8);
  });

  it('is never 無 — a boss always poses the question', () => {
    for (let i = 0; i < 50; i++) expect(bossElement(`r${i}`)).not.toBe('none');
  });
});

describe('counter in combat', () => {
  const blade = (element: Element | undefined, sharpness = 700): Combatant => ({
    id: `s-${element ?? 'none'}-${sharpness}`,
    name: '직도',
    stats: { sharpness, weight: 450, durability: 480, magic: 470 },
    cadence: 172,
    engravings: [],
    element,
  });

  it('a countering blade wins a mirror match', () => {
    // Identical stats, only the weather they were forged in differs.
    const r = simulateCombat(blade('water'), blade('fire'), 'seed-1');
    expect(r.winner).toBe('a');
  });

  it('being countered is survivable with a real stat lead', () => {
    // 炎 into 水 is the bad side of the ring, but 1.7x sharpness still carries it.
    const r = simulateCombat(blade('fire', 1200), blade('water', 700), 'seed-2');
    expect(r.winner).toBe('a');
  });

  it('a plain blade is judged on its stats alone', () => {
    const withElement = simulateCombat(blade('fire', 900), blade(undefined, 700), 'seed-3');
    const without = simulateCombat(blade(undefined, 900), blade(undefined, 700), 'seed-3');
    expect(withElement.winner).toBe(without.winner);
  });
});
