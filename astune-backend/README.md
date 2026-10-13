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

API 문서는 <http://127.0.0.1:8000/docs>에서 확인합니다.

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

기존 `birth_time` 필드도 받습니다. 좌표를 직접 전달할 때는 위도·경도·시간대가 모두 필요합니다. `city_name`을 통한 샘플 도시 검색도 지원합니다.

## 데이터와 오류

- `.env`와 상대 데이터 경로는 이 backend 디렉터리를 기준으로 해석합니다.
- 별 목록 기본 경로: `../data/astro/bright-stars.json` (Hipparcos Vmag ≤ 5.5, 2,848개). 기존 camelCase와 코어의 snake_case 형식을 모두 읽습니다.
- 같은 디렉터리의 `bright-stars.meta.json`이 필요합니다. 내용 해시·행 수·지원 등급 범위를 검증하며, 출처·버전은 이 파일에서 읽습니다. 누락·불일치는 503입니다.
- `max_magnitude`는 -2~5.5 범위이며 기본값은 2.0입니다. 기준 시점 J1991.25, 고유운동, 유효한 시차를 반영합니다.
- 재생성: `uv run python -m app.astro.build_bright_catalog --download` (원본이 없을 때만 다운로드). 이후 `--download` 없이 재생성할 수 있습니다. 카탈로그 교체 후 서버를 재시작하세요.
- 천체력 기본 경로: `data/astro/de421.bsp`. 준비 명령에서 한 번 내려받고 계산 중에는 네트워크를 사용하지 않습니다.
- `dst_fold`가 필요한 중복 현지시각, 존재하지 않는 현지시각, 천체력 범위 밖 날짜, 후보 별 없음은 422 응답입니다.
- 누락되거나 잘못된 계산 데이터는 503 응답입니다.
- 결과의 `candidate_count`는 밝기 조건과 지평선 조건을 모두 통과한 별의 수입니다.

```powershell
uv run pytest
```

해석 문구와 점수는 루트의 `src/lib/readings/`에서 생성합니다. 전체 실행 절차와 DB 설정은 상위 `README.md`를 참고하세요.
