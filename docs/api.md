# Astune API 계약

2026-10-13, T301–T303 기준. 브라우저는 Next.js 공개 API를 호출합니다. Next.js가 FastAPI에 위치 해석·천문 계산을 요청하고 TypeScript 규칙으로 해석을 생성합니다. 두 서버의 `/api/v1/readings/preview`는 경로가 같지만 반환하는 내용이 다릅니다.

| 구분 | Next.js 공개 API | FastAPI 내부 API |
| --- | --- | --- |
| 로컬 주소 | `http://127.0.0.1:3000` | `http://127.0.0.1:8000` |
| 필드 | camelCase | snake_case |
| 성공 | `success: true`, `data`, `meta.requestId` | `success: true`, `data` |
| 오류 | `success: false`, `error`, `meta.requestId` | `success: false`, `error.request_id` |
| 요청 ID | 응답 `X-Request-ID`, 내부 호출에 같은 값 전달 | 응답 `X-Request-ID` |
| preview | 대표 별 + 해석 5개 섹션 + 점수 4개 | 대표 별·성좌·천문 수치·시간·위치 |
| DB | builtin preview는 DB 불필요. database는 게시 규칙 조회만 수행 | 사용 없음 |
| 문서 | 이 문서와 `npm run test:api` | `/openapi.json`, `/docs`, `/redoc` |

## 공통 공개 응답

모든 구현된 Next.js `/api/v1` 핸들러는 다음 envelope를 사용합니다. 이전 최상위 `ok` 및 평면 결과 응답은 교체되었습니다. 화면·지도·성능 측정 도구도 `data`를 읽습니다. 브라우저 보관함의 기존 저장 형식은 유지합니다.

```json
{
  "success": true,
  "data": { "candidates": [], "cacheHit": false, "manualInputHint": "위도·경도와 IANA 시간대를 직접 입력해 주세요." },
  "meta": { "requestId": "example-location-1" }
}
```

```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "입력값을 확인해 주세요.", "details": null },
  "meta": { "requestId": "example-location-1" }
}
```

`error.details`는 오류에 따라 객체 또는 null입니다. JSON 파싱 오류도 같은 envelope입니다. 공개 응답은 `Cache-Control: no-store`입니다. 요청 ID는 영문·숫자로 시작하는 1~128자의 영문·숫자·`.`·`_`·`:`·`-` 문자열이며 누락 또는 잘못된 값은 UUID로 교체합니다. 출생 정보는 요청 ID에 넣지 마세요.

## 위치 해석

`POST /api/v1/locations/resolve`, 인증 불필요.

| 요청 필드 | 규칙 |
| --- | --- |
| `query` | 도시명·별칭, 1~100자. 좌표가 없으면 필수 |
| `countryCode` | 선택, ISO 2글자. 대문자로 정규화 |
| `limit` | 선택, 1~10 정수, 기본 5 |
| `latitude`, `longitude` | 함께 제공. 각각 -90~90, -180~180 숫자 |
| `timezone` | 선택, IANA 시간대. 직접 지정한 값 우선 |
| `allowExternal` | 기본 false. 서버의 `GEOCODER_ENABLED=true`도 필요 |
| `q` | 이전 POST의 호환 별칭. query와 함께 주면 값이 같아야 함 |

좌표를 주면 좌표 해석이 우선하며 후보 한 개를 반환합니다. 시간대를 생략하면 육지 시간대를 오프라인으로 추론합니다. 바다 위 좌표는 시간대를 직접 지정하면 허용됩니다. 도시 사전에 없으면 기본적으로 외부 호출 없이 빈 후보와 직접 입력 안내를 반환합니다.

```json
{ "query": "서울", "countryCode": "KR", "limit": 3 }
```

```json
{ "latitude": 40.7128, "longitude": -74.006 }
```

```json
{ "latitude": 0, "longitude": -140, "timezone": "Etc/GMT+9" }
```

결과 `data`에는 `candidates`, `cacheHit`, `manualInputHint`가 있습니다.

| 후보 필드 | 의미 |
| --- | --- |
| `displayName` | 표시명. 좌표에 표시명이 없으면 `Coordinates` |
| `countryCode` | 국가 코드 또는 null |
| `latitude`, `longitude` | 숫자 좌표 |
| `timezone` | 해석된 IANA 시간대 |
| `source` | `city_table`, `coordinates`, `geocoder` |
| `timezoneSource` | `city_table`, `coordinates`, `geocoder`, `manual` |
| `attribution` | 외부 출처 표시 또는 null |

캐시 적중 여부는 `cacheHit`로 표시하고 원래 출처는 `source`에 보존합니다. 신뢰도 점수는 산출하지 않습니다. `GET /api/v1/locations/resolve?q=서울`은 호환용이며 같은 envelope를 반환합니다. GET은 로컬 도시 검색만 수행하고 후보 수는 기본 5입니다.

