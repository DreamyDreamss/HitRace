// In-memory Repo — the default when DATABASE_URL is unset. Seeded to match db/seed.sql
// so behaviour is identical to a fresh Postgres load. Not durable (process memory).

import { randomUUID } from 'node:crypto';
import type { Currency, GachaState, Sword, Wallet } from '@hitrace/game-core';
import type { CodexEntry, CourseScore, Ghost, LedgerEntry, MatchRecord, Repo, RunRecord, RunStats, SeasonPass, User } from './repo.js';

const KM_PER_PASS_LEVEL = 12;
const RARITY_RANK: Record<string, number> = { N: 0, R: 1, SR: 2, LEGEND: 3 };

export const DEMO_USER_ID = '11111111-1111-1111-1111-111111111111';

function emptyWallet(): Wallet {
  return { ore: 0, engraveStone: 0, forgeTicket: 0 };
}

export class MemoryRepo implements Repo {
  private users = new Map<string, User>();
  private wallets = new Map<string, Wallet>();
  private ledger: LedgerEntry[] = [];
  private runs: RunRecord[] = [];
  private swords = new Map<string, Sword>();
  private gacha = new Map<string, GachaState>();
  private materials = new Map<string, Map<string, number>>();
  private ghosts = new Map<string, Ghost>();
  private matches: MatchRecord[] = [];
  private seasonPasses = new Map<string, SeasonPass>();
  private runBaseKm = new Map<string, { totalKm: number; runCount: number }>();
  private codex = new Map<string, Map<string, CodexEntry>>();
  private courseBoards = new Map<string, Map<string, CourseScore>>();

  constructor(seed = true) {
    if (seed) this.seed();
  }

  private seed(): void {
    const now = Date.now();
    this.users.set(DEMO_USER_ID, {
      id: DEMO_USER_ID,
      handle: 'demo',
      email: 'demo@hitrace.app',
      maxHeartRate: 190,
      rankRp: 1449,
      equippedSwordId: '20000000-0000-0000-0000-000000000001',
      gachaPity: 37,
      streakDays: 3,
      lastRunDay: Math.floor(now / 86_400_000),
      onboardedAt: now,
      createdAt: now,
    });
    this.wallets.set(DEMO_USER_ID, { ore: 1240, engraveStone: 3, forgeTicket: 11 });
    this.gacha.set(DEMO_USER_ID, { pityCounter: 37 });

    const mkSword = (
      id: string,
      name: string,
      rarity: Sword['rarity'],
      style: Sword['shape']['style'],
      stats: Sword['stats'],
      plus: number,
      cp: number,
      trueDoubleEdge: boolean,
      courseHash: string,
    ): Sword => ({
      id,
      ownerId: DEMO_USER_ID,
      name,
      rarity,
      stats,
      shape: { style, centerline: [], lengthScale: 0.5, runeAnchors: [], trueDoubleEdge },
      plus,
      cp,
      engravings: rarity === 'LEGEND' ? [null, null, null] : rarity === 'SR' ? [null, null] : [null],
      runId: 'seed',
      courseHash,
      createdAt: now,
    });

    this.swords.set(
      '20000000-0000-0000-0000-000000000001',
      mkSword('20000000-0000-0000-0000-000000000001', '한강 새벽선', 'LEGEND', 'double_edge', { sharpness: 842, weight: 610, durability: 733, magic: 418 }, 7, 1740, true, 'seed-course-hangang'),
    );
    this.swords.set(
      '20000000-0000-0000-0000-000000000002',
      mkSword('20000000-0000-0000-0000-000000000002', '남산 곡도', 'SR', 'curved', { sharpness: 560, weight: 480, durability: 520, magic: 610 }, 3, 1452, false, 'seed-course-namsan'),
    );
    this.swords.set(
      '20000000-0000-0000-0000-000000000003',
      mkSword('20000000-0000-0000-0000-000000000003', '잠실 순환환', 'R', 'chakram', { sharpness: 420, weight: 300, durability: 480, magic: 260 }, 1, 1010, false, 'seed-course-jamsil'),
    );

    const ghosts: Ghost[] = [
      { id: 'g1', userId: DEMO_USER_ID, handle: '러너_2481', cp: 1680, rankRp: 1452, sword: { name: '북악 절단', stats: { sharpness: 760, weight: 520, durability: 600, magic: 340 }, cadence: 168, engravings: [] } },
      { id: 'g2', userId: DEMO_USER_ID, handle: '새벽질주', cp: 1712, rankRp: 1444, sword: { name: '청계 월광', stats: { sharpness: 690, weight: 610, durability: 540, magic: 420 }, cadence: 175, engravings: [] } },
      { id: 'g3', userId: DEMO_USER_ID, handle: '언덕왕', cp: 1735, rankRp: 1460, sword: { name: '관악 등정', stats: { sharpness: 640, weight: 800, durability: 580, magic: 300 }, cadence: 160, engravings: [] } },
    ];
    for (const g of ghosts) this.ghosts.set(g.id, g);

    this.seasonPasses.set(DEMO_USER_ID, { seasonId: 3, level: 12, kmProgress: 148.6, isPremium: false });
    this.runBaseKm.set(DEMO_USER_ID, { totalKm: 148.6, runCount: 42 });

    // Seed codex + rivalry boards for the demo's three courses so both feel alive.
    const seedCourses: Array<[string, string, Sword['rarity'], Sword['shape']['style'], number]> = [
      ['seed-course-hangang', '한강 새벽선', 'LEGEND', 'double_edge', 1740],
      ['seed-course-namsan', '남산 곡도', 'SR', 'curved', 1452],
      ['seed-course-jamsil', '잠실 순환환', 'R', 'chakram', 1010],
    ];
    const codexMap = new Map<string, CodexEntry>();
    for (const [hash, name, rarity, style, cp] of seedCourses) {
      const sw = this.swords.get([...this.swords.keys()].find((k) => this.swords.get(k)!.courseHash === hash)!)!;
      codexMap.set(hash, { courseHash: hash, name, bestRarity: rarity, style, bestScoreCp: cp, timesForged: 1, shape: sw.shape, firstForgedAt: now, lastForgedAt: now });
      const board = new Map<string, CourseScore>();
      board.set(DEMO_USER_ID, { courseHash: hash, userId: DEMO_USER_ID, handle: 'demo', bestScore: rarity === 'LEGEND' ? 93 : rarity === 'SR' ? 81 : 58, bestCp: cp, at: now });
      // synthetic rivals
      const rivals = [['새벽질주', 88], ['언덕왕', 79], ['강변러너', 72]] as const;
      rivals.forEach(([h, s], i) => board.set('r' + i + hash, { courseHash: hash, userId: 'rival' + i, handle: h, bestScore: s - (rarity === 'R' ? 20 : 0), bestCp: cp - 40 * (i + 1), at: now }));
      this.courseBoards.set(hash, board);
    }
    this.codex.set(DEMO_USER_ID, codexMap);
  }

