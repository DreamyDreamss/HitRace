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

## 주요 동작이 화면 밖으로 밀려나지 않게 (2026-08-01)
"러닝하고 주조하고 그다음 화면 이어지는 버튼이 없던데" — 버튼이 없었던 게 아니라 **잘렸습니다.**

`ForgeResultScreen`은 스크롤 없는 `Column`인데 고정 콘텐츠가 약 812dp(개인기록 배지 + 주간목표
배너가 함께 뜨는 "잘 달린 날"엔 약 894dp)였고, 인셋 적용 후 뷰포트는 약 730dp였습니다.
Compose는 가중치 없는 자식을 선언 순서대로 측정하므로 **마지막에 선언된 버튼**이 남은 공간 0을
받아 화면 밖에 놓입니다. 게다가 이 화면은 탭 바도, 뒤로가기 링크도, `BackHandler`도 없어
탈출구가 그것 하나뿐이었습니다. 세 커밋에 걸쳐 콘텐츠가 늘었고(배지 → 목표 배너 → 2줄 스탯 행)
마지막이 임계를 넘겼습니다.

- **`Kit.kt`에 `FooterPage`** — 본문은 스크롤, 푸터는 가중치 없는 자식이라 **먼저 측정**됩니다.
  콘텐츠가 아무리 늘어도 주요 동작을 밀어낼 수 없습니다. 값이 아니라 구조로 막습니다.
  `BoxWithConstraints`를 스크롤 **바깥**에 두어 본문에 실제 잔여 높이를 넘깁니다(스크롤 안에서는
  `weight()`/`fillMaxHeight()`가 무의미).
- **주조 결과**: 내 검 보기 + 완료 2버튼(전투 결과와 같은 패턴), 칼 그림은 뷰포트의 40%로 탄력적,
  `StatBarsCard`/`RbButton` 재사용, 배지는 `FlowRow`(5개면 가로로도 잘렸음), `BackHandler`,
  null 가드를 `LaunchedEffect`로(컴포지션 중 navigate 금지).
- **백스택**: 주조 후 SUMMARY/MANUAL은 소진된 화면이라 `popUpTo(HOME)`으로 제거. 재전송 경로가
  사라지고 뒤로가기가 홈으로 갑니다.
- **`RunningScreen`**도 같은 모양이라 이관. 오늘 추가된 배터리 카드는 **새 설치 첫 러닝에서 항상**
  뜨므로 같은 벼랑이었습니다. 경로 박스도 탄력적 높이로.
- **`LoginScreen`**: `safeDrawingPadding()`이 `verticalScroll` **뒤**에 있어 인셋이 스크롤
  콘텐츠의 일부가 됐습니다. 720×1280·글꼴 1.3에서 시작 버튼이 **내비바 아래**(y1207~1266 vs
  내비바 1184~1280)에 놓여 스크롤하기 전엔 누를 수 없었습니다. 순서만 바꿔 해결.
- **`RunSession.clear()`** 신설 — 4개 필드 중 2개만 지우고 있었습니다. 그리고 실내 러닝이
  응답의 `records`/`weeklyGoal`을 쓰지 않아 **이전 러닝의 🏆 배지가 남던** 문제도 수정.

검증(에뮬레이터): 최악 조건(배지 5개 + 목표 배너)에서 1080×2400 완료 y2124~2181(내비바 2274),
720×1280·글꼴 1.3 완료 y1064~1120(내비바 1184). 뒤로가기 → 홈, 내 검 보기 → 상세 → 뒤로 → 홈.

같은 실패가 2026-07-29 로그인 화면에서 한 번 있었고 그땐 스크롤 추가로 때웠습니다.
두 번째라서 이번엔 화면이 아니라 패턴을 고쳤습니다. 남은 스크롤 없는 화면(`FusionScreen`·
`PartsScreen`·`WorkshopScreen`·`MatchingScreen`·`ManualRunScreen`)은 같은 위험이 있으며
`FooterPage`로 이관하면 됩니다. `BattleScreen`은 `RbCard(weight(1f))`로 이미 안전합니다.

