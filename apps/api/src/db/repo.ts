// Persistence boundary. Services depend on this interface, never on a concrete DB.
// Two implementations: MemoryRepo (default, seeded) and PgRepo (Postgres).

import type { Currency, GachaState, GpsPoint, Sword, Wallet } from '@hitrace/game-core';

export interface User {
  id: string;
  handle: string;
  email?: string;
  maxHeartRate: number;
  rankRp: number;
  equippedSwordId?: string;
  gachaPity: number;
  /** Consecutive-day running streak. */
  streakDays: number;
  /** Weekly distance target in km (habit loop; 0 = no goal). */
  weeklyGoalKm?: number;
  /** Epoch-day integer of the last run (for streak continuity). */
  lastRunDay?: number;
  onboardedAt?: number;
  createdAt: number;
}

export interface RunRecord {
  id: string;
  userId: string;
  status: 'recorded' | 'forged' | 'rejected';
  courseHash: string;
  repeatIndex: number;
  distanceKm: number;
  durationSec: number;
  avgPaceSecPerKm: number;
  elevationGainM: number;
  forgeScore?: number;
  rejectReasons?: string[];
  startedAt: number;
  createdAt: number;
  /** Downsampled GPS polyline kept for the run detail screen (empty for manual runs). */
  route?: GpsPoint[];
  /** Id of the sword this run forged, when it did. */
  swordId?: string;
}

export interface LedgerEntry {
  userId: string;
  currency: Currency;
  delta: number;
  reason: string;
  refId?: string;
  createdAt: number;
}

export interface CourseScore {
  courseHash: string;
  userId: string;
  handle: string;
  bestScore: number;
  bestCp: number;
  at: number;
}

export interface Ghost {
  id: string;
  userId: string;
  handle: string;
  sword: {
    name: string;
    stats: Sword['stats'];
    cadence: number;
    engravings: Sword['engravings'];
  };
  cp: number;
  rankRp: number;
}

export interface MatchRecord {
  id: string;
  aUserId: string;
  aSwordId: string;
  bIsGhost: boolean;
  bGhostId?: string;
  seed: string;
  result: 'win' | 'loss';
  rpDelta: number;
  createdAt: number;
}

export interface SeasonPass {
  seasonId: number;
  level: number;
  kmProgress: number;
  isPremium: boolean;
}

export interface RunStats {
  totalKm: number;
  runCount: number;
}

/** A permanent record of a course ever forged — survives dismantling the sword. */
export interface CodexEntry {
  courseHash: string;
  name: string;
  bestRarity: Sword['rarity'];
  style: Sword['shape']['style'];
  bestScoreCp: number;
  timesForged: number;
  shape: Sword['shape'];
  firstForgedAt: number;
  lastForgedAt: number;
}

export interface Repo {
  // users
  getUser(id: string): Promise<User | undefined>;
  getUserByHandle(handle: string): Promise<User | undefined>;
  updateUser(id: string, patch: Partial<User>): Promise<User>;
  /**
   * Create a brand-new runner. Optional on purpose: only the in-memory (dev) repo implements it,
   * so the dev login can hand out fresh accounts locally. Real sign-up belongs to whatever auth
   * provider we adopt — see docs/OPEN_DECISIONS.md §2.
   */
  createUser?(handle: string): Promise<User>;

  // wallet
  getWallet(userId: string): Promise<Wallet>;
  /** Atomically apply a signed delta with cap enforcement handled by the service; records ledger. */
  applyCurrency(entry: LedgerEntry): Promise<number>; // returns new balance
  /** Sum of positive deltas for a currency since `sinceMs` (for daily/weekly caps). */
  earnedSince(userId: string, currency: Currency, sinceMs: number): Promise<number>;

  // runs
  createRun(run: RunRecord): Promise<void>;
  /** Newest first. Summaries only — the route comes from getRun. */
  listRuns(userId: string, limit: number): Promise<RunRecord[]>;
  getRun(userId: string, runId: string): Promise<RunRecord | undefined>;
  /**
   * The run this user already stored that began at exactly `startedAtMs`, if any.
   * A retried upload carries the identical track, so its first sample's timestamp identifies it
   * — that is what makes submitting twice safe.
   */
  findRunByStart(userId: string, startedAtMs: number): Promise<RunRecord | undefined>;
  countForgesOnDay(userId: string, dayStartMs: number): Promise<number>;
  countRunsForCourse(userId: string, courseHash: string): Promise<number>;
  runStats(userId: string): Promise<RunStats>;

  // season pass
  getSeasonPass(userId: string): Promise<SeasonPass>;
  addSeasonKm(userId: string, km: number): Promise<SeasonPass>;

  // codex (persists even after a sword is dismantled)
  recordCodex(userId: string, sword: Sword): Promise<void>;
  listCodex(userId: string): Promise<CodexEntry[]>;

  // per-course rivalry leaderboard (keeps each runner's best forge-score on a course)
  recordCourseScore(e: CourseScore): Promise<void>;
  courseLeaderboard(courseHash: string): Promise<CourseScore[]>;

  // swords
  addSword(sword: Sword): Promise<void>;
  getSword(id: string): Promise<Sword | undefined>;
  listSwords(userId: string): Promise<Sword[]>;
  updateSword(id: string, patch: Partial<Sword>): Promise<Sword>;
  removeSword(id: string): Promise<void>;

  // gacha
  getGachaState(userId: string): Promise<GachaState>;
  setGachaState(userId: string, state: GachaState): Promise<void>;
  addMaterial(userId: string, itemId: string, qty: number): Promise<void>;

  // pvp
  findGhostInBand(myCp: number, band: number, excludeUserId: string): Promise<Ghost | undefined>;
  getGhost(id: string): Promise<Ghost | undefined>;
  recordMatch(match: MatchRecord): Promise<void>;
  listGhostsByCp(): Promise<Ghost[]>;
}
