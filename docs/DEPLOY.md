# Deploy & Run Guide

Everything needed to run HitRace locally and to ship it. Local dev needs **no database**
(seeded in-memory repo); production uses PostgreSQL.

## 1. Local development (no DB)

```bash
pnpm install
pnpm dev            # API on :8787 (in-memory, seeded) + web on :5173
```
Open http://localhost:5173 → "데모로 시작하기". Everything is playable immediately.

Run the tests:
```bash
pnpm -r test        # game-core (47) + api (20)
pnpm -r typecheck
```

## 2. Local development with PostgreSQL

```bash
createdb hitrace
psql "postgresql://postgres:<PW>@localhost:5432/hitrace" -f db/schema.sql
psql "postgresql://postgres:<PW>@localhost:5432/hitrace" -f db/seed.sql

# apps/api/.env
echo 'DATABASE_URL=postgresql://postgres:<PW>@localhost:5432/hitrace' > apps/api/.env
pnpm dev
```
The API auto-detects `DATABASE_URL` and switches from in-memory to Postgres (logged on boot).

## 3. Production build

**Web** (static PWA — deploy `apps/web/dist` to any static host / CDN; it's a SPA so route all
paths to `index.html`):
```bash
pnpm --filter @hitrace/web build
# set VITE_API_BASE to your API origin at build time, e.g.
VITE_API_BASE=https://api.hitrace.app pnpm --filter @hitrace/web build
```

**API** (Node service):
```bash
pnpm --filter @hitrace/api build      # or run directly with tsx
node --import tsx apps/api/src/index.ts # honours PORT, DATABASE_URL, CORS_ORIGIN
```
Env: `PORT` (default 8787), `DATABASE_URL`, `CORS_ORIGIN` (set to your web origin in prod).

Recommended: API behind a reverse proxy at `https://api.<domain>`, web served from `https://<domain>`,
`CORS_ORIGIN=https://<domain>`, and build the web with `VITE_API_BASE=https://api.<domain>`.

## 4. PWA / installable

The web build ships a manifest + service worker (`/sw.js`): app-shell precache, offline-capable,
"Add to Home Screen" installs it. No extra steps.

## 5. Native app (Capacitor — additive, for the app stores)

The native wrapper reuses `apps/web/dist` verbatim. See `apps/web/capacitor.config.ts` for the
commands. This unlocks background GPS and health-sensor plugins (real cadence/HR) beyond what the
browser exposes.

## 6. What's stubbed for launch (wire before commercial release)

- **Auth**: dev bearer-token provider. Swap for Apple/Google/Kakao (slot in `apps/api/src/server.ts`
  `requireAuth` + `users.auth_provider/subject`).
- **Payments**: season-pass/skins are a mock checkout. Wire Play Billing / App Store IAP.
- **Live PvP**: currently async "ghost" battles (matches the spec's fallback). Add a socket layer for
  synchronous matches when concurrency justifies it.
- **Push**: retention hooks (rusted-blade, weekly) are specced; wire a push provider + job queue.
- **Sensors**: cadence/HR are synthesised in-browser; real streams come via the Capacitor health plugin.