FastAPI의 같은 POST 경로는 `query`, `country_code`, `limit`, `latitude`, `longitude`, `timezone`, `allow_external`을 받습니다. 결과는 `data.items`, `cache_hit`, `manual_input_hint`이며 후보 필드도 `display_name`, `country_code`, `timezone_source` 등 snake_case입니다.

## 통합 리딩 미리보기

`POST /api/v1/readings/preview`, 인증 불필요. 사용자·출생 프로필·리딩을 DB에 저장하지 않습니다. database 모드에서는 게시 규칙만 읽습니다.

```json
{
  "birthAtLocal": "1995-05-05T15:00:00",
  "timezone": "Asia/Seoul",
  "locationName": "Seoul",
  "latitude": 37.5665,
  "longitude": 126.978,
  "maxMagnitude": 2
}
```

| 요청 필드 | 규칙 |
| --- | --- |
| `birthAtLocal` | 필수, `YYYY-MM-DDTHH:mm[:ss]`, UTC 오프셋 없는 현지 시각. 시간 모름이면 날짜만 가능 |
| `birthTimeUnknown` | 선택 boolean, 기본 false. true이면 해당 날짜의 낮 12시 기준 참고 결과 |
| `timezone` | 필수 IANA 시간대. 위치 API에서 먼저 구할 수 있음 |
| `latitude`, `longitude` | 필수 숫자 좌표 |
| `locationName` | 선택 표시명, 최대 120자 |
| `name` | 선택 이름, 1~50자 |
| `maxMagnitude` | 선택, -2~5.5, 기본 2.0 |
| `dstFold` | 선택, 0 또는 1. DST 중복 시각에는 필수 |

기획서의 분리 입력 `birthDate: "1995-05-05"`, `birthTimeLocal: "15:00:00"`도 지원합니다. 이 형식에서는 `locationName`도 필수입니다. 같은 계산·해석 경로를 사용합니다. 잘못된 날짜와 생략된 현지 시각은 거절합니다. 다만 `birthTimeUnknown: true`를 명시하면 낮 12시를 기준으로 계산하고 `dstFold`는 사용하지 않습니다. 이때 `calculationNotice`와 화면 경고로 실제 대표 별·해석·점수가 달라질 수 있음을 안내합니다.

| 공개 `data` 필드 | 내용 |
| --- | --- |
| `input` | 정규화된 입력 |
| `calculationNotice` | 시간 모름인 경우에만 `code: BIRTH_TIME_UNKNOWN`, `referenceTimeLocal: 12:00:00`, 경고 `message` |
| `zenithStar` | `hipId`, `name`, `constellationCode`, `constellationName`, `magnitude`, `altitudeDeg`, `azimuthDeg`, `zenithDistanceDeg` |
| `reading` | 화면용 `title`, `summary`, `keywords`, `love`, `career`, `money` |
| `astronomyMeta` | `sourceLabel`, `catalogVersion`, `engineName`, `candidateCount`, `calculatedAtUtc` |
| `interpretation` | `selectedStar`, `selectedConstellation`, `metrics`, `ruleVersionId`, `summary`, `sections`, `scores`, `matchedRuleIds`, 천문 메타 |

섹션은 `overview`, `personality`, `love`, `career`, `money` 순서이며 각각 `title`, `content`, `sortOrder`, `sourceRuleId`, `sourceScope`를 포함합니다. 점수는 `personality`, `love`, `career`, `money`의 정수 0~100 및 등급입니다. 해석과 점수는 상징적 규칙이며 preview의 `readingId`는 없습니다.

위 예제는 기본 등급 2.0에서 Capella(HIP 24608), 고도 약 81.564°를 반환합니다. 최대 등급 5.5에서는 후보 집합이 달라집니다. 문구는 게시 규칙에 따라 달라집니다.

FastAPI는 `birth_date`, `birth_time_local`(호환 별칭 `birth_time`), `latitude`, `longitude`, `timezone`, `location_name`, `max_magnitude`, `dst_fold`을 받습니다. 좌표 대신 `city_name`과 선택적 `country_code`도 가능하며 시간대를 생략하면 추론합니다. `data`는 `selected_star`, `selected_constellation`, `metrics`, `astronomy_meta`, `local_datetime`, `utc_datetime`, `resolved_location`입니다. 해석·점수는 포함하지 않습니다.

## 오류와 복구

