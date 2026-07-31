// HitRace game API as a single Supabase Edge Function.
//
// Why a function and not plain PostgREST: this game is server-authoritative. Forge
// scoring, anti-cheat, upgrade RNG, gacha pity, PvP combat and every currency cap are
// decided here — a client that could write these tables could mint LEGEND swords.
// So: reads may go direct (RLS, read-only), writes come through here.
//
// The handler reuses the exact same `GameService` the local Fastify server runs, so
// behaviour and the 26 API tests stay meaningful. Routes mirror apps/api/src/server.ts —
// keep the two lists in sync.

import { GameService, ServiceError } from '@hitrace/api/service';
import { PgRepo } from '@hitrace/api/repo-pg';

// Prefer the pooler URL (set as a secret) — edge invocations are short-lived and
// direct connections exhaust quickly. Falls back to the platform-provided URL.
const dbUrl = Deno.env.get('HITRACE_DB_URL') ?? Deno.env.get('SUPABASE_DB_URL');
if (!dbUrl) throw new Error('HITRACE_DB_URL / SUPABASE_DB_URL is not set');

// Module scope: reused across invocations on a warm isolate.
const repo = new PgRepo(dbUrl);
const svc = new GameService(repo);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  });

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

/** The gateway already verified the JWT; we only need the subject. */
function userIdFrom(req: Request): string | null {
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

function fail(e: unknown): Response {
  if (e instanceof ServiceError) return json({ error: e.code }, e.status);
  console.error(e);
  return json({ error: 'internal_error' }, 500);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = new URL(req.url);
  // Path arrives as /game/<route>; strip the function name.
  const path = url.pathname.replace(/^\/functions\/v1/, '').replace(/^\/game/, '') || '/';
  const seg = path.split('/').filter(Boolean);
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

  if (path === '/health') return json({ ok: true, service: 'hitrace-edge' });

  const userId = userIdFrom(req);
  if (!userId) return json({ error: 'unauthenticated' }, 401);

  try {
    // ── Me / wallet ────────────────────────────────────────────────────────
    if (req.method === 'GET' && path === '/me') return json(await svc.me(userId));
    if (req.method === 'GET' && path === '/wallet') return json(await svc.wallet(userId));

    // ── Runs → forge ───────────────────────────────────────────────────────
    if (req.method === 'POST' && path === '/runs') {
      return json(await svc.submitRun(userId, body.track, { forge: body.forge !== false, name: body.name }));
    }
    if (req.method === 'POST' && path === '/runs/manual') {
      if (!body.distanceKm || !body.paceSecPerKm) return json({ error: 'missing_inputs' }, 400);
      return json(await svc.manualRun(userId, Number(body.distanceKm), Number(body.paceSecPerKm), body.name));
    }

    // ── Running log ────────────────────────────────────────────────────────
    if (req.method === 'GET' && path === '/runs') {
      return json(await svc.listRuns(userId, Number(url.searchParams.get('limit') ?? 50)));
    }
    if (req.method === 'GET' && path === '/stats/running') return json(await svc.runningStats(userId));
    if (req.method === 'POST' && path === '/stats/goal') {
      return json(await svc.setWeeklyGoal(userId, Number(body.weeklyGoalKm)));
    }
    if (req.method === 'GET' && seg[0] === 'runs' && seg.length === 2) {
      return json(await svc.runDetail(userId, seg[1]));
    }

    // ── Swords ─────────────────────────────────────────────────────────────
    if (req.method === 'GET' && path === '/swords') return json(await svc.listSwords(userId));
    if (req.method === 'POST' && path === '/swords/dismantle') {
      const ids = (body.swordIds ?? []) as string[];
      if (!ids.length) return json({ error: 'no_swords' }, 400);
      return json(await svc.dismantle(userId, ids));
    }
    if (seg[0] === 'swords' && seg[1]) {
      const id = seg[1];
      if (req.method === 'GET' && seg.length === 2) return json(await svc.getSword(userId, id));
      if (req.method === 'POST' && seg[2] === 'equip') return json(await svc.equip(userId, id));
      if (req.method === 'POST' && seg[2] === 'upgrade') {
        return json(await svc.upgrade(userId, id, Number(body.weeklyKm ?? 0)));
      }
      if (req.method === 'POST' && seg[2] === 'engrave') {
        if (body.slot == null || !body.engravingId) return json({ error: 'missing_inputs' }, 400);
        return json(await svc.applyEngraving(userId, id, Number(body.slot), body.engravingId));
      }
      if (req.method === 'POST' && seg[2] === 'reforge') {
        if (!body.shape) return json({ error: 'missing_shape' }, 400);
        return json(await svc.reforge(userId, id, body.shape));
      }
    }

    // ── Gacha / fusion ─────────────────────────────────────────────────────
    if (req.method === 'POST' && path === '/gacha/pull') {
      return json(await svc.gacha(userId, (body.count ?? 1) === 10 ? 10 : 1));
    }
    if (req.method === 'POST' && path === '/forge/fusion') {
      const ids = (body.swordIds ?? []) as string[];
      if (ids.length !== 2) return json({ error: 'need_two_swords' }, 400);
      return json(await svc.fusion(userId, ids[0], ids[1], body.name));
    }

    // ── PvP ────────────────────────────────────────────────────────────────
    if (req.method === 'GET' && path === '/pvp/match') {
      return json(await svc.findMatch(userId, Number(url.searchParams.get('waitSec') ?? 0)));
    }
    if (req.method === 'POST' && path === '/pvp/resolve') {
      if (!body.ghostId) return json({ error: 'missing_ghost' }, 400);
      return json(await svc.resolveMatch(userId, body.ghostId));
    }
    if (req.method === 'GET' && path === '/pvp/ranking') return json(await svc.ranking());

    // ── Read-mostly ────────────────────────────────────────────────────────
    if (req.method === 'GET' && path === '/season') return json(await svc.season(userId));
    if (req.method === 'GET' && path === '/profile') return json(await svc.profile(userId));
    if (req.method === 'GET' && path === '/codex') return json(await svc.codex(userId));
    if (req.method === 'GET' && seg[0] === 'courses' && seg[2] === 'leaderboard') {
      return json(await svc.courseBoard(decodeURIComponent(seg[1])));
    }

    return json({ error: 'not_found', path }, 404);
  } catch (e) {
    return fail(e);
  }
});
