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

## Rundex 대조 개선 P0~P2 (2026-08-01)
`D:\Rundex`(출시된 러닝 앱)와 대조해 뽑은 계획(`docs/RUNDEX_LESSONS.md`)의 1~7번 실행.

1. **HTTP 타임아웃** — OkHttp 기본값은 read/write/call 무제한이라 서버 무응답 시 "주조 중…"에서
   영영 멈췄습니다. connect15/read30/write30/call60 + retryOnConnectionFailure. 인증 클라이언트도 동일.
2. **GPS 3단 게이트 + 칼만 평활**(`LocationFilter`/`GpsSmoother`) — 그동안 모든 픽스를 무필터로
   받고 있었습니다. 거리가 곧 재화이므로 정지 지터가 철광석·주조 스코어가 됐습니다.
   정확도 게이트(첫 픽스 20m) → 속도 게이트(>10m/s 폐기) → 최소이동(정확도 비례, 도플러 정지 확신 시
   정확도 전체를 노이즈 반경으로). 30초 공백 뒤엔 새 앵커로 rebase.
   **`GpsPoint.gap`** 신설: 공백 복귀 구간은 "달린 것으로 확인되지 않았다"는 뜻이라 거리·페이스·
   안티치트에서 모두 제외합니다(지하철 2km가 철광석이 되던 구멍). 화면엔 "GPS 약함" 3번째 상태 추가.
3. **업로드 재시도 큐 + 진행 중 스냅샷** — 완주한 러닝이 메모리 전용이라 신호 없으면 사라졌습니다.
   `PendingRunStore`(디스크 큐) + `RunUploader`(4xx는 폐기, 전송 실패만 재시도) +
   `ActiveRunStore`(15초마다 스냅샷 → 홈에서 "이어서 저장").
   **서버 멱등성이 선결 조건**이었습니다: `findRunByStart`로 첫 샘플 타임스탬프가 같으면 저장본을
   그대로 돌려줍니다(재시도가 검을 두 자루 만들거나 하루 한도를 두 번 쓰지 않도록).
4. **PARTIAL_WAKE_LOCK + 배터리 최적화 예외 안내** — 도즈에서 기록이 끊기던 위험. 러닝 중에만
   보유(8시간 상한). 예외 안내는 켜질 때까지 세션마다 재안내(OEM 강제종료 대응).
5. **가짜 케이던스·심박 제거** — `sin()`으로 지어낸 케이던스가 서버에서 검 **내구도**가 되고
   있었습니다(= 모든 실제 러닝의 내구도가 사실상 동일). `StepCounter`(TYPE_STEP_DETECTOR)로 실측하고,
   센서·권한이 없으면 **보내지 않습니다**. 엔진은 심박 부재 시 마력을 0이 아니라 **중립값**으로
   처리합니다 — 워치 없는 러너에게 최저 스탯을 주는 건 정직한 게 아니라 그냥 불리한 겁니다.
6. **CrashReporter** — 마지막 스택트레이스를 디스크에 남기고 시스템 핸들러에 위임. 프로필에
   "지난 실행에서 종료되었습니다" 표시(그동안은 앱이 죽어도 볼 수 있는 게 없었습니다).
7. **MotionGuard + 서버 임계 재보정** — 탈것 판정을 러닝 중에 해서 자동 일시정지(30분 뒤 거절 대신).
   서버 `vehicle_suspected`는 **샘플 수 비율 → 거리 비율(30%)**로 바꿨습니다. 샘플 수 기준은 정확히
   틀린 사람을 벌합니다: 픽스는 시간 간격으로 오므로 빠른 러너일수록 짧은 구간이 많아집니다.
   Rundex가 더 엄격한 버전을 배포했다가 "가민 대비 1km 손실" 신고로 되돌린 교훈.

엔진 76 · API 37 · 네이티브 18 테스트. 배포본 라이브 검증: 깨끗한 6km 200 · 1샘플 스파이크 200
(거리 동일) · 선언된 공백 200(2km 제외) · 미선언 텔레포트 422 · 엘리트 3'20"/km 200(탈것 아님) ·
재제출 200 `duplicate:true`.

## GPS 이상치 처리 (2026-07-31)
폰에서 러닝 2건이 연속으로 `gps_jump` 거절 → 컬렉션이 빈 채로 남았습니다. 안티치트가 **단 한 개의
튄 좌표만으로 러닝 전체를 버리고** 있었는데, 콜드 픽스·터널·건물 반사는 실제로 흔합니다.
- `sanitizeTrack` — 마지막 *채택된* 점 기준으로 속도를 재고 불가능한 샘플을 버립니다. dt가 누적되므로
  수신이 잠깐 끊긴 사이 실제로 이동한 거리는 벌점이 없습니다.
- 부정은 그대로 걸립니다: 조작된 경로는 이후 모든 점이 계속 탈락하므로 **연속 3개 이상 탈락**
  또는 **전체의 15% 초과 탈락**이면 `gps_jump`로 거절. 라이브 검증: 1샘플 스파이크 → 200(5.99km,
  뻥튀기된 11km는 제거됨), 지속 텔레포트 → 422 `gps_jump`.
- 서비스는 **원본**을 검증하고(이상치를 봐야 판단이 되므로) 정제된 트랙을 저장·채점합니다.
  코스 지문만 정제본으로 계산해 나쁜 픽스 하나가 익숙한 코스를 새 코스로 만들지 않게 했습니다.
- 앱은 이제 422 본문을 읽어 이유별 안내를 띄웁니다(이전엔 전부 "주조 조건 미충족").

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
