import type { WeatherSample } from '@hitrace/game-core';

/**
 * The weather a run happened in.
 *
 * This sits on the forge path, which is the one path in the app that must never fail — a run is
 * an hour of somebody's life and no third-party service gets to lose it. So every failure mode
 * here returns `undefined` and the sword comes out 無속성: short timeout, no retries, no throwing.
 *
 * Source: Open-Meteo. Free and keyless, but with no SLA — the same caveat `docs/RUNDEX_LESSONS.md`
 * raises about map tiles and elevation. Acceptable precisely *because* losing it costs an
 * attribute rather than a run.
 */

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 3_000;
/** Entries live an hour: weather does not change faster than the game cares about. */
const CACHE_TTL_MS = 60 * 60_000;
const CACHE_MAX = 500;

interface CacheEntry {
  value: WeatherSample | undefined;
  at: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Cache key: a ~11 km grid cell and the hour. Everyone running in the same part of a city within
 * the same hour shares one upstream call, which is what keeps a whole neighbourhood's Sunday
 * morning from becoming a few hundred requests.
 */
function cacheKey(lat: number, lng: number, atMs: number): string {
  const cell = `${lat.toFixed(1)},${lng.toFixed(1)}`;
  return `${cell}@${Math.floor(atMs / 3_600_000)}`;
}

/** `2026-08-01T14` in KST — the shape Open-Meteo's hourly `time` array uses. */
function hourStamp(atMs: number, tzOffsetMinutes = 9 * 60): string {
  return new Date(atMs + tzOffsetMinutes * 60_000).toISOString().slice(0, 13);
}

/**
 * Kill switch. Set `HITRACE_DISABLE_WEATHER=1` to forge plain swords without touching the
 * network — used by the test suite (which must not depend on a third party being up) and
 * available in ops if Open-Meteo ever misbehaves.
 */
const disabled = () => process.env.HITRACE_DISABLE_WEATHER === '1';

export async function fetchWeather(
  lat: number,
  lng: number,
  atMs: number,
): Promise<WeatherSample | undefined> {
  if (disabled()) return undefined;
  const key = cacheKey(lat, lng, atMs);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const value = await load(lat, lng, atMs);
  if (cache.size >= CACHE_MAX) {
    // Cheap eviction: drop the oldest insertion. A precise LRU is not worth the bookkeeping for
    // a cache this small.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, at: Date.now() });
  return value;
}

async function load(lat: number, lng: number, atMs: number): Promise<WeatherSample | undefined> {
  const url =
    `${ENDPOINT}?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}` +
    '&hourly=temperature_2m,precipitation,wind_speed_10m,cloud_cover' +
    // past_days covers a run submitted well after it finished (offline queue, late upload).
    '&past_days=2&forecast_days=1&timezone=Asia%2FSeoul';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return undefined;
    const json: any = await res.json();
    const hourly = json?.hourly;
    if (!hourly?.time?.length) return undefined;

    const stamp = hourStamp(atMs);
    let i = hourly.time.findIndex((t: string) => t.slice(0, 13) === stamp);
    // A run older than the window still gets the closest reading rather than nothing.
    if (i < 0) i = hourly.time.length - 1;

    const temperatureC = num(hourly.temperature_2m?.[i]);
    const precipitationMm = num(hourly.precipitation?.[i]);
    const windKmh = num(hourly.wind_speed_10m?.[i]);
    const cloudPercent = num(hourly.cloud_cover?.[i]);
    if (temperatureC === undefined) return undefined;

    return {
      temperatureC,
      precipitationMm: precipitationMm ?? 0,
      windKmh: windKmh ?? 0,
      cloudPercent: cloudPercent ?? 0,
    };
  } catch {
    // Timeout, DNS, malformed payload — all the same answer: no weather, plain sword.
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
