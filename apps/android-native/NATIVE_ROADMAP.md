# Native (Kotlin/Compose) port — screen roadmap

Full rewrite of the client UI in Kotlin + Jetpack Compose. Backend (Fastify) + PostgreSQL +
game-core logic reused unchanged. Android-only. Verified on the `rundex35` emulator each step.
Legend: ✅ done · 🔨 in progress · ⬜ queued

## Infra
- ✅ Gradle/AGP/Kotlin2.0/Compose scaffold, dark 대장간 theme, Retrofit API, DataStore auth, BladeCanvas
- ✅ Navigation (NavHost + 5-tab bottom nav, Canvas icons) — verified on emulator

## Screens (18) — core loop first
- ✅ 08→(login) · 01 Home (+ 러닝 시작 CTA)
- ✅ 04 Collection (grid, Canvas blades) · 13 Ranking (tier ladder + board) · 15 Profile (aggregates) — verified on emulator
- ✅ 02 Running (FusedLocation GPS + sim) → 09 Summary → 03 Forge reveal — core loop verified on emulator
- ✅ 10 Sword detail (equip/dismantle/engrave sheet) · 05 Upgrade (odds+delta preview) · 07 Gacha (pity, 10-pull)
- ✅ 11 Matching (band poll) → 06 Battle (HP drain, shake, ×1/2/4, skip) → 12 Result (RP) — verified
- ✅ 14 Season (pass level + reward track) · 명검 도감 codex — verified (entries from Profile)
- ✅ 16 Workshop (rotate/flip/mirror/scale, persisted) · 17 Parts (timeline cut) · 18 Fusion (−10% preview) — verified
- ✅ 실내 러닝 (manual/treadmill, `/runs/manual`) — verified: 5km @5'30" → procedural R blade

- ✅ 코스 라이벌 board (tap a codex entry) — verified

**18/18 spec screens are native**, plus codex, treadmill mode and the course rivalry board.
Shareable replay links are the only web feature left and are **blocked on a hosting decision**
(see `docs/OPEN_DECISIONS.md` §4). Next: QA sweep (empty/error states, long names, a11y) and a
consistency check between `data/Balance.kt` and `packages/game-core`.

## 러닝 로그 (2026-07-31, "러닝 앱다운 기능" 요청)
게임(검)만 있고 정작 달린 기록이 안 보인다는 지적에서 시작. 6번의 이터레이션:
1. **기록 저장** — `runs.track`에 `'{}'`만 넣고 있었습니다. 300점 다운샘플 경로를 실제로 저장.
   game-core `computeSplits`(km 경계 보간, 희소 샘플 대응) + `service.listRuns/runDetail/runningStats`.
2. **화면** — 러닝 기록 목록 / 상세(경로·구간 페이스 막대·주조한 검) / 통계(이번주 vs 지난주,
   12주 추이, 누적, 개인기록 5종) + 홈 이번 주 카드.
3. **주간 목표 + 개인기록** — `users.weekly_goal_km`, 통계 화면 프리셋 탭, 홈 진행률.
   러닝 저장 *전에* 과거와 비교해 PB 플래그 → 주조 화면 🏆 배지.
4. **코스 비교** — 같은 코스 몇 회차·직전 대비 초·코스 최고 기록 배지. 홈 최근 러닝 3건,
   기록 월별 그룹(월 합계).
5. **프로필 재구성** — 누적 거리/시간/평균 페이스가 최상단, PB 3종, 검은 COLLECTION으로.
   러닝 상세에 고도 그래프(x축은 누적 거리).
6. **목표 보상 + 랩 페이스** — 목표를 넘긴 러닝이 보너스 지급(교차 자체가 멱등 키),
   러닝 중 "현재 1km 페이스".

엔진 69 · API 34 · 네이티브 9 테스트. 모두 Supabase에 배포·검증 완료.

## Background run tracking (2026-07-29, user decision §7)
- `service/RunTrackingService` — a `location`-typed foreground service owns FusedLocation and the
  demo simulation; `data/RunTracker` is the process-wide state the UI observes. The Running screen
  is now just controls + a view of that state, so a run survives navigation, backgrounding and
  screen-off. Ongoing notification shows live distance/time/pace and taps back into the app.
- Verified on the emulator: with the app backgrounded **and the screen off**, injected fixes kept
  accumulating (0.16km → 0.56km); service stayed `isForeground=true types=location`; finishing the
  run stopped the service and removed the notification. Demo-sim → forge loop re-verified.
- No `ACCESS_BACKGROUND_LOCATION` (service starts from a visible screen) — deliberately, to keep
  Play review simple. Paused state gained a "이 러닝 버리기" action since runs now outlive the screen.

## QA sweep (2026-07-29)
- `app/src/test/.../BalanceParityTest.kt` (9 tests) checks `data/Balance.kt` against fixtures
  generated from game-core itself: `cd apps/api && node --import tsx ../../apps/android-native/tools/gen-balance-fixture.mjs`.
  Run with `./gradlew.bat :app:testDebugUnitTest`.
- Login now takes a runner name (spec screen 08 온보딩) instead of hard-coding `demo`.
- Fixed: every login failure claimed "서버가 꺼져 있음" even when the server answered 404 →
  HTTP errors and transport errors now say different things.
- Fixed: empty 보관함 was a blank screen → empty state + "첫 검" CTA.
- API: `/auth/dev/login` used to 404 unknown handles, so a new player could never start.
  The **in-memory (dev) repo** now creates the account; Postgres deliberately does not
  (real sign-up is decision §2). +2 API tests (26 total).
- Small-screen/large-font sweep (720×1280 @ sw360 · font_scale 1.3): home, collection, detail,
  upgrade, matching, battle and the result panel all hold up. **One real break found and fixed:**
  the login screen didn't scroll, so at that size the sign-in button was unreachable — it now
  scrolls and the hero blade scales to 30% of window height.
- a11y: back/"more" links were bare clickable `Text` (small targets, no role). They now go through
  `LinkText` — 48dp target, announced as a button — and bottom-nav items carry `Role.Tab` +
  selected state.

## Fixed along the way
- Workshop → 부위 지정 → back lost the in-progress transform (Navigation-Compose disposes the
  screen), so "이대로 주조" saved an empty one → `CraftSession` holds it across the hop.
- Retrofit JSON needed `encodeDefaults = true`; without it a default-valued transform serialised
  to `{}` and the server stored nothing.
- Demo run used wall-clock timestamps → server anti-cheat rejected the forge. Sim now compresses
  ~30 min into the timeline (5'00"/km) and duration is derived from point timestamps.
- Edge-to-edge insets: content ran under the status bar; bottom-nav labels were clipped by the
  gesture bar (`navigationBarsPadding()` must come before `height()`).

## Notes
- API_BASE = http://10.0.2.2:8787 (emulator). Phone build: `-PAPI_BASE=http://<LAN-IP>:8787`.
- API server: `cd apps/api && PORT=8787 node --import tsx src/index.ts` (in-memory seeded).
