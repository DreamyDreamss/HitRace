// Entry point. Picks Postgres if DATABASE_URL is set, otherwise the seeded in-memory repo.

import { loadConfig } from './config.js';
import { MemoryRepo } from './db/memory.js';
import type { Repo } from './db/repo.js';
import { buildServer } from './server.js';

async function main() {
  const cfg = loadConfig();
  let repo: Repo;
  if (cfg.databaseUrl) {
    const { PgRepo } = await import('./db/pg.js');
    repo = new PgRepo(cfg.databaseUrl);
    console.log('[hitrace-api] using PostgreSQL repository');
  } else {
    repo = new MemoryRepo(true);
    console.log('[hitrace-api] using in-memory repository (seeded demo account, no DB)');
  }

  const app = buildServer({ repo, corsOrigin: cfg.corsOrigin });
  await app.listen({ port: cfg.port, host: '0.0.0.0' });
  console.log(`[hitrace-api] listening on http://localhost:${cfg.port}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
