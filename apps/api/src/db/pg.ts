// PostgreSQL Repo. Used when DATABASE_URL is set. Mirrors MemoryRepo semantics against
// the schema in db/schema.sql. Kept intentionally straightforward (no ORM).

import pg from 'pg';
import type { Currency, GachaState, Sword, Wallet } from '@hitrace/game-core';
import type { CodexEntry, CourseScore, Ghost, LedgerEntry, MatchRecord, Repo, RunRecord, RunStats, SeasonPass, User } from './repo.js';
import { PgBossRepo } from './pg-boss.js';

const KM_PER_PASS_LEVEL = 12;

const { Pool } = pg;

function rowToUser(r: any): User {
  return {
    id: r.id, handle: r.handle, email: r.email ?? undefined, maxHeartRate: r.max_heart_rate,
    rankRp: r.rank_rp, equippedSwordId: r.equipped_sword_id ?? undefined, gachaPity: r.gacha_pity,
    streakDays: r.streak_days ?? 0, lastRunDay: r.last_run_day ?? undefined,
    weeklyGoalKm: r.weekly_goal_km ?? 20,
    onboardedAt: r.onboarded_at ? new Date(r.onboarded_at).getTime() : undefined,
    createdAt: new Date(r.created_at).getTime(),
  };
}

function rowToSword(r: any): Sword {
  return {
    id: r.id, ownerId: r.owner_id, name: r.name, rarity: r.rarity,
    stats: { sharpness: r.sharpness, weight: r.weight, durability: r.durability, magic: r.magic },
    shape: r.shape, plus: r.plus, cp: r.cp, engravings: [], runId: r.run_id ?? 'seed',
    awakening: r.awakening ?? 0,
    courseHash: r.course_hash, createdAt: new Date(r.created_at).getTime(),
  };
}