  async getUser(id: string) {
    return this.users.get(id);
  }
  async getUserByHandle(handle: string) {
    return [...this.users.values()].find((u) => u.handle === handle);
  }
  /** Dev-only sign-up: a fresh runner with an empty wallet and no swords. */
  async createUser(handle: string): Promise<User> {
    const user: User = {
      id: randomUUID(),
      handle,
      email: `${handle}@local.dev`,
      maxHeartRate: 190,
      rankRp: 0,
      equippedSwordId: undefined,
      gachaPity: 0,
      streakDays: 0,
      createdAt: Date.now(),
    };
    this.users.set(user.id, user);
    this.wallets.set(user.id, emptyWallet());
    return user;
  }

  async updateUser(id: string, patch: Partial<User>) {
    const u = this.users.get(id);
    if (!u) throw new Error('no_user');
    const next = { ...u, ...patch };
    this.users.set(id, next);
    return next;
  }

  async getWallet(userId: string) {
    return this.wallets.get(userId) ?? emptyWallet();
  }
  async applyCurrency(entry: LedgerEntry) {
    const w = this.wallets.get(entry.userId) ?? emptyWallet();
    const next = Math.max(0, w[entry.currency] + entry.delta);
    w[entry.currency] = next;
    this.wallets.set(entry.userId, w);
    this.ledger.push(entry);
    return next;
  }
  async earnedSince(userId: string, currency: Currency, sinceMs: number) {
    return this.ledger
      .filter((e) => e.userId === userId && e.currency === currency && e.delta > 0 && e.createdAt >= sinceMs)
      .reduce((s, e) => s + e.delta, 0);
  }

  async createRun(run: RunRecord) {
    this.runs.push(run);
  }
  async listRuns(userId: string, limit: number) {
    return this.runs
      .filter((r) => r.userId === userId && r.status !== 'rejected')
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map(({ route: _route, ...summary }) => summary);
  }
  async getRun(userId: string, runId: string) {
    return this.runs.find((r) => r.id === runId && r.userId === userId);
  }
  async findRunByStart(userId: string, startedAtMs: number) {
    return this.runs.find(
      (r) => r.userId === userId && r.startedAt === startedAtMs && r.status !== 'rejected',
    );
  }
  async countForgesOnDay(userId: string, dayStartMs: number) {
    return this.runs.filter((r) => r.userId === userId && r.status === 'forged' && r.createdAt >= dayStartMs).length;
  }
  async countRunsForCourse(userId: string, courseHash: string) {
    return this.runs.filter((r) => r.userId === userId && r.courseHash === courseHash).length;
  }
  async runStats(userId: string): Promise<RunStats> {
    const base = this.runBaseKm.get(userId) ?? { totalKm: 0, runCount: 0 };
    const live = this.runs.filter((r) => r.userId === userId);
    return {
      totalKm: base.totalKm + live.reduce((s, r) => s + r.distanceKm, 0),
      runCount: base.runCount + live.length,
    };
  }

