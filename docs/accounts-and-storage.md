# T401–T404 · T501–T504 구현 및 운영

## 기능

| 항목 | 구현 |
| --- | --- |
| T401 | SQLite 기존 컬럼·데이터 보존 마이그레이션, PostgreSQL 스키마·마이그레이션, 체크섬 백업·빈 DB로 복원 도구 |
| T402 | 로그인한 소유자의 출생 프로필 저장·목록·ID 재사용, 이름·현지시각·시간대·좌표·dstFold·최대 등급 보존 |
| T403 | 인증 후 리딩 저장, 입력·전체 해석·점수·적용 규칙·천문 결과 JSON 보존, 소유자만 상세 조회 |
| T404 | 본인 리딩·프로필의 page/pageSize/total 페이지 조회, 최신순과 ID 기준 정렬 |
| T501 | Google 첫 로그인 시 가입, DB 세션, 로그아웃·만료·폐기 반영, 게스트 미리보기 |
| T502 | DB ADMIN 역할 확인, 일반 사용자·게스트 차단, 운영 환경에서 개발 헤더 무시 |
| T503 | 관리자 초안 생성·규칙 upsert·범위/변수 검증·단일 게시·이전 버전 보관, 수정·게시 쓰기 잠금 |
| T504 | 성공 변경과 감사 기록을 같은 트랜잭션으로 저장, 이전/이후 값, 실패 기록, 관리자 전용 페이지 조회 |

게스트의 출생 정보와 결과는 화면 메모리에서만 사용하며 저장 API는 401을 반환합니다. 브라우저 보관함 기능은 제거했습니다. 기존 브라우저에 남아 있는 과거 데이터는 이번 변경에서 삭제하지 않습니다. 관리자도 다른 사용자의 개인 리딩·프로필을 조회할 수 없습니다.

해석은 총평·성향·연애·일·재물 5개 영역을 각 3문단으로 확장했습니다. 기본 규칙 v2의 각 영역은 최소 400자입니다. 상징 설명·구체적인 상황·실천 제안을 포함하며 문단 구분을 유지합니다. 기존 게시 규칙과 과거 저장 리딩은 자동 변경하지 않습니다. DB 규칙 모드에서는 seed 후 새 `2026Q4_v2` 초안을 검토하고 게시해야 확장 문구가 적용됩니다.

Google 설정과 관리자 계정 준비는 [로그인 안내](google-login.md)를 따릅니다.

## 저장 API

- `POST /api/v1/birth-profiles`: 실제 출생 시각으로 프로필 저장. 시간 모름 프로필은 거절합니다.
- `GET /api/v1/birth-profiles?page=1&pageSize=12`: 본인 프로필만 조회합니다.
- `POST /api/v1/readings`: 출생 입력으로 계산·저장합니다. `saveBirthProfile: true`로 프로필까지 원자적으로 저장합니다. 또는 `{ "birthProfileId": "..." }`만 보내 소유한 프로필을 재사용합니다. 재사용 시 다른 출생 필드를 섞을 수 없습니다.
- `GET /api/v1/readings/{id}`: 저장 당시의 전체 결과를 반환합니다. 현재 규칙으로 재계산하지 않습니다.
- `GET /api/v1/me/readings?page=1&pageSize=12`: 본인 목록·전체 개수를 반환합니다.
- `PUT /api/v1/admin/rule-versions/{id}/rules/{ruleId}`: 관리자 초안 규칙 upsert. 다른 버전의 규칙을 이동할 수 없습니다.
- `GET /api/v1/admin/audit-logs?page=1&pageSize=12`: 관리자 전용 감사 기록입니다.

pageSize 범위는 1–50입니다. 변경 요청은 JSON과 동일 출처를 요구합니다. 세션은 DB에서 확인하고 개인 API 응답에는 `Cache-Control: no-store`를 적용합니다.

## SQLite → PostgreSQL 이관

`prisma/schema.prisma`가 기준 스키마입니다. `scripts/prisma.mjs`가 PostgreSQL 스키마를 동기화하고 `DATABASE_URL`에 맞는 Prisma 스키마를 선택합니다. PostgreSQL 시간은 `timestamptz(3)`로 저장합니다. 직접 `db push` 대신 마이그레이션을 사용해야 SQL CHECK와 단일 게시 제약이 유지됩니다.

1. 앱의 쓰기를 중지합니다. 원본 SQLite 파일을 별도로 백업한 후 SQLite에 최신 마이그레이션을 적용합니다. 오래된 `db push` DB의 baseline은 README의 안내를 따릅니다.
2. 원본 SQLite URL 상태에서 다음을 실행합니다. 백업 파일은 기존 파일을 덮어쓰지 않습니다.

```powershell
npm run db:generate
npm run db:transfer -- export ./source.astune-backup.json
```

3. 빈 PostgreSQL DB를 준비합니다. 선택적으로 `.env`에 강한 `POSTGRES_PASSWORD`를 설정한 뒤 `docker compose -f compose.postgres.yml up -d`를 실행합니다.
4. `.env`의 `DATABASE_URL`을 `postgresql://astune:<URL-인코딩한-비밀번호>@127.0.0.1:5432/astune`으로 바꿉니다. 관리형 DB라면 제공된 TLS 연결 문자열을 사용합니다.
5. 아래 순서대로 실행합니다. **import 전에 seed를 실행하지 않습니다.**

```powershell
npm run db:generate
npm run db:migrate
npm run db:transfer -- import ./source.astune-backup.json
npm run db:seed
```

6. 이관 행 수, 본인 목록·상세·프로필 재사용, 게시 규칙 1개, 관리자 기록을 확인한 후 쓰기를 재개합니다. `db:seed`는 기존 규칙 ID·수정된 문구·게시 이력을 보존합니다.

백업에는 개인 정보와 세션·OAuth 토큰이 포함됩니다. 비공개로 보관하며 Git에 추가하지 않습니다. import는 모든 대상 테이블이 비어 있어야 하고 체크섬을 확인합니다. 외래 키나 제약 실패 시 전체 트랜잭션을 롤백합니다.

## 롤백

운영 전환 전에 문제가 생기면 앱 쓰기를 멈춘 상태에서 원본 SQLite URL로 되돌리고 `db:generate` 후 재시작합니다. 이미 PostgreSQL에 새 데이터가 생겼다면 그 DB를 export하고, **별도의 빈 SQLite 파일**로 URL을 변경하여 generate → migrate → import 합니다. 원본 파일을 덮어쓰지 않습니다. 롤백 후에도 동일하게 행 수와 저장 리딩을 확인합니다.

## 검증 범위

`npm test`는 임시 SQLite DB로 실서명 세션·로그아웃·소유권·프로필 재사용·전체 스냅샷·페이지 조회·규칙 게시·감사 기록·원자적 롤백을 검사합니다. `tests/storage-migration.test.ts`는 백업 복원 및 PostgreSQL WASM(PGlite)의 SQL 마이그레이션·롤백·제약·데이터 일치를 확인합니다. 외부 PostgreSQL 서버에 대한 Prisma 연결·실제 Google OAuth 콜백은 배포 설정 후 별도로 확인해야 합니다.