| 코드 | 공개 HTTP | 의미와 복구 |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 또는 내부 검증의 422 | JSON·좌표·날짜·후보 수·타입 수정. FastAPI 입력 검증은 422 |
| `TIMEZONE_NOT_FOUND` | 분리 preview 입력 400 / 내부 422 | IANA 시간대 수정. 평면 preview 검증은 `VALIDATION_ERROR` |
| `TIMEZONE_REQUIRED` | 422 | 육지 시간대 없음. 좌표와 시간대 직접 입력 |
| `LOCAL_TIME_AMBIGUOUS` | 422 | 반복되는 시각. `dstFold` 선택 |
| `LOCAL_TIME_NONEXISTENT` | 422 | DST로 생략된 시각. 정확한 시각 확인 |
| `EPHEMERIS_OUT_OF_RANGE` | 422 | 날짜가 DE421 범위 밖 |
| `NO_VISIBLE_STAR_CANDIDATE`, `BRIGHT_STAR_SUBSET_EMPTY` | 422 | 후보 없음. 최대 등급 확인 |
| `RULE_VERSION_NOT_FOUND` | 404 | database 모드에서 관리자가 규칙 게시 |
| `GEOCODER_RATE_LIMITED` | 429 | 나중에 재검색하거나 직접 입력 |
| `GEOCODER_UNAVAILABLE`, `CATALOG_NOT_READY` | 503 | 외부 검색 또는 로컬 데이터 준비 상태 확인 |
| `LOCATION_SERVICE_UNAVAILABLE`, `ASTRO_SERVICE_UNAVAILABLE` | 503 | 내부 서버 연결·시간 초과 |
| `LOCATION_INVALID_RESPONSE`, `ASTRO_INVALID_RESPONSE` | 502 | 내부 응답이 JSON 또는 지정 스키마와 다름 |
| `CALCULATION_FAILED` | 503 | 내부 계산 실패. FastAPI 자체는 500, Next.js는 내부 5xx를 503으로 전달 |
| `INTERNAL_SERVER_ERROR` | 500 | 공개 API 내부 예외. 내부 서버가 반환한 코드는 503으로 전달될 수 있음 |

내부 오류의 코드·설명·details를 보존하고 공개 요청의 `meta.requestId`로 연결합니다. `CITY_NOT_FOUND`(404), `CITY_AMBIGUOUS`(409)는 FastAPI의 도시명 직접 preview에서 발생합니다. 공개 위치 검색의 미발견은 200과 빈 후보입니다.

## 재현

루트 README대로 두 서버와 로컬 데이터를 준비합니다. 기본 builtin 규칙에서 다음을 실행하면 정상·오류 사례를 실제 HTTP로 검증합니다.

```powershell
npm run test:api
# 다른 포트를 사용하는 경우
npm run test:api -- --next=http://127.0.0.1:3001 --python=http://127.0.0.1:8001
```

직접 실행할 PowerShell 예제입니다.

```powershell
$apiBase = 'http://127.0.0.1:3000/api/v1'
$location = Invoke-RestMethod "$apiBase/locations/resolve" -Method Post -ContentType 'application/json' -Headers @{'X-Request-ID'='location-example'} -Body '{"query":"Seoul","countryCode":"KR","limit":1}'
$location.data.candidates
$preview = Invoke-RestMethod "$apiBase/readings/preview" -Method Post -ContentType 'application/json' -Body '{"birthAtLocal":"1995-05-05T15:00:00","timezone":"Asia/Seoul","latitude":37.5665,"longitude":126.978}'
$preview.data.interpretation.sections
# 422: DST 중복 시각. dstFold: 0 또는 1을 추가하면 구분 가능
Invoke-WebRequest "$apiBase/readings/preview" -Method Post -ContentType 'application/json' -Body '{"birthAtLocal":"2021-11-07T01:30:00","timezone":"America/New_York","latitude":40.7128,"longitude":-74.006}'
```

## 기획 v1.4와 남은 차이

- 공개 envelope와 위치 POST의 query·countryCode·limit·candidates를 적용했습니다. `confidenceScore`는 만들지 않으며 캐시 여부는 원천 출처와 분리합니다.
- 구조화된 preview는 `data.interpretation`에 있습니다. 기획 예시처럼 모두 data 바로 아래로 평탄화하지 않았으며 화면용 reading·zenithStar를 함께 제공합니다.
- 공개 preview는 해석된 좌표와 시간대를 받습니다. 도시 입력은 위치 API로 후보를 선택하는 2단계 흐름입니다. Python은 도시 입력과 시간대 추론을 직접 지원합니다.
- 위 표의 실제 오류 코드를 보존합니다. 전체 오류·상태 정렬은 T601, 단계별 처리 시간 기록은 T602 후속 범위입니다.
- 저장·프로필·내 목록·관리자 API에도 같은 envelope를 적용했지만 운영 세션·DB role·소유권·페이지 처리 완료를 뜻하지 않습니다. 개발용 인증은 `ASTUNE_ALLOW_DEV_AUTH=1`인 개발 환경에만 있습니다. 인증 오류는 `AUTH_REQUIRED`(401), `ADMIN_REQUIRED`(403), `ADMIN_USER_ID_REQUIRED`(401)입니다.
- 관리자 publish는 `POST /api/v1/admin/rule-versions/{id}/publish`이며 기획의 PUT과 다릅니다. 규칙 생성도 POST create이며 upsert는 T503 범위입니다.
- 저장·관리자 API의 상세 완성은 T401~T504에서 이어집니다. 재현 스크립트는 위치와 저장 없는 preview만 호출합니다.