  async getSeasonPass(userId: string): Promise<SeasonPass> {
    return this.seasonPasses.get(userId) ?? { seasonId: 3, level: 0, kmProgress: 0, isPremium: false };
  }
  async addSeasonKm(userId: string, km: number): Promise<SeasonPass> {
    const p = await this.getSeasonPass(userId);
    const kmProgress = p.kmProgress + km;
    const next: SeasonPass = { ...p, kmProgress, level: Math.floor(kmProgress / KM_PER_PASS_LEVEL) };
    this.seasonPasses.set(userId, next);
    return next;
  }

  async recordCodex(userId: string, sword: Sword): Promise<void> {
    const map = this.codex.get(userId) ?? new Map<string, CodexEntry>();
    const prev = map.get(sword.courseHash);
    const now = sword.createdAt;
    if (prev) {
      const better = RARITY_RANK[sword.rarity]! > RARITY_RANK[prev.bestRarity]! || sword.cp > prev.bestScoreCp;
      map.set(sword.courseHash, {
        ...prev,
        name: sword.name,
        bestRarity: RARITY_RANK[sword.rarity]! >= RARITY_RANK[prev.bestRarity]! ? sword.rarity : prev.bestRarity,
        bestScoreCp: Math.max(prev.bestScoreCp, sword.cp),
        style: better ? sword.shape.style : prev.style,
        shape: better ? sword.shape : prev.shape,
        timesForged: prev.timesForged + 1,
        lastForgedAt: now,
      });
    } else {
      map.set(sword.courseHash, {
        courseHash: sword.courseHash,
        name: sword.name,
        bestRarity: sword.rarity,
        style: sword.shape.style,
        bestScoreCp: sword.cp,
        timesForged: 1,
        shape: sword.shape,
        firstForgedAt: now,
        lastForgedAt: now,
      });
    }
    this.codex.set(userId, map);
  }
  async listCodex(userId: string): Promise<CodexEntry[]> {
    return [...(this.codex.get(userId)?.values() ?? [])].sort((a, b) => b.lastForgedAt - a.lastForgedAt);
  }

  async recordCourseScore(e: CourseScore): Promise<void> {
    const board = this.courseBoards.get(e.courseHash) ?? new Map<string, CourseScore>();
    const prev = board.get(e.userId);
    if (!prev || e.bestScore > prev.bestScore) board.set(e.userId, e);
    this.courseBoards.set(e.courseHash, board);
  }
  async courseLeaderboard(courseHash: string): Promise<CourseScore[]> {
    return [...(this.courseBoards.get(courseHash)?.values() ?? [])].sort((a, b) => b.bestScore - a.bestScore);
  }

  async addSword(sword: Sword) {
    this.swords.set(sword.id, sword);
  }
  async getSword(id: string) {
    return this.swords.get(id);
  }
  async listSwords(userId: string) {
    return [...this.swords.values()].filter((s) => s.ownerId === userId).sort((a, b) => b.createdAt - a.createdAt);
  }
  async updateSword(id: string, patch: Partial<Sword>) {
    const s = this.swords.get(id);
    if (!s) throw new Error('no_sword');
    const next = { ...s, ...patch };
    this.swords.set(id, next);
    return next;
  }
  async removeSword(id: string) {
    this.swords.delete(id);
  }

  async getGachaState(userId: string) {
    return this.gacha.get(userId) ?? { pityCounter: 0 };
  }
  async setGachaState(userId: string, state: GachaState) {
    this.gacha.set(userId, state);
  }
  async addMaterial(userId: string, itemId: string, qty: number) {
    const m = this.materials.get(userId) ?? new Map<string, number>();
    m.set(itemId, (m.get(itemId) ?? 0) + qty);
    this.materials.set(userId, m);
  }

  async findGhostInBand(myCp: number, band: number, excludeUserId: string) {
    const candidates = [...this.ghosts.values()].filter((g) => Math.abs(g.cp - myCp) <= myCp * band);
    return candidates.sort((a, b) => Math.abs(a.cp - myCp) - Math.abs(b.cp - myCp))[0];
  }
  async getGhost(id: string) {
    return this.ghosts.get(id);
  }
  async recordMatch(match: MatchRecord) {
    this.matches.push(match);
  }
  async listGhostsByCp() {
    return [...this.ghosts.values()].sort((a, b) => b.cp - a.cp);
  }
}
