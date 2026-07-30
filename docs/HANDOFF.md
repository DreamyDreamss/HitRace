# HANDOFF — 사람이 해야 할 것

자율로 진행할 수 있는 건 다 해두었습니다. 이 문서는 **사람 손이 필요한 것만** 짧게 적습니다.
판단이 필요한 항목(서버 주소·인증·결제·스토어 등 9가지)은 **`docs/OPEN_DECISIONS.md`** 에 선택지와
추천을 정리해 두었습니다 — 거기에 답만 주시면 바로 반영합니다.

최종 갱신: 2026-07-29

## 현재 상태

**Android 네이티브 앱(Kotlin + Jetpack Compose)이 주 클라이언트입니다.** 스펙 18개 화면 전부 +
도감 · 실내(트레드밀) 러닝 · 코스 라이벌 보드까지 네이티브로 구현했고, 모든 화면을 에뮬레이터에서
실제 API에 붙여 확인했습니다. 백엔드(Fastify) · 게임 엔진(game-core) · Postgres 스키마는 그대로
재사용합니다.

테스트: **엔진 62 · API 26 · 네이티브 9(밸런스 패리티) · 웹 E2E 2** — 전부 통과.

## 0. 저장소 / 백엔드

- GitHub: https://github.com/DreamyDreamss/HitRace (`main`)
- 백엔드: Supabase 프로젝트 `hfxtzevtnldsmbgcnwoa` (Seoul) - 스키마·RLS·시드·Edge Function 배포 완료.
  앱은 익명 로그인으로 시작하고, 모든 쓰기는 `game` Edge Function을 지납니다.
- 앱 빌드용 Supabase 키는 저장소에 없습니다 - `%USERPROFILE%\.gradle\gradle.properties` 에 있습니다.

## 1. 지금 바로 돌려보기

```bash
# 1) API (인메모리, DB 불필요)
cd apps/api && PORT=8787 node --import tsx src/index.ts

# 2) 에뮬레이터 부팅 후 앱 설치
cd apps/android-native
JAVA_HOME="C:\Program Files\Java\jdk-17" ./gradlew.bat :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

앱을 열고 러너 이름을 넣으면 시작합니다(`demo`는 검 3자루가 있는 시연용 계정, 그 외 이름은 새 계정).
**실기기**에서 쓰려면 PC의 LAN IP로 다시 빌드하세요:
`./gradlew.bat :app:assembleDebug -PAPI_BASE=http://<LAN-IP>:8787`

테스트:
```bash
pnpm -r test                                   # 엔진 + API
cd apps/android-native && ./gradlew.bat :app:testDebugUnitTest
```

## 2. 로컬 전용 Postgres (선택 - 운영은 Supabase)

API는 `DATABASE_URL`이 없으면 **인메모리**로 돌고, 서버를 끄면 데이터가 사라집니다. 로컬에 PostgreSQL 17이
있지만 비밀번호를 몰라 연결하지 못했습니다.

```bash
createdb hitrace
psql "postgresql://postgres:<PASS>@localhost:5432/hitrace" -f db/schema.sql
psql "postgresql://postgres:<PASS>@localhost:5432/hitrace" -f db/seed.sql
# apps/api/.env
DATABASE_URL=postgresql://postgres:<PASS>@localhost:5432/hitrace
```

스키마·시드는 실제 PG 17에서 검증했고, API 전 엔드포인트를 Postgres 경로로도 돌려봤습니다.

## 3. 답이 필요한 결정들 → `docs/OPEN_DECISIONS.md`

가장 시급한 셋:
1. **서버 주소/HTTPS** — 지금은 에뮬레이터 전용(`10.0.2.2:8787`). 실기기·배포에는 도메인이 필요합니다.
2. **실제 인증** — 현재는 이름만 넣는 개발용 로그인입니다(신규 계정도 개발 저장소에서만 생성).
3. ~~백그라운드 러닝 추적~~ → **구현 완료**(포그라운드 서비스). 화면을 꺼도 기록이 이어집니다.
   출시 시 Play 콘솔에 **포그라운드 서비스(location) 사용 목적 신고**만 사람이 해야 합니다.

나머지(웹/Capacitor 유지 여부, 리플레이 공유 호스팅, 결제, 스토어 메타데이터, 다국어)도 같은 문서에
정리돼 있습니다.

## 내가 임의로 정한 것들 (되돌릴 수 있음)

- 네이티브 Android 우선. 기존 웹 PWA와 Capacitor 빌드는 남겨두었지만 앱 기능은 네이티브만 갱신 중입니다.
- 게임 밸런스는 `game-core`가 원본, 앱의 `data/Balance.kt`는 미리보기용 미러 —
  두 값이 어긋나면 `BalanceParityTest`가 깨지도록 해놨습니다.
- Zero pay-to-win 원칙 유지(가챠는 검을 주지 않음).

---
_빌드 이력과 화면별 상태: `apps/android-native/NATIVE_ROADMAP.md` · 설계 근거: `docs/DECISIONS.md`_
