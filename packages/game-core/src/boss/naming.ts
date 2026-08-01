// Boss names, generated rather than authored.
//
// A blade comes from the route it was run on; a boss comes from the place it haunts. Nothing in
// this app is hand-drawn or hand-written per instance, and 3,482 행정동 could not be authored by
// hand anyway.

import { Rng } from '../rng.js';

/**
 * Epithets, not creature names. "연남동의 밤안개" reads like somewhere you know made strange;
 * "연남동의 고블린" reads like a different game entirely. The place is already the character —
 * the epithet only has to give it a mood.
 */
const EPITHETS = [
  '밤안개', '돌무지', '옛담장', '물그림자', '골목바람', '지붕서리', '가로등',
  '새벽이슬', '언덕그늘', '빈터', '철문', '담쟁이', '해질녘', '뒷골목',
  '검은비', '재너머', '첫눈', '마른천둥', '늦바람', '흙먼지',
];

/** Higher tiers earn a heavier prefix, so a tier-6 boss reads differently from a tier-1. */
const TIER_PREFIX = ['', '', '성난 ', '오래된 ', '굶주린 ', '잠들지 않는 ', '태초의 '];

/**
 * Deterministic: the same region and tier always produce the same name, so a boss keeps its
 * identity across restarts and across every client that renders it.
 */
export function bossName(regionName: string, tier: number, seed: string): string {
  const rng = new Rng(`${seed}:${regionName}:${tier}`);
  const epithet = EPITHETS[Math.floor(rng.next() * EPITHETS.length)] ?? EPITHETS[0]!;
  const prefix = TIER_PREFIX[Math.min(tier, TIER_PREFIX.length - 1)] ?? '';
  return `${regionName}의 ${prefix}${epithet}`;
}

/**
 * The seed everything visual hangs off. Region and cycle only — deliberately *not* the tier, so
 * a neighbourhood's boss keeps a consistent look as it grows through the week instead of turning
 * into a different creature every time it is killed.
 */
export function bossSeed(regionCode: string, cycleKey: string): string {
  return `${regionCode}:${cycleKey}`;
}

/** ISO week key, e.g. `2026-W31`. Dong bosses settle weekly. */
export function weekKey(atMs: number, tzOffsetMinutes = 9 * 60): string {
  const d = new Date(atMs + tzOffsetMinutes * 60_000);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // ISO: Thursday decides the year the week belongs to.
  const day = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * The key for the cycle before [atMs]'s.
 *
 * Lets a boss's starting tier be *derived* from last cycle's result instead of being written by a
 * scheduled job. A weekly cron that quietly fails on one Sunday would silently reset every
 * neighbourhood in the country to tier 1, and nobody would find out until Monday.
 */
export function previousCycleKey(level: 'dong' | 'gu', atMs: number): string {
  return level === 'dong' ? weekKey(atMs - 7 * 86_400_000) : monthKey(startOfMonth(atMs) - 86_400_000);
}

/** First instant of [atMs]'s month, in KST. */
function startOfMonth(atMs: number, tzOffsetMinutes = 9 * 60): number {
  const d = new Date(atMs + tzOffsetMinutes * 60_000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - tzOffsetMinutes * 60_000;
}

/** Month key, e.g. `2026-08`. Gu raids settle monthly. */
export function monthKey(atMs: number, tzOffsetMinutes = 9 * 60): string {
  const d = new Date(atMs + tzOffsetMinutes * 60_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
