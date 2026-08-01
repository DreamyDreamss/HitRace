import type pg from 'pg';
import type {
  BossRepo,
  BossRow,
  ContributionRow,
  RegionDistance,
  RegionRow,
} from './boss-repo.js';

type Query = <T extends pg.QueryResultRow = any>(text: string, params?: any[]) => Promise<pg.QueryResult<T>>;

const toRegion = (r: any): RegionRow => ({
  code: r.code,
  name: r.name,
  sido: r.sido ?? null,
  level: r.level,
  parentCode: r.parent_code ?? null,
});

const toBoss = (r: any): BossRow => ({
  id: r.id,
  regionCode: r.region_code,
  level: r.level,
  cycleKey: r.cycle_key,
  tier: r.tier,
  name: r.name,
  seed: r.seed,
  maxHp: Number(r.max_hp),
  hp: Number(r.hp),
  participants: r.participants,
  spawnedAt: new Date(r.spawned_at).getTime(),
  killedAt: r.killed_at ? new Date(r.killed_at).getTime() : undefined,
});

export class PgBossRepo implements BossRepo {
  constructor(private q: Query) {}

  async regionSplit(runId: string, level: 'dong' | 'gu'): Promise<RegionDistance[]> {
    const r = await this.q(
      'SELECT region_code, distance_km FROM hitrace.run_region_split($1, $2)',
      [runId, level],
    );
    return r.rows.map((row: any) => ({ code: row.region_code, distanceKm: Number(row.distance_km) }));
  }

  async getRegion(code: string) {
    const r = await this.q('SELECT code,name,sido,level,parent_code FROM regions WHERE code=$1', [code]);
    return r.rows[0] ? toRegion(r.rows[0]) : undefined;
  }

  async regionAt(lat: number, lng: number, level: 'dong' | 'gu') {
    const r = await this.q(
      `SELECT code,name,sido,level,parent_code FROM regions
        WHERE level=$3 AND retired_at IS NULL
          AND ST_Contains(geom, ST_SetSRID(ST_MakePoint($2,$1),4326))
        LIMIT 1`,
      [lat, lng, level],
    );
    return r.rows[0] ? toRegion(r.rows[0]) : undefined;
  }

  async liveBoss(regionCode: string, cycleKey: string) {
    const r = await this.q(
      `SELECT * FROM bosses
        WHERE region_code=$1 AND cycle_key=$2 AND killed_at IS NULL
        ORDER BY tier DESC LIMIT 1`,
      [regionCode, cycleKey],
    );
    return r.rows[0] ? toBoss(r.rows[0]) : undefined;
  }

  async bestTierCleared(regionCode: string, cycleKey: string) {
    const r = await this.q(
      'SELECT COALESCE(MAX(tier),0) AS t FROM boss_kills WHERE region_code=$1 AND cycle_key=$2',
      [regionCode, cycleKey],
    );
    return Number(r.rows[0]?.t ?? 0);
  }

  async createBoss(row: Omit<BossRow, 'id' | 'spawnedAt'>) {
    // ON CONFLICT: two runners can submit the first run of a cycle at the same moment. One
    // inserts, the other reads back the same boss rather than failing or forking the fight.
    const r = await this.q(
      `INSERT INTO bosses (region_code, level, cycle_key, tier, name, seed, max_hp, hp, participants)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (region_code, cycle_key, tier) DO UPDATE SET name = bosses.name
       RETURNING *`,
      [row.regionCode, row.level, row.cycleKey, row.tier, row.name, row.seed, row.maxHp, row.hp, row.participants],
    );
    return toBoss(r.rows[0]);
  }

  /**
   * One statement, so concurrent runs cannot both read the same HP and both believe they landed
   * the kill. `joinMaxHp` is supplied when the runner is new to this boss: their arrival raises
   * the ceiling, and the remaining HP rises with it so nobody's earlier damage is diluted.
   */
  async dealDamage(bossId: string, userId: string, damage: number, joinMaxHp: number | null) {
    const existing = await this.q('SELECT 1 FROM boss_damage WHERE boss_id=$1 AND user_id=$2', [bossId, userId]);
    const firstHit = existing.rowCount === 0;

    await this.q(
      `INSERT INTO boss_damage (boss_id, user_id, damage, runs, last_at)
       VALUES ($1,$2,$3,1,now())
       ON CONFLICT (boss_id, user_id) DO UPDATE
         SET damage = boss_damage.damage + EXCLUDED.damage,
             runs   = boss_damage.runs + 1,
             last_at = now()`,
      [bossId, userId, damage],
    );

    const r = await this.q(
      `UPDATE bosses SET
         max_hp = CASE WHEN $3::bigint IS NOT NULL THEN $3::bigint ELSE max_hp END,
         hp = GREATEST(
                0,
                CASE WHEN $3::bigint IS NOT NULL
                     THEN round(($3::bigint)::numeric * (hp::numeric / NULLIF(max_hp,0)))
                     ELSE hp END
                - $2::bigint),
         participants = participants + CASE WHEN $4 THEN 1 ELSE 0 END,
         killed_at = CASE
           WHEN GREATEST(0,
                  CASE WHEN $3::bigint IS NOT NULL
                       THEN round(($3::bigint)::numeric * (hp::numeric / NULLIF(max_hp,0)))
                       ELSE hp END
                  - $2::bigint) <= 0
           THEN now() ELSE killed_at END
       WHERE id=$1 AND killed_at IS NULL
       RETURNING hp, max_hp, participants, killed_at`,
      [bossId, damage, joinMaxHp, firstHit],
    );

    const row = r.rows[0];
    if (!row) {
      // Someone else killed it between our read and our write. The damage is still recorded
      // against the (now dead) boss, which is what the leaderboard should show.
      const b = await this.q('SELECT hp, max_hp, participants FROM bosses WHERE id=$1', [bossId]);
      return {
        hp: Number(b.rows[0]?.hp ?? 0),
        maxHp: Number(b.rows[0]?.max_hp ?? 0),
        participants: Number(b.rows[0]?.participants ?? 0),
        killed: false,
        firstHit,
      };
    }
    return {
      hp: Number(row.hp),
      maxHp: Number(row.max_hp),
      participants: Number(row.participants),
      killed: !!row.killed_at,
      firstHit,
    };
  }

