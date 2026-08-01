// Storage contract for 동네 보스.
//
// Split out from `Repo` and made optional on purpose: the whole feature rests on point-in-polygon
// lookups against 3,712 administrative polygons, which is PostGIS or nothing. The in-memory repo
// the local dev server and the API tests run on has no such thing, so it simply reports "no
// bosses here" and every other part of the app carries on unchanged.

export interface RegionRow {
  code: string;
  name: string;
  sido: string | null;
  level: 'dong' | 'gu';
  parentCode: string | null;
}

export interface BossRow {
  id: string;
  regionCode: string;
  level: 'dong' | 'gu';
  cycleKey: string;
  tier: number;
  name: string;
  seed: string;
  maxHp: number;
  hp: number;
  participants: number;
  spawnedAt: number;
  killedAt?: number;
}

export interface ContributionRow {
  userId: string;
  handle: string;
  anonymous: boolean;
  damage: number;
  runs: number;
}

export interface RegionDistance {
  code: string;
  distanceKm: number;
}

export interface BossRepo {
  /** How far a stored run travelled inside each region at [level]. Requires the route. */
  regionSplit(runId: string, level: 'dong' | 'gu'): Promise<RegionDistance[]>;
  getRegion(code: string): Promise<RegionRow | undefined>;
  /** The region containing a point — used to answer "what is my neighbourhood?" without a run. */
  regionAt(lat: number, lng: number, level: 'dong' | 'gu'): Promise<RegionRow | undefined>;

  /** The boss currently alive for this region and cycle, if one has been spawned. */
  liveBoss(regionCode: string, cycleKey: string): Promise<BossRow | undefined>;
  /** Highest tier already cleared in this region for this cycle (0 if none). */
  bestTierCleared(regionCode: string, cycleKey: string): Promise<number>;
  createBoss(row: Omit<BossRow, 'id' | 'spawnedAt'>): Promise<BossRow>;

  /**
   * Adds damage and returns the boss's state afterwards.
   *
   * Atomic on the server: two runs submitted at the same moment must not both read the same HP
   * and both decide they landed the kill.
   */
  dealDamage(
    bossId: string,
    userId: string,
    damage: number,
    joinMaxHp: number | null,
  ): Promise<{ hp: number; maxHp: number; participants: number; killed: boolean; firstHit: boolean }>;

  contributions(bossId: string): Promise<ContributionRow[]>;
  /** Damaging runs this user has already had counted against this region today. */
  damagingRunsToday(userId: string, regionCode: string, dayStartMs: number): Promise<number>;

  recordKill(kill: {
    bossId: string;
    regionCode: string;
    level: 'dong' | 'gu';
    cycleKey: string;
    tier: number;
    participants: number;
    topUserId?: string;
    finalUserId?: string;
  }): Promise<void>;

  /** Audit trail: which regions a run touched and what it did to each. */
  recordRunRegions(
    runId: string,
    rows: Array<{ code: string; level: 'dong' | 'gu'; distanceKm: number; damage: number }>,
  ): Promise<void>;

  grantManaStone(userId: string, amount: number): Promise<number>;
  getManaStone(userId: string): Promise<number>;

  getAwakening(swordId: string): Promise<number>;
  setAwakening(swordId: string, stage: number): Promise<void>;
}
