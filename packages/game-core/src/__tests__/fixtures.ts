import type { GpsPoint, RunTrack } from '../types.js';

const SEOUL = { lat: 37.5285, lng: 126.9327 }; // Yeouido-ish

/** Metres → degrees at Seoul latitude (approx). */
function mToDegLat(m: number): number {
  return m / 111_320;
}
function mToDegLng(m: number): number {
  return m / (111_320 * Math.cos((SEOUL.lat * Math.PI) / 180));
}

export interface SynthOptions {
  distanceKm?: number;
  paceSecPerKm?: number;
  elevationGainM?: number;
  cadence?: number;
  cadenceJitter?: number;
  shape?: 'line' | 'out_and_back' | 'loop' | 'wiggle';
  startTs?: number;
  hrInZoneFraction?: number;
  maxHeartRate?: number;
  /** Inject a teleport jump at this fraction of the track (for anti-cheat tests). */
  teleportAt?: number;
}

/** Generate a plausible synthetic run track for testing. */
export function synthRun(opts: SynthOptions = {}): RunTrack {
  const distanceKm = opts.distanceKm ?? 5;
  const pace = opts.paceSecPerKm ?? 330;
  const elev = opts.elevationGainM ?? 40;
  const cadence = opts.cadence ?? 170;
  const jitter = opts.cadenceJitter ?? 3;
  const shape = opts.shape ?? 'line';
  const startTs = opts.startTs ?? 1_700_000_000_000;
  const hrFrac = opts.hrInZoneFraction ?? 0.6;
  const maxHr = opts.maxHeartRate ?? 190;

  const totalM = distanceKm * 1000;
  const totalSec = (distanceKm * pace);
  const n = Math.max(20, Math.round(distanceKm * 40)); // ~40 pts/km

  const points: GpsPoint[] = [];
  const cadenceArr: number[] = [];
  const hrArr: number[] = [];

  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    let dx = 0; // metres east
    let dy = 0; // metres north
    const spanM = shape === 'out_and_back' ? totalM / 2 : totalM;

    switch (shape) {
      case 'line':
        dx = f * spanM;
        dy = 0;
        break;
      case 'wiggle':
        dx = f * spanM;
        dy = Math.sin(f * Math.PI * 6) * 120;
        break;
      case 'out_and_back': {
        const g = f < 0.5 ? f * 2 : (1 - f) * 2; // 0→1→0
        dx = g * spanM;
        dy = 0;
        break;
      }
      case 'loop': {
        const theta = f * Math.PI * 2;
        const r = totalM / (2 * Math.PI);
        dx = Math.cos(theta) * r;
        dy = Math.sin(theta) * r;
        break;
      }
    }

    // elevation: rise then fall, net gain = elev
    const ele = 20 + Math.sin(f * Math.PI) * elev;

    let lat = SEOUL.lat + mToDegLat(dy);
    let lng = SEOUL.lng + mToDegLng(dx);

    if (opts.teleportAt != null && Math.abs(f - opts.teleportAt) < 1 / n) {
      lat += mToDegLat(5000); // 5km jump
    }

    points.push({ lat, lng, ele, t: startTs + Math.round(f * totalSec * 1000) });
    cadenceArr.push(cadence + (Math.sin(i * 1.7) * jitter));
    hrArr.push(i / n < hrFrac ? maxHr * 0.8 : maxHr * 0.5);
  }

  return { points, cadence: cadenceArr, heartRate: hrArr, maxHeartRate: maxHr };
}