**릴리스 게이트**: 720×1280 / sw360 / font_scale 1.3에서 각 화면의 주요 버튼 `bounds`가
화면 안에 있는지 확인할 것.

## 검이 실제로 달린 경로 모양이 된다 (2026-08-01)
"달린 경로가 검이 된다"가 앱의 한 줄 소개인데, 정작 모든 검이 똑같이 생겼습니다.
원인: 엔진은 처음부터 `shape.centerline`(정규화된 경로 65점)을 보내고 있었지만 **앱의 `Shape`
DTO에 그 필드가 없어** kotlinx-serialization이 통째로 버리고 있었고, `BladeCanvas`는 하드코딩된
잎사귀 실루엣에 고정된 cubic 물결을 그리고 있었습니다.

- `data/Models.kt` — `Shape.centerline`/`runeAnchors` 추가. 이제 경로가 앱까지 도달합니다.
- `ui/BladeSpine.kt` — 경로를 칼날의 척추로 변환. 공분산 행렬로 주축을 찾아 세우고
  (시작=손잡이, 끝=칼끝: 달린 방향대로 읽힙니다), **두 축을 같은 배율로** 맞춰 비율을 보존하고
  (가로만 늘리면 직선 러닝의 GPS 노이즈가 극적인 곡선으로 증폭됩니다), 호 길이로 재샘플링합니다.
- **왕복 코스**는 접히지 않습니다. 반환점에서 갈라 **가는 길과 오는 길이 칼날의 양날**이 됩니다
  (`trueDoubleEdge`가 원래 뜻하던 것). 두 다리는 손잡이와 칼끝에서 용접해 평평한 끝을 막습니다.
- 테이퍼는 몸통이 완만히 좁아지다 마지막 1/6에서 뾰족해집니다(균등 테이퍼는 뭉툭한 노처럼 보임).
- 결에 그리던 가짜 물결은 이제 **경로 자체**입니다.
- 렌더 시점에 변환하므로 **이전에 주조된 검도 자기 경로 모양을 되찾습니다.** 마이그레이션 없음.

네이티브 테스트 10개 추가(직선→직선, 곡선→곡선, 방향 보존, 왕복→양날·접힘 없음, 원형 코스도
칼로 압축, 테이퍼 단조성, 서로 다른 코스는 서로 다른 칼).

## 짧은 러닝도 기록은 남는다 (2026-08-01)
0.30km를 뛰고 "기록만 저장"을 눌렀는데 저장되지 않는다는 제보. 서버가 `forge` 여부와 상관없이
같은 검증을 걸어, 1km 미달이면 **기록 자체를 거부**하고 있었습니다.

거절 사유를 두 종류로 나눴습니다.
- **신뢰할 수 없는 데이터**(gps_jump·vehicle_suspected·pace_too_fast·non_monotonic_time·
  too_few_points) → 그대로 422 거절. 트랙을 믿을 수 없습니다.
- **기준 미달**(below_min_distance·below_min_duration) → **기록은 저장**하고 주조만 거부.
  300m를 걸은 건 실제로 일어난 일이고, 주조 규칙을 강제하려고 진짜 기록을 버릴 이유가 없습니다.
  대신 보상·개인기록·연속일수·주간목표 보너스는 붙지 않습니다 — 최소 기준이 막으려던 게 그것입니다.

앱은 이제 요약 화면에서 **미리** 판단합니다: 버튼이 "1km·10분 필요"로 비활성화되고 얼마가
모자란지(예: `0.30km / 1.00km · 3분 / 10분`) 보여줍니다. 눌러서 실패하게 두지 않습니다.

라이브 검증: forge=true → 422, forge=false → 200(0.30km 저장, 보상 0, 지갑 변화 없음).

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
