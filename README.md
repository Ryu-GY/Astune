# Astune

출생 현지시각·시간대·좌표로 대표 별을 계산하고 규칙 기반 해석을 만드는 Next.js + FastAPI 프로젝트입니다.

## 실행 준비

Node.js 20.9 이상, Python 3.11 이상, uv가 필요합니다. 아래 명령은 프로젝트 루트의 PowerShell에서 실행합니다. 환경 파일이 이미 있다면 기존 값을 유지하세요.

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path astune-backend/.env)) { Copy-Item astune-backend/.env.example astune-backend/.env }
npm ci
npm run db:generate
npm run backend:sync
npm run backend:data
```

`backend:data`는 최초 한 번 DE421 천체력 파일을 내려받고 날짜 범위와 사용 가능 여부를 검증합니다. 이후 계산 요청은 로컬 파일을 사용합니다. 파일은 Git에 포함하지 않습니다. 배포 전에 `npm run backend:check`로 검사하세요. Python 서버도 시작할 때 성표·천체력·도시·시간대 데이터를 미리 읽으며 누락·손상이 있으면 시작하지 않습니다. `/health`는 생존 확인, `/ready`는 계산 데이터 준비 상태를 반환합니다.

서로 다른 터미널에서 실행합니다.

```powershell
npm run backend:dev
```

```powershell
npm run dev
```

- 미리보기: <http://127.0.0.1:3000/readings/preview>
- Python API 문서: <http://127.0.0.1:8000/docs>
- 기본 예제: 1995-05-05 15:00, Asia/Seoul, 위도 37.5665 / 경도 126.978 → Capella (HIP 24608), 고도 약 81.564° (최대 등급 2.0)

## 통합 구조

| 위치 | 역할 |
| --- | --- |
| `astune-backend/app/` | FastAPI 기본 설정, 예외 처리, 도시 검색, 계산 API |
| `astune-backend/app/astro/` | Skyfield 계산 코어, 별 목록 로딩, 시간대·서머타임 처리 |
| `data/astro/bright-stars.json` | Hipparcos Vmag ≤ 5.5, 좌표가 있는 2,848개 항목 |
| `data/astro/bright-stars.meta.json` | 출처·버전·해시·제외 항목·좌표 기준 시점 |
| `src/lib/astronomy/core-client.ts` | Next.js 서버와 Python 계산 API 사이의 어댑터 |
| `src/lib/readings/` | 규칙 선택, 문구 생성, 5개 해석 영역, 4개 점수 |
| `src/server/services/preview-service.ts` | 입력 검증 → 천문 계산 → 해석 → 기존 화면 응답 연결 |
| `prisma/` | 기존 사용자·출생 프로필·리딩·해석 규칙 저장 구조 |

실제 미리보기 경로는 `브라우저 → Next.js API → FastAPI/Skyfield → 해석 엔진 → 결과 카드`입니다. 이전 TypeScript 계산·해석 모듈은 남아 있지만 이 경로에서 사용하지 않습니다. 새 패키지·클래스·앱 표기는 Astune으로 통일했습니다.

대표 별은 밝기 제한을 만족하고 지평선 위에 있는 카탈로그 별 중 고도가 가장 높은 별입니다. Hipparcos 원본 118,218개 중 Vmag ≤ 5.5인 2,851개에서 좌표 누락 3개를 제외한 2,848개를 사용합니다. 좌표의 J1991.25 기준 시점, 고유운동, 유효한 시차를 Skyfield 계산에 반영합니다. 해석과 점수는 상징적 규칙으로 생성합니다.

카탈로그는 Git에 포함되어 있어 앱 실행 시 별 목록 다운로드가 필요하지 않습니다. 재생성이 필요한 경우에만 다음을 실행합니다.

```powershell
npm run backend:catalog -- --download
```

최초 원본 다운로드 후에는 `npm run backend:catalog`만으로 오프라인 재생성할 수 있습니다. 원본 해시가 다르면 기존 카탈로그를 덮어쓰지 않고 실패합니다. API는 JSON과 함께 있는 `.meta.json`의 내용 해시·행 수를 검증하고 출처와 버전을 응답합니다. 예전 `.env`의 `ASTRO_CATALOG_VERSION`, `ASTRO_SOURCE_LABEL`은 더 이상 사용하지 않습니다. 데이터 교체 후 Python 서버를 재시작하세요. 자세한 출처와 재생성 규칙은 [데이터 안내](data/astro/README.md)를 참고하세요.

## 개발 진행

- T101 완료: 31개 샘플 → 2,848개 성표, 재생성 도구, 메타데이터 무결성 검증, 좌표 기준 시점·고유운동·시차 반영.
- T102 완료: 로컬 DE421 준비·검사, 시작 시 예열, `/ready`. 준비 파일의 범위는 1899-07-29~2053-10-09 TDB이며 개별 요청은 실제 순간의 범위를 다시 확인합니다.
- T103 완료: 공용 도시 사전 13개(서울·6개 광역시·제주 포함), 오프라인 좌표→시간대 추론, 수동 보정, TTL/LRU 캐시, 선택적 외부 지오코딩과 장애 처리. 다른 도시는 지도에서 좌표·시간대를 함께 입력할 수 있습니다.
- T104 완료: zoneinfo UTC 변환, 서머타임 중복·누락, 30분 전환·건너뛴 날짜·과거 한국 서머타임 회귀 검증.
- T105 완료: Skyfield apparent alt/az, 지평선·최대 등급 필터, 고도·밝기·HIP 순의 일관된 후보 선택.
- T106 완료: 별 배열 계산, 성표·천체력 재사용, 단일 별 기준 결과 비교, 동시 요청·반복 I/O 검사. 로컬 실제 HTTP 400회에서 전체 미리보기 P95는 순차 33.14ms, 동시 4개 74.87ms로 목표 2,500ms 미만을 만족했습니다. 운영 환경 성능은 배포 후 별도 확인합니다. [측정 조건과 결과](docs/verification/t102-t106.md).
- `outputs/`의 v1.4 개발 문서는 T101 착수 전 상태를 기록한 스냅샷입니다. 최신 구현 상태는 이 README와 테스트를 기준으로 확인합니다.

## 설정과 데이터베이스

루트 `.env`의 주요 설정:

- `ASTUNE_ASTRO_API_URL`: Python API 주소. 기본 `http://127.0.0.1:8000`.
- `ASTUNE_RULE_SOURCE=builtin`: 동봉된 기본 규칙으로 실행. 미리보기에는 DB가 필요하지 않습니다.
- `ASTUNE_RULE_SOURCE=database`: DB의 최신 `PUBLISHED` 규칙 버전을 사용합니다. 게시된 버전이 없으면 `RULE_VERSION_NOT_FOUND`를 반환합니다.
- `DATABASE_URL=file:./dev.db`: `prisma/dev.db` SQLite 파일.
- `ASTUNE_ALLOW_DEV_AUTH=0`: 개발용 헤더 인증을 기본적으로 차단합니다.

