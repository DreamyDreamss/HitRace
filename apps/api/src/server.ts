// Fastify app builder. Pure of process concerns so tests can `inject()` against it.

import cors from '@fastify/cors';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import type { Repo } from './db/repo.js';
import { GameService, ServiceError } from './service.js';

export interface BuildOpts {
  repo: Repo;
  corsOrigin?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

export function buildServer(opts: BuildOpts): FastifyInstance {
  const app = Fastify({ logger: false });
  const svc = new GameService(opts.repo);

  // Tolerate an empty body on POSTs that carry content-type: application/json
  // (e.g. equip). Default Fastify rejects these with FST_ERR_CTP_EMPTY_JSON_BODY.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || (body as string).trim() === '') return done(null, {});
    try { done(null, JSON.parse(body as string)); } catch (e) { done(e as Error, undefined); }
  });

  app.register(cors, { origin: opts.corsOrigin ?? '*' });

  // Dev auth: `Authorization: Bearer <userId>`. Replace with real provider later (see DECISIONS D5).
  const requireAuth = async (req: FastifyRequest, reply: FastifyReply) => {
    const h = req.headers.authorization;
    const token = h?.startsWith('Bearer ') ? h.slice(7) : undefined;
    if (!token) return reply.code(401).send({ error: 'unauthenticated' });
    const user = await opts.repo.getUser(token);
    if (!user) return reply.code(401).send({ error: 'invalid_token' });
    req.userId = user.id;
  };

  const handle = (reply: FastifyReply, e: unknown) => {
    if (e instanceof ServiceError) return reply.code(e.status).send({ error: e.code });
    reply.code(500).send({ error: 'internal', detail: (e as Error).message });
  };

  // ── Health ─────────────────────────────────────────────────────────────────
  app.get('/health', async () => ({ ok: true, service: 'hitrace-api' }));

  // ── Auth (dev) ───────────────────────────────────────────────────────────────
  app.post('/auth/dev/login', async (req, reply) => {
    const { handle: h } = (req.body ?? {}) as { handle?: string };
    const handle = (h ?? 'demo').trim();
    const existing = await opts.repo.getUserByHandle(handle);
    if (existing) return { token: existing.id, user: existing };
    // Dev repos hand out fresh accounts so a new runner can start; the Postgres repo does not
    // (real sign-up belongs to the auth provider — docs/OPEN_DECISIONS.md §2).
    if (!handle || !opts.repo.createUser) return reply.code(404).send({ error: 'no_user' });
    const created = await opts.repo.createUser(handle);
    return { token: created.id, user: created };
  });

  // ── Me / dashboard ───────────────────────────────────────────────────────────
  app.get('/me', { preHandler: requireAuth }, async (req, reply) => {
    try { return await svc.me(req.userId!); } catch (e) { return handle(reply, e); }
  });

  app.get('/wallet', { preHandler: requireAuth }, async (req, reply) => {
    try { return await svc.wallet(req.userId!); } catch (e) { return handle(reply, e); }
  });

  // ── Runs ─────────────────────────────────────────────────────────────────────
  app.post('/runs', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const body = (req.body ?? {}) as { track?: unknown; forge?: boolean; name?: string };
      if (!body.track) return reply.code(400).send({ error: 'missing_track' });
      const out = await svc.submitRun(req.userId!, body.track as any, { forge: body.forge ?? true, name: body.name });
      return out;
    } catch (e) { return handle(reply, e); }
  });

  app.post('/runs/manual', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { distanceKm, paceSecPerKm, name } = (req.body ?? {}) as { distanceKm?: number; paceSecPerKm?: number; name?: string };
      if (!distanceKm || !paceSecPerKm) return reply.code(400).send({ error: 'missing_inputs' });
      return await svc.manualRun(req.userId!, Number(distanceKm), Number(paceSecPerKm), name);
    } catch (e) { return handle(reply, e); }
  });

  // ── Running log ──────────────────────────────────────────────────────────────
  app.get('/runs', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const limit = Number((req.query as any)?.limit ?? 50);
      return await svc.listRuns(req.userId!, limit);
    } catch (e) { return handle(reply, e); }
  });
  app.get('/runs/:id', { preHandler: requireAuth }, async (req, reply) => {
    try { return await svc.runDetail(req.userId!, (req.params as any).id); } catch (e) { return handle(reply, e); }
  });
  app.get('/stats/running', { preHandler: requireAuth }, async (req, reply) => {
    try { return await svc.runningStats(req.userId!); } catch (e) { return handle(reply, e); }
  });

  // ── Swords ───────────────────────────────────────────────────────────────────
  app.get('/swords', { preHandler: requireAuth }, async (req, reply) => {
    try { return await svc.listSwords(req.userId!); } catch (e) { return handle(reply, e); }
  });
  app.get('/swords/:id', { preHandler: requireAuth }, async (req, reply) => {
    try { return await svc.getSword(req.userId!, (req.params as any).id); } catch (e) { return handle(reply, e); }
  });
  app.post('/swords/:id/equip', { preHandler: requireAuth }, async (req, reply) => {
    try { return await svc.equip(req.userId!, (req.params as any).id); } catch (e) { return handle(reply, e); }
  });
  app.post('/swords/:id/upgrade', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const weeklyKm = Number((req.body as any)?.weeklyKm ?? 0);
      return await svc.upgrade(req.userId!, (req.params as any).id, weeklyKm);
    } catch (e) { return handle(reply, e); }
  });
  app.post('/swords/:id/engrave', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { slot, engravingId } = (req.body ?? {}) as { slot?: number; engravingId?: string };
      if (slot == null || !engravingId) return reply.code(400).send({ error: 'missing_inputs' });
      return await svc.applyEngraving(req.userId!, (req.params as any).id, Number(slot), engravingId);
    } catch (e) { return handle(reply, e); }
  });

  app.post('/swords/dismantle', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const ids = ((req.body as any)?.swordIds ?? []) as string[];
      if (!ids.length) return reply.code(400).send({ error: 'no_swords' });
      return await svc.dismantle(req.userId!, ids);
    } catch (e) { return handle(reply, e); }
  });

  // ── Gacha ────────────────────────────────────────────────────────────────────
  app.post('/gacha/pull', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const count = ((req.body as any)?.count ?? 1) === 10 ? 10 : 1;
      return await svc.gacha(req.userId!, count as 1 | 10);
    } catch (e) { return handle(reply, e); }
  });

  // ── PvP ──────────────────────────────────────────────────────────────────────
  app.get('/pvp/match', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const waitSec = Number((req.query as any)?.waitSec ?? 0);
      return await svc.findMatch(req.userId!, waitSec);
    } catch (e) { return handle(reply, e); }
  });
  app.post('/pvp/resolve', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const ghostId = (req.body as any)?.ghostId as string;
      if (!ghostId) return reply.code(400).send({ error: 'missing_ghostId' });
      return await svc.resolveMatch(req.userId!, ghostId);
    } catch (e) { return handle(reply, e); }
  });
  app.get('/pvp/ranking', { preHandler: requireAuth }, async (req, reply) => {
    try { return await svc.ranking(); } catch (e) { return handle(reply, e); }
  });

  // ── Season / Profile ─────────────────────────────────────────────────────────
  app.get('/season', { preHandler: requireAuth }, async (req, reply) => {
    try { return await svc.season(req.userId!); } catch (e) { return handle(reply, e); }
  });
  app.get('/profile', { preHandler: requireAuth }, async (req, reply) => {
    try { return await svc.profile(req.userId!); } catch (e) { return handle(reply, e); }
  });
  app.get('/codex', { preHandler: requireAuth }, async (req, reply) => {
    try { return await svc.codex(req.userId!); } catch (e) { return handle(reply, e); }
  });
  app.get('/courses/:hash/leaderboard', { preHandler: requireAuth }, async (req, reply) => {
    try { return await svc.courseBoard((req.params as any).hash); } catch (e) { return handle(reply, e); }
  });

  // ── Forge craft (cosmetic reforge) ────────────────────────────────────────────
  app.post('/swords/:id/reforge', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const shape = (req.body as any)?.shape;
      if (!shape) return reply.code(400).send({ error: 'missing_shape' });
      return await svc.reforge(req.userId!, (req.params as any).id, shape);
    } catch (e) { return handle(reply, e); }
  });

  app.post('/forge/fusion', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { swordIds, name } = (req.body ?? {}) as { swordIds?: string[]; name?: string };
      if (!swordIds || swordIds.length !== 2) return reply.code(400).send({ error: 'need_two_swords' });
      return await svc.fusion(req.userId!, swordIds[0]!, swordIds[1]!, name);
    } catch (e) { return handle(reply, e); }
  });

  return app;
}
