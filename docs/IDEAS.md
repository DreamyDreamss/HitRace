# Enhancement ideas — layered in beyond the spec

The user asked me to continuously fold in improvements and new ideas. Each is vetted against one
question: **does it deepen the run→sword loop without introducing pay-to-win?** Status is tracked here
and promoted into ROADMAP when scheduled.

Legend: 💡 proposed · 🔨 building · ✅ shipped · ❌ rejected (with reason)

## Retention / meaning
- ✅ **Blade codex / "명검 도감"** — SHIPPED (iter 13). Persists every forged course (thumbnail, best
  rarity/CP, times forged) even after dismantling. `codex_entries` table + `/codex` endpoint + screen
  (entry from Profile). Records on forge; survives dismantle (API-tested). Turns deleting a duplicate
  into a memory kept.
- 💡 **Seasonal "course of the week"** — a featured real-world route; running anything topologically
  similar grants a themed engraving. Drives exploration, the spec's core retention lever.
- ✅ **Rust mechanic done kindly** — SHIPPED (iter 20). Idle blades gain a visual patina (desaturate +
  rust flecks, scaling with idle days past 2); a run polishes it off. Home shows 🌫️ "검이 녹슬고
  있습니다 · 달리면 광이 납니다". Purely cosmetic — zero stat penalty. `BladeSvg patina` prop.

## Depth without power creep
- ✅ **Whetstone streak** — SHIPPED (iter 19). Consecutive-day running raises upgrade success
  (+1%/day, cap +7%). Engine `nextStreak`/`streakBonus` (+2 tests → 62). User streak fields
  (memory+pg+DDL, verified), bumped on every run, used in upgrade odds. 🔥 badge on Home + streak
  line on Upgrade. Rewards habit, not wallet.
- 💡 **Ghost of your past self** — PvP "practice" against a snapshot of your own best sword from a prior
  season. Nostalgic, and reuses the ghost system verbatim.
- ✅ **Route rivalries** — SHIPPED (iter 15). Async leaderboard per courseHash (best forge-score + CP).
  `course_leaderboard` table (DDL verified, 20 tables) + `/courses/:hash/leaderboard` + CourseBoard
  screen (tap a codex entry). Recorded on GPS forge; seeded with rivals. "나" row highlighted. Makes the
  same course worth re-running. Also seeded the demo's codex (3 courses) so both features feel alive.

## Craft / expression (the spec's customization pillar)
- ✅ **Engraving apply flow + synergies** — SHIPPED (iter 17). Closed the spec gap (engravings were
  shown but not applyable). Catalog + `effectiveStats`/`activeSynergies` in engine (6 tests). Apply via
  `/swords/:id/engrave` (spends engrave stones by rarity), folds flat mods into effective stats & CP,
  matters in combat. **Two engravings of a set → +6% synergy** (e.g. 새벽의 결). Picker sheet on
  SwordDetail + synergy badge. pg persists to `sword_engravings`. API 24 tests.
- 💡 **Forge replay share card** — an auto-generated shareable image: your route morphing into the blade,
  with stats. Organic acquisition loop; the spec already frames sharing on screen 03.

## Accessibility / inclusivity
- ✅ **Treadmill / no-GPS mode** — SHIPPED (iter 14). Manual distance+pace → procedural seeded blade.
  Guardrails verified: capped at SR (never LEGEND), `procedural` flag, no 眞 양날, ore but no forge
  ticket, excluded from the codex. `forgeManual`/`generateProceduralTrack` (7 engine tests) +
  `/runs/manual` + `ManualRun` screen (from Running). Indoor runners included without diluting GPS prestige.
- 💡 **Colorblind-safe rarity** — rarity encoded by shape/label too, not color alone.

## Technical / commercial hardening
- 💡 **Offline-first run recording** — queue runs locally, sync + server-validate on reconnect (runners
  lose signal). Real reliability win.
- ✅ **Deterministic combat replays as URLs** — SHIPPED (iter 16). Resolve returns a 234-byte replay
  payload (seed + both combatant snapshots); `lib/replay.ts` encodes it base64url into `/replay/:data`,
  a **public (no-login)** route that re-simulates via game-core (identical by determinism) and plays
  through the shared `CombatStage`. "리플레이 공유" button uses Web Share/clipboard. Near-free virality.

---
Rejections will be logged here with reasoning so the trail is auditable.
