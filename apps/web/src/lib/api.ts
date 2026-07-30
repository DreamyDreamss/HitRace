// Typed API client. Talks to the Fastify server (proxied at /api in dev).
import type { Sword } from '@hitrace/game-core';

const BASE = (import.meta.env.VITE_API_BASE as string) || '/api';

let token: string | null = localStorage.getItem('rb_token');

export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem('rb_token', t);
  else localStorage.removeItem('rb_token');
}
export function getToken() {
  return token;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const hasBody = body != null;
  const res = await fetch(BASE + path, {
    method,
    headers: {
      // Only set JSON content-type when we actually send a body — otherwise the
      // server rejects an empty body with content-type application/json.
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: hasBody ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail: unknown;
    try { detail = await res.json(); } catch { /* ignore */ }
    throw new ApiError(res.status, (detail as any)?.error ?? res.statusText, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, public detail?: unknown) {
    super(code);
  }
}

// ── Response shapes ────────────────────────────────────────────────────────────
export interface Wallet { ore: number; engraveStone: number; forgeTicket: number }
export interface User {
  id: string; handle: string; email?: string; maxHeartRate: number;
  rankRp: number; equippedSwordId?: string; gachaPity: number;
  streakDays: number; lastRunDay?: number; onboardedAt?: number; createdAt: number;
}
export interface MeResponse { user: User; wallet: Wallet; swordCount: number; equipped?: Sword }

export interface ForgeResult {
  run: unknown;
  sword?: Sword;
  metrics: { distanceKm: number; durationSec: number; avgPaceSecPerKm: number; elevationGainM: number };
  rewards: { ore: number; oreCapped: boolean; forgeTicket: number };
}

export interface GachaResult {
  pulls: Array<{ tier: 'legendMaterial' | 'engraveStone' | 'upgradeOre'; pity: boolean }>;
  grants: { ore: number; engraveStone: number; legendMaterial: number };
  pity: number; spentTickets: number;
}

export interface MatchResponse {
  found: boolean; band: number; ghostFallback?: boolean;
  opponent?: { id: string; handle: string; cp: number; sword: { name: string; stats: Sword['stats']; cadence: number } };
}

export interface ResolveResponse {
  matchId: string; seed: string; won: boolean; rpDelta: number; rankRp: number;
  combat: { winner: 'a' | 'b'; rounds: number; finalHp: { a: number; b: number }; log: Array<{ round: number; actor: 'a' | 'b'; kind: string; damage: number; label: string; aHp: number; bHp: number }> };
  opponent: { handle: string; sword: { name: string } };
  replay: { seed: string; a: { name: string; stats: Sword['stats']; cadence: number }; b: { name: string; stats: Sword['stats']; cadence: number } };
}

// ── Endpoints ──────────────────────────────────────────────────────────────────
export const api = {
  login: (handle: string) => req<{ token: string; user: User }>('POST', '/auth/dev/login', { handle }),
  me: () => req<MeResponse>('GET', '/me'),
  wallet: () => req<Wallet>('GET', '/wallet'),
  submitRun: (track: unknown, forge = true, name?: string) => req<ForgeResult>('POST', '/runs', { track, forge, name }),
  manualRun: (distanceKm: number, paceSecPerKm: number, name?: string) => req<{ sword: Sword; rewards: { ore: number; forgeTicket: number } }>('POST', '/runs/manual', { distanceKm, paceSecPerKm, name }),
  swords: () => req<Sword[]>('GET', '/swords'),
  sword: (id: string) => req<Sword>('GET', `/swords/${id}`),
  equip: (id: string) => req<User>('POST', `/swords/${id}/equip`),
  upgrade: (id: string, weeklyKm: number) => req<{ success: boolean; chance: number; cost: number; sword: Sword }>('POST', `/swords/${id}/upgrade`, { weeklyKm }),
  dismantle: (swordIds: string[]) => req<{ ore: number; walletOre: number; count: number }>('POST', '/swords/dismantle', { swordIds }),
  engrave: (id: string, slot: number, engravingId: string) => req<{ sword: Sword; synergies: Array<{ set: string; name: string }> }>('POST', `/swords/${id}/engrave`, { slot, engravingId }),
  gacha: (count: 1 | 10) => req<GachaResult>('POST', '/gacha/pull', { count }),
  match: (waitSec: number) => req<MatchResponse>('GET', `/pvp/match?waitSec=${waitSec}`),
  resolve: (ghostId: string) => req<ResolveResponse>('POST', '/pvp/resolve', { ghostId }),
  ranking: () => req<Array<{ rank: number; handle: string; cp: number; rankRp: number }>>('GET', '/pvp/ranking'),
  season: () => req<SeasonResponse>('GET', '/season'),
  profile: () => req<ProfileResponse>('GET', '/profile'),
  codex: () => req<CodexResponse>('GET', '/codex'),
  courseBoard: (hash: string) => req<Array<{ rank: number; userId: string; handle: string; bestScore: number; bestCp: number }>>('GET', `/courses/${encodeURIComponent(hash)}/leaderboard`),
  reforge: (id: string, shape: Sword['shape']) => req<Sword>('POST', `/swords/${id}/reforge`, { shape }),
  fusion: (swordIds: [string, string], name?: string) => req<{ sword: Sword; consumed: string[] }>('POST', '/forge/fusion', { swordIds, name }),
};

export interface SeasonResponse {
  season: { id: number; name: string; daysLeft: number };
  pass: { seasonId: number; level: number; kmProgress: number; isPremium: boolean };
  progress: { intoLevel: number; perLevel: number; pct: number };
  rewards: Array<{ level: number; free: { kind: string; amount: number }; premium: { kind: string; amount: number }; claimed: boolean }>;
}
export interface ProfileResponse {
  user: User;
  totals: { swords: number; byRarity: Record<string, number>; bestCp: number; totalKm: number; runCount: number };
}
export interface CodexEntry {
  courseHash: string; name: string; bestRarity: Sword['rarity']; style: Sword['shape']['style'];
  bestScoreCp: number; timesForged: number; shape: Sword['shape']; firstForgedAt: number; lastForgedAt: number;
}
export interface CodexResponse {
  entries: CodexEntry[];
  totals: { courses: number; legend: number };
}
