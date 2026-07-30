# Supabase 백엔드 설정

별도 API 서버 없이 **Supabase Postgres + Auth + Edge Function** 으로 운영합니다.

## 현재 상태: 배포 완료 (2026-07-30)

- 프로젝트: `hfxtzevtnldsmbgcnwoa` (ap-northeast-2 / Seoul)
- 스키마 `hitrace` 20개 테이블 + RLS 정책 20개 + 가입/삭제 트리거 2개 적용
- 시드: PvP 봇 3 + 각인 5 + 시즌 3 + 스토어 4 + 밸런스 미러
- Edge Function `game` 배포됨 → `https://hfxtzevtnldsmbgcnwoa.supabase.co/functions/v1/game`
- 익명 로그인 활성화(`external_anonymous_users_enabled=true`)
- 검증: health · 익명 로그인 · `/me` · `/pvp/ranking` · 주조(쓰기) 모두 통과, **앱에서도 계정 생성
  → 데모 러닝 → 주조까지 성공**(검이 Supabase에 저장됨)

앱 빌드용 키는 저장소가 아니라 `%USERPROFILE%\.gradle\gradle.properties` 에 있습니다:
```
SUPABASE_URL=https://hfxtzevtnldsmbgcnwoa.supabase.co
SUPABASE_ANON_KEY=<anon key>
```
없으면 앱은 로컬 개발 서버(`10.0.2.2:8787`)로 폴백합니다.

---

아래는 처음부터 다시 세팅하거나 다른 프로젝트에 올릴 때의 절차입니다.

## 왜 Edge Function이 필요한가 (중요)

이 게임은 **서버가 심판**입니다. 주조 점수·안티치트·강화 확률·가챠 천장·PvP 전투·재화 상한을
서버가 계산합니다. Supabase의 자동 REST(PostgREST)에 쓰기 권한을 열면 클라이언트가 자기 검 스탯과
철광석을 직접 써넣을 수 있어 게임이 무너집니다. 그래서:

- **쓰기(주조·강화·가챠·PvP·합주조·분해)** → `game` Edge Function 만 가능 (service role, RLS 우회)
- **읽기** → RLS로 자기 행만. 쓰기 정책은 **하나도 만들지 않았습니다** (anon 키가 유출돼도 조작 불가)

Edge Function은 기존 `apps/api`의 `GameService`와 `packages/game-core`를 **그대로 재사용**합니다.
로컬 개발/테스트용 Fastify 서버는 남아 있어 26개 API 테스트가 계속 유효합니다.

## 1) 프로젝트 생성 & 링크

```bash
# supabase.com에서 프로젝트 생성 후 (리전: Seoul 권장)
npx supabase login
npx supabase link --project-ref <project-ref>
```

## 2) 스키마 + 시드

```bash
npx supabase db push                     # supabase/migrations/*.sql
npx supabase db seed                     # supabase/seed.sql (봇·카탈로그·시즌)
```

마이그레이션 2개가 적용됩니다.
- `20260729000000_runblade_schema.sql` — 기존 20개 테이블 (스키마 `hitrace`)
- `20260729000100_rls_and_auth.sql` — 가입 트리거 + RLS + 읽기 정책

## 3) Edge Function 배포

```bash
# 커넥션 풀러 URL을 시크릿으로 (Dashboard → Settings → Database → Connection pooling, 6543)
npx supabase secrets set HITRACE_DB_URL="postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres?options=-c%20search_path%3Drunblade%2Cpublic"

pnpm supabase:deploy      # game-core + api 빌드 후 functions deploy game
```

배포 확인:
```bash
curl https://<ref>.supabase.co/functions/v1/game/health -H "apikey: <anon-key>"
# {"ok":true,"service":"hitrace-edge"}
```

## 4) 앱 빌드

```bash
cd apps/android-native
./gradlew.bat :app:assembleDebug \
  -PSUPABASE_URL=https://<ref>.supabase.co \
  -PSUPABASE_ANON_KEY=<anon-key>
```

두 값을 주면 앱이 자동으로 Supabase 모드가 됩니다(익명 로그인 + `functions/v1/game`).
값을 안 주면 예전처럼 로컬 Fastify(`10.0.2.2:8787`)로 붙습니다 — 개발용으로 그대로 둡니다.
매번 치기 싫으면 `apps/android-native/gradle.properties`에 두 줄 넣어두세요(그 파일은 커밋 금지).

## 인증 방식

**익명 로그인**으로 시작합니다. 앱에서 러너 이름을 넣으면 `auth.users`가 만들어지고,
DB 트리거가 같은 id로 `hitrace.users` 프로필과 빈 지갑을 생성합니다. 나중에 Google 로그인을
붙여도 **같은 auth 사용자에 연결(link)** 되므로 검·기록이 그대로 유지됩니다.

Supabase 대시보드에서 **Authentication → Providers → Anonymous sign-ins 을 켜야** 합니다
(`supabase/config.toml`에도 켜져 있지만 원격 프로젝트는 대시보드 설정이 우선).

## 남은 것 / 주의

- 시드에 **demo 계정은 없습니다.** 실제 플레이어는 익명 로그인으로 생기고, PvP용 봇 3개만 넣습니다.
  기존 `db/seed.sql`(demo 검 3자루 포함)은 로컬 Fastify 개발용으로 남겨뒀습니다.
- Edge Function은 **커넥션 풀러(6543)** 를 쓰세요. 직접 연결(5432)은 함수 인스턴스가 늘면 고갈됩니다.
- 함수 응답 형식은 기존 API와 100% 동일합니다 — 앱은 base URL과 헤더만 바뀝니다.
- 무료 플랜은 일정 기간 미사용 시 프로젝트가 일시 정지됩니다(운영 전환 시 유료 플랜 고려).