export class PgRepo implements Repo {
  private pool: pg.Pool;
  /** 동네 보스 storage. Only Postgres has it — the feature needs PostGIS. */
  readonly boss: PgBossRepo;
  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    this.pool.on('connect', (c) => { void c.query('SET search_path TO hitrace, public'); });
    this.boss = new PgBossRepo((text, params) => this.q(text, params));
  }
  async close() { await this.pool.end(); }
  private q<T extends pg.QueryResultRow = any>(text: string, params: any[] = []) { return this.pool.query<T>(text, params); }

  async getUser(id: string) {
    const r = await this.q('SELECT * FROM users WHERE id=$1', [id]);
    return r.rows[0] ? rowToUser(r.rows[0]) : undefined;
  }
  async getUserByHandle(handle: string) {
    const r = await this.q('SELECT * FROM users WHERE handle=$1', [handle]);
    return r.rows[0] ? rowToUser(r.rows[0]) : undefined;
  }
  async updateUser(id: string, patch: Partial<User>) {
    const sets: string[] = []; const vals: any[] = []; let i = 1;
    const map: Record<string, string> = { rankRp: 'rank_rp', equippedSwordId: 'equipped_sword_id', gachaPity: 'gacha_pity', streakDays: 'streak_days', lastRunDay: 'last_run_day', onboardedAt: 'onboarded_at', weeklyGoalKm: 'weekly_goal_km' };
    for (const [k, v] of Object.entries(patch)) {
      const col = map[k]; if (!col) continue;
      sets.push(`${col}=$${i++}`); vals.push(k === 'onboardedAt' && v ? new Date(v as number) : v);
    }
    if (sets.length) { vals.push(id); await this.q(`UPDATE users SET ${sets.join(',')} WHERE id=$${i}`, vals); }
    return (await this.getUser(id))!;
  }

  async getWallet(userId: string): Promise<Wallet> {
    const r = await this.q('SELECT currency, balance FROM wallets WHERE user_id=$1', [userId]);
    const w: Wallet = { ore: 0, engraveStone: 0, forgeTicket: 0, manaStone: 0 };
    for (const row of r.rows) (w as any)[row.currency] = row.balance;
    return w;
  }
  async applyCurrency(e: LedgerEntry) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO wallets (user_id, currency, balance) VALUES ($1,$2,GREATEST(0,$3))
         ON CONFLICT (user_id, currency) DO UPDATE SET balance = GREATEST(0, wallets.balance + $3)`,
        [e.userId, e.currency, e.delta],
      );
      await client.query(
        'INSERT INTO currency_ledger (user_id, currency, delta, reason, ref_id) VALUES ($1,$2,$3,$4,$5)',
        [e.userId, e.currency, e.delta, e.reason, e.refId ?? null],
      );
      const r = await client.query('SELECT balance FROM wallets WHERE user_id=$1 AND currency=$2', [e.userId, e.currency]);
      await client.query('COMMIT');
      return r.rows[0]?.balance ?? 0;
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  }
  async earnedSince(userId: string, currency: Currency, sinceMs: number) {
    const r = await this.q(
      'SELECT COALESCE(SUM(delta),0) AS s FROM currency_ledger WHERE user_id=$1 AND currency=$2 AND delta>0 AND created_at>=$3',
      [userId, currency, new Date(sinceMs)],
    );
    return Number(r.rows[0]?.s ?? 0);
  }

  async createRun(run: RunRecord) {
    // The route is kept (downsampled by the service) so the run-detail screen can draw it.
    await this.q(
      `INSERT INTO runs (id,user_id,status,track,course_hash,repeat_index,distance_km,duration_sec,avg_pace_sec_km,elevation_gain_m,avg_cadence,forge_score,reject_reasons,started_at)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,0,$11,$12,$13)`,
      [
        run.id, run.userId, run.status,
        JSON.stringify({ points: run.route ?? [], swordId: run.swordId ?? null }),
        run.courseHash, run.repeatIndex, run.distanceKm, run.durationSec, run.avgPaceSecPerKm,
        run.elevationGainM, run.forgeScore ?? null, run.rejectReasons ?? null, new Date(run.startedAt),
      ],
    );
  }

  private rowToRun(r: any): RunRecord {
    return {
      id: r.id, userId: r.user_id, status: r.status, courseHash: r.course_hash,
      repeatIndex: r.repeat_index, distanceKm: Number(r.distance_km), durationSec: r.duration_sec,
      avgPaceSecPerKm: r.avg_pace_sec_km, elevationGainM: r.elevation_gain_m,
      forgeScore: r.forge_score ?? undefined, rejectReasons: r.reject_reasons ?? undefined,
      startedAt: new Date(r.started_at).getTime(), createdAt: new Date(r.created_at).getTime(),
      route: r.track?.points ?? undefined, swordId: r.track?.swordId ?? undefined,
    };
  }

  async listRuns(userId: string, limit: number) {
    const r = await this.q(
      `SELECT id,user_id,status,course_hash,repeat_index,distance_km,duration_sec,avg_pace_sec_km,
              elevation_gain_m,forge_score,reject_reasons,started_at,created_at,
              jsonb_build_object('swordId', track->'swordId') AS track
         FROM runs WHERE user_id=$1 AND status<>'rejected'
        ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    );
    return r.rows.map((row: any) => this.rowToRun(row));
  }

  async findRunByStart(userId: string, startedAtMs: number) {
    const r = await this.q(
      `SELECT * FROM runs WHERE user_id=$1 AND started_at=$2 AND status<>'rejected' LIMIT 1`,
      [userId, new Date(startedAtMs)],
    );
    return r.rows[0] ? this.rowToRun(r.rows[0]) : undefined;
  }

  async getRun(userId: string, runId: string) {
    const r = await this.q('SELECT * FROM runs WHERE id=$1 AND user_id=$2', [runId, userId]);
    return r.rows[0] ? this.rowToRun(r.rows[0]) : undefined;
  }
  async countForgesOnDay(userId: string, dayStartMs: number) {
    const r = await this.q(`SELECT count(*)::int AS c FROM runs WHERE user_id=$1 AND status='forged' AND created_at>=$2`, [userId, new Date(dayStartMs)]);
    return r.rows[0]?.c ?? 0;
  }
  async countRunsForCourse(userId: string, courseHash: string) {
    const r = await this.q('SELECT count(*)::int AS c FROM runs WHERE user_id=$1 AND course_hash=$2', [userId, courseHash]);
    return r.rows[0]?.c ?? 0;
  }
  async runStats(userId: string): Promise<RunStats> {
    const r = await this.q('SELECT COALESCE(SUM(distance_km),0) AS km, count(*)::int AS c FROM runs WHERE user_id=$1', [userId]);
    return { totalKm: Number(r.rows[0]?.km ?? 0), runCount: r.rows[0]?.c ?? 0 };
  }

  async getSeasonPass(userId: string): Promise<SeasonPass> {
    const r = await this.q('SELECT season_id, level, km_progress, is_premium FROM season_pass WHERE user_id=$1 ORDER BY season_id DESC LIMIT 1', [userId]);
    const row = r.rows[0];
    if (!row) return { seasonId: 3, level: 0, kmProgress: 0, isPremium: false };
    return { seasonId: row.season_id, level: row.level, kmProgress: Number(row.km_progress), isPremium: row.is_premium };
  }
  async addSeasonKm(userId: string, km: number): Promise<SeasonPass> {
    const p = await this.getSeasonPass(userId);
    const kmProgress = p.kmProgress + km;
    const level = Math.floor(kmProgress / KM_PER_PASS_LEVEL);
    await this.q(
      `INSERT INTO season_pass (user_id, season_id, level, km_progress) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, season_id) DO UPDATE SET level=$3, km_progress=$4`,
      [userId, p.seasonId, level, kmProgress],
    );
    return { ...p, level, kmProgress };
  }

  async recordCodex(userId: string, s: Sword) {
    const RANK = `ARRAY['N','R','SR','LEGEND']::text[]`;
    await this.q(
      `INSERT INTO codex_entries (user_id, course_hash, name, best_rarity, style, best_cp, times_forged, shape, first_forged_at, last_forged_at)
       VALUES ($1,$2,$3,$4,$5,$6,1,$7,now(),now())
       ON CONFLICT (user_id, course_hash) DO UPDATE SET
         name = EXCLUDED.name,
         times_forged = codex_entries.times_forged + 1,
         last_forged_at = now(),
         best_cp = GREATEST(codex_entries.best_cp, EXCLUDED.best_cp),
         best_rarity = CASE WHEN array_position(${RANK}, EXCLUDED.best_rarity::text) >= array_position(${RANK}, codex_entries.best_rarity::text)
                            THEN EXCLUDED.best_rarity ELSE codex_entries.best_rarity END,
         style = CASE WHEN EXCLUDED.best_cp > codex_entries.best_cp THEN EXCLUDED.style ELSE codex_entries.style END,
         shape = CASE WHEN EXCLUDED.best_cp > codex_entries.best_cp THEN EXCLUDED.shape ELSE codex_entries.shape END`,
      [userId, s.courseHash, s.name, s.rarity, s.shape.style, s.cp, JSON.stringify(s.shape)],
    );
  }
  async listCodex(userId: string): Promise<CodexEntry[]> {
    const r = await this.q('SELECT * FROM codex_entries WHERE user_id=$1 ORDER BY last_forged_at DESC', [userId]);
    return r.rows.map((row) => ({
      courseHash: row.course_hash, name: row.name, bestRarity: row.best_rarity, style: row.style,
      bestScoreCp: row.best_cp, timesForged: row.times_forged, shape: row.shape,
      firstForgedAt: new Date(row.first_forged_at).getTime(), lastForgedAt: new Date(row.last_forged_at).getTime(),
    }));
  }

  async recordCourseScore(e: CourseScore) {
    await this.q(
      `INSERT INTO course_leaderboard (course_hash, user_id, handle, best_score, best_cp, at)
       VALUES ($1,$2,$3,$4,$5,now())
       ON CONFLICT (course_hash, user_id) DO UPDATE SET
         handle = EXCLUDED.handle,
         best_score = GREATEST(course_leaderboard.best_score, EXCLUDED.best_score),
         best_cp = GREATEST(course_leaderboard.best_cp, EXCLUDED.best_cp),
         at = now()`,
      [e.courseHash, e.userId, e.handle, e.bestScore, e.bestCp],
    );
  }
  async courseLeaderboard(courseHash: string): Promise<CourseScore[]> {
    const r = await this.q('SELECT * FROM course_leaderboard WHERE course_hash=$1 ORDER BY best_score DESC LIMIT 50', [courseHash]);
    return r.rows.map((row) => ({ courseHash: row.course_hash, userId: row.user_id, handle: row.handle, bestScore: row.best_score, bestCp: row.best_cp, at: new Date(row.at).getTime() }));
  }

  async addSword(s: Sword) {
    await this.q(
      `INSERT INTO swords (id,owner_id,run_id,name,rarity,style,true_double_edge,
        base_sharpness,base_weight,base_durability,base_magic,sharpness,weight,durability,magic,plus,cp,shape,course_hash)
       VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [s.id, s.ownerId, s.name, s.rarity, s.shape.style, s.shape.trueDoubleEdge, s.stats.sharpness, s.stats.weight, s.stats.durability, s.stats.magic, s.plus, s.cp, JSON.stringify(s.shape), s.courseHash],
    );
    // materialise empty engraving slots
    for (let slot = 0; slot < s.engravings.length; slot++) {
      await this.q('INSERT INTO sword_engravings (sword_id, slot, engraving_id) VALUES ($1,$2,$3)', [s.id, slot, s.engravings[slot]?.id ?? null]);
    }
  }
  private async loadEngravings(swordId: string): Promise<Sword['engravings']> {
    const r = await this.q(
      `SELECT se.slot, se.engraving_id, ed.name, ed.rarity, ed.mods, ed.trigger
       FROM sword_engravings se LEFT JOIN engraving_defs ed ON ed.id = se.engraving_id
       WHERE se.sword_id=$1 ORDER BY se.slot`,
      [swordId],
    );
    return r.rows.map((row) => (row.engraving_id ? { id: row.engraving_id, name: row.name, rarity: row.rarity, mods: row.mods, trigger: row.trigger ?? undefined } : null));
  }
  async getSword(id: string) {
    const r = await this.q('SELECT * FROM swords WHERE id=$1 AND dismantled_at IS NULL', [id]);
    if (!r.rows[0]) return undefined;
    const sw = rowToSword(r.rows[0]);
    sw.engravings = await this.loadEngravings(id);
    return sw;
  }
  async listSwords(userId: string) {
    const r = await this.q('SELECT * FROM swords WHERE owner_id=$1 AND dismantled_at IS NULL ORDER BY created_at DESC', [userId]);
    const swords = r.rows.map(rowToSword);
    for (const sw of swords) sw.engravings = await this.loadEngravings(sw.id);
    return swords;
  }
  async updateSword(id: string, patch: Partial<Sword>) {
    const sets: string[] = []; const vals: any[] = []; let i = 1;
    if (patch.stats) { sets.push(`sharpness=$${i++}`, `weight=$${i++}`, `durability=$${i++}`, `magic=$${i++}`); vals.push(patch.stats.sharpness, patch.stats.weight, patch.stats.durability, patch.stats.magic); }
    if (patch.plus != null) { sets.push(`plus=$${i++}`); vals.push(patch.plus); }
    if (patch.cp != null) { sets.push(`cp=$${i++}`); vals.push(patch.cp); }
    if (patch.shape != null) { sets.push(`shape=$${i++}`); vals.push(JSON.stringify(patch.shape)); }
    if (patch.name != null) { sets.push(`name=$${i++}`); vals.push(patch.name); }
    if (patch.awakening != null) { sets.push(`awakening=$${i++}`); vals.push(patch.awakening); }
    if (patch.engravings != null) {
      // Rewrite the slot rows for this sword.
      await this.q('DELETE FROM sword_engravings WHERE sword_id=$1', [id]);
      for (let s = 0; s < patch.engravings.length; s++) {
        await this.q('INSERT INTO sword_engravings (sword_id, slot, engraving_id) VALUES ($1,$2,$3)', [id, s, patch.engravings[s]?.id ?? null]);
      }
    }
    if (sets.length) { vals.push(id); await this.q(`UPDATE swords SET ${sets.join(',')} WHERE id=$${i}`, vals); }
    return (await this.getSword(id))!;
  }
  async removeSword(id: string) {
    await this.q('UPDATE swords SET dismantled_at=now() WHERE id=$1', [id]);
  }

  async getGachaState(userId: string): Promise<GachaState> {
    const u = await this.getUser(userId);
    return { pityCounter: u?.gachaPity ?? 0 };
  }
  async setGachaState(userId: string, state: GachaState) {
    await this.q('UPDATE users SET gacha_pity=$1 WHERE id=$2', [state.pityCounter, userId]);
  }
  async addMaterial(userId: string, itemId: string, qty: number) {
    await this.q(
      `INSERT INTO materials (user_id,item_id,qty) VALUES ($1,$2,$3)
       ON CONFLICT (user_id,item_id) DO UPDATE SET qty = materials.qty + $3`,
      [userId, itemId, qty],
    );
  }

  async findGhostInBand(myCp: number, band: number, excludeUserId: string) {
    // Bounds must be integers — cp is an INT column and pg rejects float params here.
    const lo = Math.floor(myCp * (1 - band));
    const hi = Math.ceil(myCp * (1 + band));
    const r = await this.q('SELECT * FROM ghosts WHERE cp BETWEEN $1 AND $2 ORDER BY abs(cp-$3) ASC LIMIT 1', [lo, hi, myCp]);
    return r.rows[0] ? this.rowToGhost(r.rows[0]) : undefined;
  }
  async getGhost(id: string) {
    const r = await this.q('SELECT * FROM ghosts WHERE id=$1', [id]);
    return r.rows[0] ? this.rowToGhost(r.rows[0]) : undefined;
  }
  async recordMatch(m: MatchRecord) {
    await this.q(
      `INSERT INTO matches (id,season_id,a_user_id,a_sword_id,b_is_ghost,seed,result,rp_delta)
       VALUES ($1,3,$2,$3,$4,$5,$6,$7)`,
      [m.id, m.aUserId, m.aSwordId, m.bIsGhost, m.seed, m.result, m.rpDelta],
    );
  }
  async listGhostsByCp() {
    const r = await this.q('SELECT * FROM ghosts ORDER BY cp DESC');
    return r.rows.map((row) => this.rowToGhost(row));
  }
  private rowToGhost(r: any): Ghost {
    return { id: r.id, userId: r.user_id, handle: r.handle, sword: r.sword, cp: r.cp, rankRp: r.rank_rp };
  }
}
