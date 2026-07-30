# 러닝 RPG — HitRace ⚔️

> 달린 경로가 검이 된다 — *The route you run becomes a blade.*

A running-gamification RPG: your GPS route is forged into a unique sword whose **shape** comes from the
path you ran and whose **stats** come from your running metrics (pace, elevation, cadence, heart-rate).
Upgrade with ore, pull materials from a gacha, and battle in spectator auto-combat PvP.
**Zero pay-to-win** — swords come only from running.

Implements the Claude Design spec `러닝 RPG.dc.html` (18 screens) as a production-grade PWA + API,
then extends it with five original enhancements (see below).

## Status — feature-complete & verified

- **All 18 screens** live and playable
- **86 automated tests green**: 60 engine (unit) · 24 API (integration) · 2 Playwright (browser E2E)
- Offline PWA (service worker) · i18n (KR/EN) · accessibility pass · error boundary · haptics
- **PostgreSQL DDL verified end-to-end** on PG 17 (20 tables) · seeded demo account
- Runs with **no database** by default (seeded in-memory repo) — `pnpm dev` and play immediately

## Quick start

```bash
pnpm install
pnpm dev            # API on :8787 (in-memory, seeded) + web on :5173
```
Open **http://localhost:5173** → "데모로 시작하기". No DB, no login setup.

```bash
pnpm -r test                       # engine (60) + API (24)
pnpm --filter @hitrace/web e2e    # browser E2E (2)
```
Full setup (Postgres, prod build, native) is in **[docs/DEPLOY.md](docs/DEPLOY.md)**.
The one page of things needing *you* is **[docs/HANDOFF.md](docs/HANDOFF.md)**.

## Monorepo layout

```
runfight/
├── packages/game-core/   Pure TypeScript engine (route→sword, combat, economy, gacha, fusion,
│                         manual/treadmill, engravings). Zero deps, deterministic, fully unit-tested.
├── apps/api/             Fastify + PostgreSQL REST API. Repository pattern (Postgres + in-memory).
│                         Server-authoritative rewards & anti-cheat.
├── apps/web/             React + Vite + Tailwind PWA (mobile-first). All screens. Real GPS.
├── db/                   PostgreSQL DDL, seed data.
└── docs/                 Decisions, game-design bible, design tokens, screens, ideas, deploy, handoff.
```

## The core loop

1. **Run** (real GPS, or a demo simulation, or manual treadmill entry).
2. **Forge** the route into a sword — shape from GPS geometry, stats from metrics, rarity from achievement.
3. **Collect / dismantle / upgrade** — build ore, enhance blades.
4. **Gacha** ore vein for materials & engravings (never swords).
5. **Engrave** — apply engravings for stat mods & set synergies.
6. **PvP** — spectator auto-battle vs CP-matched ghosts; climb the tiers.
7. **Customize** — forge workshop (cosmetic transforms), part assignment, fusion.
8. **Season pass & profile** — level by km; **명검 도감** codex of every course ever run.

## Extensions beyond the spec (all zero-P2W)

| # | Feature | What it adds |
|---|---|---|
| 1 | **Blade Codex (명검 도감)** | A permanent record of every forged course — survives dismantling. |
| 2 | **Treadmill / no-GPS mode** | Indoor runners forge a procedural blade (capped at SR, codex-excluded). |
| 3 | **Per-course rivalry** | Best-forge-score leaderboard per route — reason to re-run the same course. |
| 4 | **Shareable replay links** | Deterministic combat → a public `/replay/:data` link replays the exact fight. |
| 5 | **Engravings & synergies** | Applyable engravings fold into effective stats/CP; 2-of-a-set → +6% synergy. |

See **[ROADMAP.md](ROADMAP.md)** for the full build log and **[docs/IDEAS.md](docs/IDEAS.md)** for the
enhancement backlog.
