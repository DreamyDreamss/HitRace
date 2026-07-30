# Build Roadmap — live status

Autonomous push to commercial quality. Loop mode advanced one milestone per iteration.
Legend: ✅ done · 🔨 in progress · ⬜ queued

> **STATUS 2026-07-28 — COMPLETE & AT REST.** Full 18-screen spec + commercial hardening + 7 original
> enhancements. **88 tests green** (62 engine · 24 API · 2 E2E). Verified live on **both** the seeded
> in-memory repo and **real PostgreSQL 17** (3 DB-path bugs found & fixed during QA sweeps). Runs with
> no DB via `pnpm dev`. The autonomous loop was **stopped** after 22 iterations once the enhancement
> backlog was exhausted and a confirming QA sweep came up clean. Restart anytime with `/loop`.
> Nothing blocks the user — see `docs/HANDOFF.md`.

## Milestone 0 — Foundation (Day 1 AM) ✅ COMPLETE & VERIFIED
- ✅ Design spec imported & analyzed (18 screens, full mechanics)
- ✅ Decision log, game-design bible, design tokens, screen map, roadmap
- ✅ Monorepo scaffold (pnpm workspaces, TS) — installs clean
- ✅ `game-core` engine + TDD: conversion, rarity, stats, combat, economy, gacha, matching, anti-cheat — **40 tests pass, clean strict typecheck**
- ✅ PostgreSQL DDL + seed — **verified end-to-end on real PG 17 (18 tables, demo account seeded)**

## Milestone 1 — Backend (Day 1 PM) ✅ COMPLETE & VERIFIED
- ✅ Fastify API + repository pattern (in-memory default, seeded; Postgres impl ready)
- ✅ Endpoints: auth(dev), /me dashboard, wallet, runs(submit→forge), swords, equip, dismantle, upgrade, gacha pull(1/10), pvp match+resolve, ranking
- ✅ Server-authoritative rewards (daily ore cap, weekly stone cap, forge cap 2/day, ticket rules) — client never mints its own
- ✅ 15 integration tests pass · clean typecheck · **boots & serves real HTTP verified**
- ⬜ (deferred, additive) season-pass & profile endpoints, engraving apply, fusion — build alongside their screens

## Milestone 2 — Web shell & design system (Day 1 PM → Day 2 AM) ✅ COMPLETE & VERIFIED
- ✅ Vite + React + Tailwind, design tokens (exact from spec), PWA manifest + service worker + icon
- ✅ Shared UI kit (Button, Card, StatBars, RarityChip, CurrencyPill, SectionTitle, Spinner) + **BladeSvg** (renders sword from GPS shape) + DeviceShell + BottomNav
- ✅ Router (tab + stack layouts, all 18 routes registered), Zustand session store, typed API client, auth gate/login
- ✅ Home screen (01) fully built on live `/me` + `/pvp/ranking` data
- ✅ **Verified: clean typecheck, production build (264kB/86kB gz), API↔web proxy wiring works end-to-end**

## Milestone 3 — Screens (Day 2) ✅ COMPLETE — all 18 screens live & verified
Order chosen so the core loop is playable end-to-end ASAP:
- ✅ 08 Onboarding → 02 Running(live GPS + sim) → 09 Summary → 03 Forge result  (**run→sword spine — playable & verified e2e**)
- ✅ 01 Home dashboard (done in M2)
- ✅ 04 Collection (grid, filters, multi-select bulk dismantle) → 10 Sword detail/engrave (equip/dismantle) → 05 Upgrade (odds + runner bonus, live deltas)
- ✅ 07 Gacha (pity meter, rates disclosure, 1/10 pull, reveal)
- ✅ 11 Matching (animated CP-band widen → ghost) → 06 PvP auto-battle (spectator replay of combat log, HP bars, crit/skill floats, ×1/2/4 speed + skip) → 12 Result (RP/tier, folded into battle end) → 13 Ranking (tier ladder + leaderboard)
- ✅ 14 Season pass (km-leveled track, premium CTA) · 15 Profile (aggregates, collection breakdown, settings) — new `/season` `/profile` endpoints, season levels by km on each run
- ✅ 16 Forge workshop (cosmetic rotate/flip/mirror/scale, live blade preview, persists via `/reforge`, stats untouched) — added `BladeTransform` to engine + BladeSvg honors it
- ✅ 17 Part assign (route-timeline cut → blade/guard/handle, persisted) · 18 Fusion forge (pick 2 SR+, live −10% preview, consumes both → new sword) + engine `fuseSwords`/`validateFusion` (7 tests) + `/forge/fusion` endpoint
- ✅ Bug caught & fixed: empty-body POST (equip) → 400; fixed client + hardened server, regression tests added (API suite now 20)

