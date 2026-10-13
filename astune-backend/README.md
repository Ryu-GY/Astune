# Astune API

FastAPI 기본 설정과 Skyfield 천문 계산 코어입니다. 프로젝트 루트의 Next.js 미리보기 API가 이 서버를 호출합니다.

## 독립 실행

이 디렉터리에서 실행합니다. 기존 `.env`가 있으면 덮어쓰지 마세요.

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
uv sync
uv run python -m app.astro.prepare_data
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

API 문서는 <http://127.0.0.1:8000/docs>에서 확인합니다. 요청 예제와 실제 `ErrorResponse` 모델을 제공하며 기계 판독 스키마는 `/openapi.json`입니다. [공개 Next.js와 내부 FastAPI의 계약·오류·재현 방법](../docs/api.md)을 함께 참고하세요.

`POST /api/v1/readings/preview` 요청 예시:

```json
{
  "birth_date": "1995-05-05",
  "birth_time_local": "15:00:00",
  "timezone": "Asia/Seoul",
  "latitude": 37.5665,
  "longitude": 126.978,
  "location_name": "Seoul",
  "max_magnitude": 2
}
```

기존 `birth_time` 필드도 받습니다. 좌표는 위도·경도를 함께 전달하며 시간대를 생략하면 timezonefinder로 육지 시간대를 찾습니다. 직접 지정한 유효한 IANA 시간대가 우선합니다. `city_name`은 공용 도시 사전에서 한글 별칭·영문 이름으로 검색합니다. Python API는 항상 계산 시각을 받습니다. Next.js의 시간 모름 기능은 경고와 함께 현지 낮 12시를 명시적 참고 시각으로 전달합니다.

## 위치 검색

- `GET /api/v1/locations/resolve?q=울산`: 로컬 사전만 검색합니다.
- `POST /api/v1/locations/resolve`에 `{"latitude":40.7128,"longitude":-74.006}`: 좌표와 추론한 시간대, 출처를 반환합니다.
- POST의 `query`, `country_code`, `timezone`, `allow_external`은 선택 필드입니다. 도시 이름 또는 좌표 쌍이 필요합니다.
- `limit`은 1~10 정수, 기본 5입니다. 후보는 `data.items`로 반환하며 Next.js 공개 API는 이를 `data.candidates`로 변환합니다.
- 좌표 시간대와 검색 결과를 기본 24시간·각 2,048개 한도로 캐시합니다. 실패는 캐시하지 않습니다. `LOCATION_CACHE_TTL_SECONDS`, `LOCATION_CACHE_SIZE`로 조정합니다.
- 외부 검색은 `GEOCODER_ENABLED=true`와 요청의 `allow_external=true`가 모두 있어야 실행합니다. Open-Meteo 무료 서비스는 비상업 용도이며 출처 표기가 필요합니다. 제한은 프로세스별이므로 활성화 시 단일 워커로 사용하세요. [위치 데이터와 서비스 조건](../data/locations/README.md).

## 데이터와 오류

- `.env`와 상대 데이터 경로는 이 backend 디렉터리를 기준으로 해석합니다.
- 별 목록 기본 경로: `../data/astro/bright-stars.json` (Hipparcos Vmag ≤ 5.5, 2,848개). 기존 camelCase와 코어의 snake_case 형식을 모두 읽습니다.
- 같은 디렉터리의 `bright-stars.meta.json`이 필요합니다. 내용 해시·행 수·지원 등급 범위를 검증하며, 출처·버전은 이 파일에서 읽습니다. 누락·불일치는 503입니다.
- `max_magnitude`는 -2~5.5 범위이며 기본값은 2.0입니다. 기준 시점 J1991.25, 고유운동, 유효한 시차를 반영합니다.
- 재생성: `uv run python -m app.astro.build_bright_catalog --download` (원본이 없을 때만 다운로드). 이후 `--download` 없이 재생성할 수 있습니다. 카탈로그 교체 후 서버를 재시작하세요.
- 천체력 기본 경로: `data/astro/de421.bsp`. 준비 명령에서 한 번 내려받고 계산 중에는 네트워크를 사용하지 않습니다.
- 서버가 성표·천체력·도시·시간대 데이터를 미리 읽습니다. 준비되지 않은 경우 시작에 실패합니다. `uv run python -m app.astro.check_data`로 천체력과 성표를 배포 전에 검사합니다. `/ready`는 성표 버전·행 수와 DE421의 TDB 범위를 반환합니다(1899-07-29~2053-10-09).
- 2,848개 별을 배열로 계산하며 성표·천체력·시간 척도·별 객체를 요청 간 재사용합니다. 종료 시 천체력과 HTTP 클라이언트를 닫습니다.
- `dst_fold`가 필요한 중복 현지시각, 존재하지 않는 현지시각, 천체력 범위 밖 날짜, 후보 별 없음은 422 응답입니다.
- 누락되거나 잘못된 계산 데이터는 503 응답입니다.
- 결과의 `candidate_count`는 밝기 조건과 지평선 조건을 모두 통과한 별의 수입니다.

```powershell
uv run pytest
```

해석 문구와 점수는 루트의 `src/lib/readings/`에서 생성합니다. 전체 실행 절차와 DB 설정은 상위 `README.md`를 참고하세요.
