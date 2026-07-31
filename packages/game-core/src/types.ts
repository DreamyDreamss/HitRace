// ─────────────────────────────────────────────────────────────────────────────
// Domain types for the HitRace game engine. Pure data — no I/O, no framework.
// ─────────────────────────────────────────────────────────────────────────────

/** A single GPS sample recorded during a run. */
export interface GpsPoint {
  /** Latitude in decimal degrees. */
  lat: number;
  /** Longitude in decimal degrees. */
  lng: number;
  /** Elevation in metres (optional; some devices omit it). */
  ele?: number;
  /** Unix epoch milliseconds. */
  t: number;
}

/** Raw sensor stream for one run, as submitted by the client. Trusted only after validateRun(). */
export interface RunTrack {
  points: GpsPoint[];
  /** Optional instantaneous cadence samples (steps/min), aligned by time if present. */
  cadence?: number[];
  /** Optional heart-rate samples (bpm). */
  heartRate?: number[];
  /** Runner's max heart rate for zone calc; defaults from age if absent. */
  maxHeartRate?: number;
}

/** Derived, trustworthy metrics for a run (produced by the engine, not the client). */
export interface RunMetrics {
  distanceKm: number;
  durationSec: number;
  /** Average pace, seconds per km. */
  avgPaceSecPerKm: number;
  /** Cumulative positive elevation gain, metres. */
  elevationGainM: number;
  /** Average cadence, steps/min (0 if unavailable). */
  avgCadence: number;
  /** Coefficient of variation of cadence (0 = perfectly steady). */
  cadenceStability: number;
  /** Fraction (0..1) of time spent in the target HR zone. */
  hrZoneFraction: number;
  /** True if the route returns near its start (out-and-back or loop). */
  isRoundTrip: boolean;
  /** True if the path forms a closed loop (start≈end AND encloses area). */
  isClosedLoop: boolean;
  /** Normalised bendiness 0..1 (path length / straight-line span, mapped). */
  curviness: number;
  /** Count of detected self-intersections (→ rune decorations). */
  intersections: number;
  /** Negative split: 2nd-half pace faster than 1st half. */
  negativeSplit: boolean;
}

export type Rarity = 'N' | 'R' | 'SR' | 'LEGEND';

export type BladeStyle = 'straight' | 'curved' | 'double_edge' | 'chakram';

export type SwordPart = 'blade' | 'guard' | 'handle';

/** The four combat stats. */
export interface Stats {
  /** 예리함 — attack, from pace. */
  sharpness: number;
  /** 중량 — crit damage, from elevation. */
  weight: number;
  /** 내구 — durability, from cadence stability. */
  durability: number;
  /** 마력 — special gauge, from HR-zone time. */
  magic: number;
}

/** The visual/geometric identity of a blade, derived from GPS shape. */
export interface BladeShape {
  style: BladeStyle;
  /** Normalised centreline polyline (0..1 space), the smoothed silhouette. */
  centerline: Array<{ x: number; y: number }>;
  /** Overall length scale (1km ≈ 0.08). */
  lengthScale: number;
  /** Decorative rune anchors from self-intersections. */
  runeAnchors: Array<{ x: number; y: number }>;
  /** True double-edge earned from a real GPS round-trip (眞 양날). */
  trueDoubleEdge: boolean;
  /** Cosmetic-only transform applied in the forge workshop (never affects stats). */
  transform?: BladeTransform;
  /** Part-assignment split ratios (blade/guard/handle) from the route timeline. Cosmetic. */
  parts?: { blade: number; guard: number; handle: number };
  /** Forged from a manual/treadmill entry (no GPS) — a procedural, non-"real route" blade. */
  procedural?: boolean;
}

export interface BladeTransform {
  /** Degrees, typically 15° snapped. */
  rotate: number;
  flipH: boolean;
  flipV: boolean;
  /** Mirror-symmetry preview (double-edge appearance). */
  mirror: boolean;
  /** 0.8–1.2. */
  scale: number;
}

export interface ForgeScore {
  total: number;
  breakdown: {
    base: number;
    paceBonus: number;
    explorationBonus: number;
    negativeSplitBonus: number;
    elevationBonus: number;
    repeatPenalty: number;
  };
  rarity: Rarity;
}

/** A forged sword. */
export interface Sword {
  id: string;
  ownerId: string;
  name: string;
  rarity: Rarity;
  stats: Stats;
  shape: BladeShape;
  /** Upgrade level (+N). */
  plus: number;
  /** Combat power, derived. */
  cp: number;
  /** Engraving slots and their fills. */
  engravings: Array<Engraving | null>;
  /** Source run id and course fingerprint. */
  runId: string;
  courseHash: string;
  createdAt: number;
}

export interface Engraving {
  id: string;
  name: string;
  rarity: Rarity;
  /** Flat/percentage stat mods applied on top of base stats. */
  mods: Partial<Record<keyof Stats, number>>;
  /** Optional combat trigger key resolved by the combat engine. */
  trigger?: string;
}

// ── Economy ──────────────────────────────────────────────────────────────────
export type Currency = 'ore' | 'engraveStone' | 'forgeTicket';
export type Wallet = Record<Currency, number>;

// ── Combat ───────────────────────────────────────────────────────────────────
export interface Combatant {
  id: string;
  name: string;
  stats: Stats;
  cadence: number;
  engravings: Array<Engraving | null>;
}

export interface CombatEventLog {
  round: number;
  actor: 'a' | 'b';
  kind: 'attack' | 'crit' | 'skill' | 'engraving';
  damage: number;
  label: string;
  aHp: number;
  bHp: number;
}

export interface CombatResult {
  winner: 'a' | 'b';
  rounds: number;
  log: CombatEventLog[];
  finalHp: { a: number; b: number };
}

// ── Anti-cheat ───────────────────────────────────────────────────────────────
export interface RunValidation {
  ok: boolean;
  reasons: string[];
  /** Repeat index of this course for the runner (0 = first time). */
  repeatIndex: number;
  /** The track with GPS outliers removed — what everything downstream should score and store. */
  track: RunTrack;
}
