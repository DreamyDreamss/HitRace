# Screen inventory — 18 screens, mapping & build status

Each maps a spec screen → a web route → status. Order of build favors the playable core loop first.

| # | Spec label | Route | Purpose | Status |
|---|---|---|---|---|
| 08 | 온보딩 | `/onboarding` | First-run, permissions, "your route becomes a blade" promise | ⬜ |
| 02 | 러닝 중 | `/run` | Live GPS tracking, real-time forge preview, pace/dist/time | ⬜ |
| 09 | 러닝 요약 | `/run/summary` | Post-run metrics, forge score breakdown, rewards | ⬜ |
| 03 | 주조 결과 | `/forge/:swordId` | Reveal animation, name the sword, share | ⬜ |
| 01 | 홈 | `/` | Dashboard: season, equipped sword, weekly km, daily quest | ⬜ |
| 04 | 컬렉션 | `/collection` | Inventory grid, filters, bulk dismantle | ⬜ |
| 10 | 검 상세 | `/sword/:id` | Stats, engraving slots, equip, dismantle | ⬜ |
| 05 | 강화 | `/sword/:id/upgrade` | Enhance with ore, success %, runner bonus | ⬜ |
| 07 | 가챠 | `/gacha` | Ore vein pulls, pity meter, rates disclosure | ⬜ |
| 11 | 매칭 | `/pvp` | CP-band matching, widen→ghost fallback | ⬜ |
| 06 | PvP 전투 | `/pvp/:matchId` | Spectator auto-battle, skip/speed, event staging | ⬜ |
| 12 | 전투 결과 | `/pvp/:matchId/result` | RP delta, tier progress | ⬜ |
| 13 | 랭킹 | `/ranking` | Tier ladder, leaderboard, per-course rivalry (idea) | ⬜ |
| 16 | 주조 공방 | `/forge/:id/workshop` | Path placement: rotate/flip/mirror/scale (cosmetic) | ⬜ |
| 17 | 부위 지정 | `/forge/:id/parts` | Cut route timeline → blade/guard/handle | ⬜ |
| 18 | 합주조 | `/forge/fusion` | Combine 2–3 routes' parts, −10% penalty | ⬜ |
| 14 | 시즌 패스 | `/season` | Free/premium tracks, km-leveled | ⬜ |
| 15 | 프로필 | `/profile` | Stats, history, settings, codex (idea) | ⬜ |

Shared chrome: bottom nav (홈 · 러닝 · 컬렉션 · 대전 · 상점) present on 01/04/11/store; modal/stack for detail flows.
