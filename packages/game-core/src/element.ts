// 속성 — the weather a run happened in, turned into something the sword carries.
//
// The route already becomes the blade's shape and the pacing becomes its magic. Weather was the
// last real-world variable the game ignored, and it is the one that decides whether people go out
// at all. Giving it a consequence turns the days runners skip — rain, cold — into the days that
// produce something they cannot get otherwise.

export type Element = 'fire' | 'water' | 'wind' | 'ice' | 'none';

export interface WeatherSample {
  /** °C at the run's start. */
  temperatureC: number;
  /** mm in the hour of the run. */
  precipitationMm: number;
  /** km/h. */
  windKmh: number;
  /** 0..100. */
  cloudPercent: number;
}

export const ELEMENTS: Element[] = ['fire', 'water', 'wind', 'ice'];

export const ELEMENT_LABEL: Record<Element, string> = {
  fire: '炎',
  water: '水',
  wind: '風',
  ice: '氷',
  none: '無',
};

/** What kind of day earns it — shown to explain a sword rather than leaving it a rune. */
export const ELEMENT_WEATHER: Record<Element, string> = {
  fire: '맑고 더운 날',
  water: '비·눈 오는 날',
  wind: '바람 센 날',
  ice: '추운 날',
  none: '평범한 날씨',
};

/**
 * The counter cycle: 炎 → 氷 → 風 → 水 → 炎.
 *
 * Two of the four links are the ones everybody already knows — fire melts ice, water douses fire.
 * The other two (ice stills wind, wind scatters water) carry the ring. A ring rather than
 * opposed pairs so no element is simply the best answer to another.
 */
const BEATS: Record<Element, Element | null> = {
  fire: 'ice',
  ice: 'wind',
  wind: 'water',
  water: 'fire',
  none: null,
};

/** How much of the counter shows up in damage. Weather cannot be chosen, so it must not decide. */
export const ELEMENT_ADVANTAGE = 1.2;
export const ELEMENT_DISADVANTAGE = 0.8;

/**
 * Damage multiplier for [attacker] hitting [defender].
 *
 * 無 neither wins nor loses: a sword forged on a mild day is simply plain, not handicapped.
 */
export function elementAdvantage(attacker: Element, defender: Element): number {
  if (attacker === 'none' || defender === 'none') return 1;
  if (BEATS[attacker] === defender) return ELEMENT_ADVANTAGE;
  if (BEATS[defender] === attacker) return ELEMENT_DISADVANTAGE;
  return 1;
}

/** 'strong' | 'weak' | 'even' — for the UI, which should say this in words, not a number. */
export function elementMatchup(attacker: Element, defender: Element): 'strong' | 'weak' | 'even' {
  const m = elementAdvantage(attacker, defender);
  return m > 1 ? 'strong' : m < 1 ? 'weak' : 'even';
}

/** Threshold a signal must clear to colour the sword at all. Below it the day was unremarkable. */
const MIN_SIGNAL = 0.15;

/**
 * Weather → element.
 *
 * Scored rather than a chain of thresholds: a cliff edge at, say, exactly 26 °C would make two
 * runs a minute apart produce different swords for no reason a runner could see. Each element
 * gets a 0..1 strength and the strongest wins; a mild day clears nothing and yields 無.
 */
export function elementFromWeather(w: WeatherSample | null | undefined): Element {
  if (!w) return 'none';
  const scores: Record<Exclude<Element, 'none'>, number> = {
    // Any real rain dominates how a run felt, so it saturates fast.
    water: clamp01(w.precipitationMm / 2),
    // Below 5 °C starts to bite; −10 °C is as cold as it needs to get.
    ice: clamp01((5 - w.temperatureC) / 15),
    // A breeze is not weather; 12 km/h and up starts to be felt, 37 km/h is a fight.
    wind: clamp01((w.windKmh - 12) / 25),
    // Heat only counts under an open sky. Full overcast cancels it outright — 29 °C under solid
    // cloud is muggy, and nobody would call that run a blazing one.
    fire: clamp01((w.temperatureC - 22) / 12) * clamp01(1 - w.cloudPercent / 100),
  };

  let best: Element = 'none';
  let bestScore = MIN_SIGNAL;
  for (const el of ELEMENTS) {
    const s = scores[el as Exclude<Element, 'none'>];
    if (s > bestScore) {
      best = el;
      bestScore = s;
    }
  }
  return best;
}

/**
 * A boss's element, fixed for its region and cycle.
 *
 * Seeded rather than taken from the local weather on purpose. Korean summers would otherwise
 * hand every boss 炎 for two months, and the counter would stop being a choice — it would just
 * be the season. This way each week poses a fresh question about when to go out.
 */
export function bossElement(seed: string): Element {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ELEMENTS[Math.abs(h) % ELEMENTS.length]!;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