새 로컬 DB를 준비하려면 다음을 실행합니다. 기존 DB를 연결한 경우 먼저 백업하고 스키마 차이를 검토하세요.

```powershell
npm run db:push
npm run db:seed
```

DB 규칙을 사용하려면 `.env`에서 `ASTUNE_RULE_SOURCE=database`로 변경하고 Next.js를 재시작합니다. 현재 Prisma 어댑터는 기존 `constellationCode` 규칙과 `default` 공통 규칙을 사용합니다. 별별 규칙·점수 가중치는 메모리 규칙 엔진에서 지원하며, 현재 DB 스키마에는 해당 필드가 없습니다.

리딩 저장 시 기존 컬럼을 유지하고 `interpretationMetaJson`에 전체 해석 결과·규칙 버전·점수·적용 규칙 ID를 함께 기록합니다. `persistence-mapper.ts`와 `prisma-rule-repository.example.ts`는 향후 별도 섹션/점수 테이블 설계용 예제이며 현재 DB 저장 경로에는 연결하지 않았습니다.

저장·관리자 API의 헤더 인증은 개발 환경에서 `ASTUNE_ALLOW_DEV_AUTH=1`을 명시한 경우에만 허용합니다. 운영 로그인·세션 및 저장 데이터 접근 제어는 추가 구현이 필요합니다. 현재 공개 배포용 인증 구성이 아닙니다.

## API 입력

화면의 기존 계약을 유지합니다.

```json
{
  "name": "홍길동",
  "birthAtLocal": "1995-05-05T15:00:00",
  "timezone": "Asia/Seoul",
  "locationName": "Seoul",
  "latitude": 37.5665,
  "longitude": 126.978,
  "maxMagnitude": 2
}
```

`POST /api/v1/readings/preview`에 전달합니다. 해석 코드의 `birthDate` + `birthTimeLocal` 입력도 지원합니다. 최대 등급은 -2~5.5, 기본값은 2.0입니다. 5.5를 초과하면 카탈로그 범위 밖이므로 검증 오류를 반환합니다. 응답에는 기존 `zenithStar`, `reading`, `astronomyMeta`와 새 `interpretation`이 함께 있습니다.

시간은 UTC 오프셋 없는 현지시각으로 전달합니다. 서머타임으로 같은 시각이 두 번 발생하면 `dstFold: 0` 또는 `1`을 지정해야 합니다. 존재하지 않는 시각은 오류로 반환합니다. DE421의 날짜 범위 밖 요청도 명시적으로 거절합니다.

출생 시간을 모르면 `birthTimeUnknown: true`와 날짜만 전달할 수 있습니다. 현지 낮 12시 기준의 참고 리딩을 계산하고 입력·결과·보관 화면에 정확한 대표 별을 확정할 수 없다는 경고를 표시합니다. [시간 모름 동작과 검증](docs/verification/unknown-birth-time.md).

Python API는 `birth_date`, `birth_time_local`(기존 `birth_time`도 허용), `timezone`, `latitude`, `longitude`를 받습니다. 좌표에서 시간대를 추론하므로 Python 측의 `timezone`은 생략할 수 있습니다. 좌표 대신 `city_name`도 받으며 중복 도시 이름은 임의 선택하지 않고 후보 선택을 요구합니다.

`GET /api/v1/locations/resolve?q=서울`은 로컬 도시 검색, POST에 `{"latitude":40.7128,"longitude":-74.006}`을 전달하면 좌표와 `America/New_York` 시간대를 반환합니다. Next.js 위치 API는 `q`, `countryCode`, `allowExternal`, Python API는 `query`, `country_code`, `allow_external`을 사용합니다. 육지 밖이나 경계에서 시간대를 찾지 못하면 직접 입력해야 합니다. 현대 경계로 시간대를 찾고 zoneinfo로 과거 오프셋을 적용하므로 과거 행정 경계 변경이 있는 출생지는 보정이 필요할 수 있습니다. [위치 데이터·외부 검색 설정·지도 안내](data/locations/README.md).

## 검증

```powershell
npm run typecheck
npm test
npm run backend:test
npm run build
```

Python 테스트는 로컬 DE421 파일이 필요하므로 먼저 `npm run backend:data`를 실행합니다. DB 규칙 테스트는 임시 SQLite 파일을 만들고 정리하며 개발 DB를 변경하지 않습니다. 프로덕션 빌드는 `npm run build`, 실행은 `npm start`이며 Python API도 별도로 실행해야 합니다.
