# Architecture & Product Decisions

The user delegated all decision-making ("전권위임") for a 3-day autonomous push to commercial quality.
This log records every non-obvious call so the choices are auditable when they return.

## D1 — Stack

| Layer | Choice | Why |
|---|---|---|
| Repo | pnpm workspaces monorepo + TS project refs | One install, shared types between web/api/core. |
| Engine | `packages/game-core` — pure TS, zero deps | Route→sword, combat, economy live in one place, testable without a DB or browser. This is the product's soul; it must be bulletproof and TDD'd. |
| API | Fastify + TypeScript + `pg` | Fast, typed, minimal. Repository pattern: Postgres impl for prod, in-memory impl for tests/demo so the app runs before the DB is provisioned. |
| DB | PostgreSQL 17 | `psql 17` is already installed on the machine. User explicitly asked for DDL to run in one go. |
| Web | React + Vite + TypeScript + Tailwind, PWA | Mobile-first. Real `navigator.geolocation` works in mobile browsers today → we can demo true GPS→sword without native builds. Installable as a PWA; a Capacitor wrapper is a later, additive step (see D6). |
| State | Zustand (client) + TanStack Query (server cache) | Lightweight, no boilerplate. |
| Auth | Dev: seeded demo user + JWT. Prod-ready: pluggable provider (see D5). | Keeps the loop unblocked; real OAuth is an additive slot. |

## D2 — Why web/PWA before native

GPS is the core mechanic and native (Capacitor/Expo) is the eventual home. But a native toolchain
can't be verified autonomously on this Windows box without an emulator/device. The **game logic and
the entire UI are platform-agnostic** — building web-first means every screen, formula, and API is
real and testable now, and wrapping in Capacitor later is a thin shell (it reuses `apps/web` verbatim).
No work is thrown away.

## D3 — Fidelity to the design spec

The `.dc.html` is a canvas spec (static mockups). We reproduce its **design tokens exactly** (colors,
type scale, spacing, the Pretendard + IBM Plex Mono pairing) and its **information architecture**, but
turn the static screens into a live app. The design tokens are lifted verbatim into `packages/tokens`
(see `docs/DESIGN_TOKENS.md`). Screen inventory & mapping: `docs/SCREENS.md`.

## D4 — Game balance is data, not code

Every tunable (currency caps, drop rates, upgrade cost curve, combat coefficients, rarity thresholds)
lives in `packages/game-core/src/config/balance.ts` as a single typed object, and the economically
sensitive ones are *also* mirrored into the DB (`balance_config` table) so they can be tuned in prod
without a redeploy. Formulas reference the config; nothing is a magic number.

## D5 — Anti-cheat is first-class

Because rewards are achievement-based (not RNG), a runner who spoofs GPS mints free legendaries.
The engine ships a `validateRun()` gate (min distance/time, pace ceiling, GPS-jump detection,
teleport/vehicle heuristics, same-route decay) that the *server* runs authoritatively — the client
never decides its own rewards. See `docs/ANTICHEAT.md`.

## D6 — Deferred / additive (not blocking commercial core)

- Capacitor native wrapper (reuses web build).
- Real social auth (Apple/Google/Kakao) — slot exists.
- Real-time PvP via async "ghost" records first (matches the spec's fallback), live socket later.
- Push notifications (retention hooks are specced; wired as a job queue stub now).

## Open questions parked for the user (non-blocking — sensible defaults chosen)

1. Target market / store (Play Store KR first is assumed).
2. Real payment provider for the season pass (stubbed as a mock checkout).
3. Map tile provider for route rendering (using self-drawn SVG from GPS, no paid tiles needed).