## Milestone 4 — Polish & commercial hardening (Day 3) ✅ COMPLETE — commercial-ready core
- ✅ Global toast system + haptics (Vibration API, reduced-motion aware) wired into forge/upgrade/gacha/battle + every Button
- ✅ **Offline run-queue** — network-fail on submit → queue locally, auto-sync on reconnect (server stays authoritative)
- ✅ Route-level code-splitting (16 lazy chunks; initial JS 324→272 kB) + Suspense fallbacks
- ✅ Reveal-animation polish — forge spark + forgeIn, gacha card pop-stagger, combat hit-shake
- ✅ React **ErrorBoundary** (no white-screens; recoverable fallback)
- ✅ Full offline **service worker** — app-shell precache, network-first navigations w/ shell fallback, cache-first assets, API never cached (validated + shipped in dist)
- ✅ i18n scaffold (`i18n/index.ts`, KR default + EN stub, locale store, nav wired, language toggle in Profile)
- ✅ a11y pass — aria-labels/aria-current on nav, focus-visible rings on buttons & nav, aria-hidden on decorative icons
- ✅ Capacitor wrapper config (`apps/web/capacitor.config.ts`) + **`docs/DEPLOY.md`** (local/DB/prod/PWA/native/what's-stubbed)
- ✅ **Playwright E2E** — full loop (login→home→sim run→summary→forge→result→home) + collection, **2 tests pass in real Chromium** (`pnpm --filter @hitrace/web e2e`)

### ✅ Commercial-ready checkpoint (2026-07-28)
All 18 screens · engine 47 tests · API 20 tests · E2E 2 tests · PWA offline · i18n · a11y · Postgres DDL verified · deploy guide. The base spec is fully realised and hardened.

## Milestone 5 — Enhancements beyond the spec (remaining window)
Folding in `docs/IDEAS.md` (each vetted: deepens run→sword, zero P2W).
- ✅ Blade Codex (도감) — persists every forged course even after dismantle. `codex_entries` table (DDL verified, 19 tables) + `/codex` endpoint + screen (from Profile). API tests 20→21 (survives-dismantle covered).
- ✅ No-GPS / treadmill mode — manual distance+pace → procedural blade, capped at SR, no ticket, codex-excluded (engine 47→54 tests; `/runs/manual` + ManualRun screen; live-verified)
- ✅ Per-course rivalry leaderboards — best forge-score per courseHash (`course_leaderboard` table verified, 20 tables; `/courses/:hash/leaderboard` + CourseBoard screen from Codex; API 22 tests). Demo codex seeded too.
- ✅ Shareable deterministic replay links — public `/replay/:data` re-simulates a match identically; "리플레이 공유" on battle result; shared `CombatStage` extracted
- ✅ Engraving apply flow + set synergies — applyable engravings (spend stones), fold into effective stats/CP + combat, +6% set bonus; picker on SwordDetail; pg persists to sword_engravings; engine 54→60 tests, API 24 tests
- ✅ Consolidation pass — README refreshed to feature-complete; HANDOFF updated; **full suite re-verified: 60 engine + 24 API + 2 E2E all green, typechecks + build clean**; visual handoff artifact for the user
- ✅ Whetstone streak — consecutive-day running raises upgrade odds (+1%/day, cap +7%); 🔥 badge on Home + Upgrade; engine 60→62 tests; users DDL change verified
- ✅ Rust patina — idle blades dull & rust; a run polishes them (spec's comeback hook, zero penalty); `BladeSvg patina` prop + Home 🌫️ hint
- ⏹ Forge share card — deliberately skipped: redundant with the shipped replay-share link (logged in IDEAS)

### QA sweep — 2 production-breaking PgRepo bugs found & fixed (2026-07-28)
First live test of the **PostgreSQL repository** (all automated tests use in-memory) caught two bugs the
in-memory path structurally hides:
- **Non-UUID entity ids** — `id()` generated `run_xxx`/`sword_xxx` strings inserted into `uuid` PK columns → forge crashed on real DB. Fixed: `randomUUID()`.
- **Float CP bounds** — `findGhostInBand` passed `858.5` into an `int` column param → PvP match crashed. Fixed: floor/ceil.
- **Unrounded `durationSec`** — `(lastTs−firstTs)/1000` (float for real GPS) inserted into `duration_sec` INT → forge would crash on any real run. Fixed: `Math.round`. (Verified with fractional-timestamp forge.)
Now **verified**: full PgRepo path (forge · pvp · upgrade · engrave · gacha · codex · manual · fusion · season · profile · leaderboard) runs clean against live PG 17. No in-memory regression (24 API tests green).

### High-value backlog complete (2026-07-28)
Full 18-screen spec + M4 hardening + **7 original systems** (codex · treadmill · rivalry · replay links · engravings · whetstone streak · rust patina), all zero-P2W. Loop pivots to periodic QA/bug-hunt sweeps rather than new cosmetic features.

## New ideas layered in beyond the spec (my additions — see docs/IDEAS.md)
- ⬜ Curated as the loop progresses; each vetted against "does it deepen run→sword without P2W?"

---
_Last updated: 2026-07-28 (M0 in progress)._