  async contributions(bossId: string): Promise<ContributionRow[]> {
    const r = await this.q(
      `SELECT d.user_id, d.damage, d.runs, u.handle, u.boss_anonymous
         FROM boss_damage d JOIN users u ON u.id = d.user_id
        WHERE d.boss_id=$1
        ORDER BY d.damage DESC`,
      [bossId],
    );
    return r.rows.map((row: any) => ({
      userId: row.user_id,
      handle: row.handle,
      anonymous: !!row.boss_anonymous,
      damage: Number(row.damage),
      runs: row.runs,
    }));
  }

  async homeRegion(userId: string, level: 'dong' | 'gu', sinceMs: number) {
    const r = await this.q(
      `SELECT g.code, g.name, g.sido, g.level, g.parent_code
         FROM run_regions rr
         JOIN runs r ON r.id = rr.run_id
         JOIN regions g ON g.code = rr.region_code
        WHERE r.user_id=$1 AND rr.level=$2 AND r.created_at >= $3
        GROUP BY g.code, g.name, g.sido, g.level, g.parent_code
        ORDER BY SUM(rr.distance_km) DESC
        LIMIT 1`,
      [userId, level, new Date(sinceMs)],
    );
    return r.rows[0] ? toRegion(r.rows[0]) : undefined;
  }

  async damagingRunsToday(userId: string, regionCode: string, dayStartMs: number) {
    const r = await this.q(
      `SELECT COUNT(*)::int AS n
         FROM run_regions rr
         JOIN runs r ON r.id = rr.run_id
        WHERE r.user_id=$1 AND rr.region_code=$2 AND rr.damage > 0 AND r.created_at >= $3`,
      [userId, regionCode, new Date(dayStartMs)],
    );
    return Number(r.rows[0]?.n ?? 0);
  }

  async recordKill(kill: Parameters<BossRepo['recordKill']>[0]) {
    await this.q(
      `INSERT INTO boss_kills (boss_id, region_code, level, cycle_key, tier, participants, top_user_id, final_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [kill.bossId, kill.regionCode, kill.level, kill.cycleKey, kill.tier, kill.participants,
        kill.topUserId ?? null, kill.finalUserId ?? null],
    );
  }

  async recordRunRegions(
    runId: string,
    rows: Array<{ code: string; level: 'dong' | 'gu'; distanceKm: number; damage: number }>,
  ) {
    if (rows.length === 0) return;
    const values = rows
      .map((_, i) => `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5})`)
      .join(',');
    const params: any[] = [runId];
    for (const r of rows) params.push(r.code, r.level, r.distanceKm, r.damage);
    await this.q(
      `INSERT INTO run_regions (run_id, region_code, level, distance_km, damage)
       VALUES ${values}
       ON CONFLICT (run_id, region_code) DO NOTHING`,
      params,
    );
  }

  async grantManaStone(userId: string, amount: number) {
    const r = await this.q(
      `INSERT INTO wallets (user_id, currency, balance) VALUES ($1,'manaStone',GREATEST(0,$2))
       ON CONFLICT (user_id, currency) DO UPDATE SET balance = GREATEST(0, wallets.balance + $2)
       RETURNING balance`,
      [userId, amount],
    );
    return Number(r.rows[0]?.balance ?? 0);
  }

  async getManaStone(userId: string) {
    const r = await this.q(
      `SELECT balance FROM wallets WHERE user_id=$1 AND currency='manaStone'`,
      [userId],
    );
    return Number(r.rows[0]?.balance ?? 0);
  }

  async getAwakening(swordId: string) {
    const r = await this.q('SELECT awakening FROM swords WHERE id=$1', [swordId]);
    return Number(r.rows[0]?.awakening ?? 0);
  }

  async setAwakening(swordId: string, stage: number) {
    await this.q('UPDATE swords SET awakening=$2 WHERE id=$1', [swordId, stage]);
  }
}
