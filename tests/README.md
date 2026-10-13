# Astune 테스트

## T701·T702 재현

Node.js 24, Python 3.11, uv 0.11.6을 기준으로 확인했습니다. 새 체크아웃에서는 잠금 파일대로 설치하고 로컬 천체력을 한 번 준비합니다.

```powershell
npm ci
uv sync --locked --project astune-backend --python 3.11
uv run --locked --directory astune-backend python -m app.astro.prepare_data
npm run verify
```

`verify`는 Prisma 클라이언트 생성 → 천체력 사전 검사 → TypeScript 전체 테스트 → Python 전체 테스트 → 타입 검사를 순서대로 실행하며 첫 실패에서 중단합니다. 개발 서버, Google 계정·OAuth 키, 외부 DB는 필요하지 않습니다. SQLite 테스트 DB와 합성 세션은 임시 폴더에서 만들고 정리하며 개발 DB를 마이그레이션하거나 seed하지 않습니다. TypeScript 통합 테스트에서 Python 응답만 고정하며 인증·세션 서명·소유권·DB 트랜잭션·규칙 적용은 실제 구현을 사용합니다. 실제 Skyfield 계산은 Python 테스트가 담당합니다.

```powershell
# 저장·권한 통합 시나리오만 다시 실행
npm run db:generate
npm run test:integration
```

천체력이 없으면 `verify`는 계산 검사를 건너뛰지 않고 사전 검사에서 실패합니다. Hipparcos 원본 파일 전체 재생성 비교 1개는 원본 `hip_main.dat`이 있을 때만 실행하는 선택 검사입니다. 필요하면 `npm run backend:catalog -- --download`로 준비합니다. CI는 저장소에 포함된 성표의 무결성과 실제 계산을 검사하고 이 선택 검사의 생략 여부를 출력합니다.

`.github/workflows/tests.yml`은 main/develop push와 PR에서 같은 검증 및 프로덕션 빌드를 실행합니다. 공식 [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node), [setup-uv](https://github.com/astral-sh/setup-uv)의 커밋을 고정했으며 배포나 저장소 쓰기 권한은 사용하지 않습니다. 로컬 검증 결과와 CI 서비스에서 실제 실행된 결과는 구분합니다.

`storage-permissions.integration.test.ts`의 범위:

- 공개 위치·preview 응답과 DB 저장 없음
- 보호된 저장·목록·상세·출생 프로필·관리자 경로의 비로그인 차단
- 개발용 헤더 위조, 잘못된 서명, 만료·폐기·로그아웃 세션 차단
- 소유자 저장·복원·프로필 재사용·페이지 분할, 타인과 관리자에게 개인 리딩 비공개
- 잘못된 입력·교차 출처·JSON 외 요청·계산 실패의 오류와 부분 저장 방지
- 시간 모름 표시 보존, DB 관리자 권한 변경 즉시 반영
- 잘못된 관리자 입력의 400 처리, 초안→게시 전환, 단일 게시 버전, 감사 기록, 게시 후 기존 리딩 보존

## 개별 검사

프로젝트 루트에서 실행합니다.

```powershell
npm test
npm run backend:data
npm run backend:test
npm run typecheck
npm run build
npm run test:api # 두 서버 실행 필요, builtin 규칙 기준
```

- `interpretation.test.ts`: 규칙 우선순위, 올바른 별 ID, 성좌 코드 매칭, 두 입력 계약, 입력 검증, Python 응답 어댑터.
- `database-rules.test.ts`: 임시 SQLite에서 게시된 규칙과 초안 규칙을 구분하고 실제 해석 결과에 반영하는지 확인. 기존 개발 DB는 사용하지 않습니다.
- `rule-lifecycle.test.ts`: SQL 마이그레이션으로 준비한 임시 DB에서 16개 성좌·fallback의 builtin/DB 일치, 범위·우선순위 제약, 동시 게시·감사 실패 롤백, 기존 데이터 이관, seed 재실행을 검증합니다.
- `preview-route.test.ts`: Python 응답을 고정한 Next.js preview 핸들러에서 두 규칙 소스의 5개 섹션·4개 점수·규칙 ID와 게시 버전 누락 오류를 검증합니다.
- `public-api.test.ts`: 위치 POST 핸들러, 후보·직접 입력 안내·입력 오류·내부 서버 오류, 요청 ID 전달과 동시 요청 간 격리를 검증합니다.
- `astune-backend/tests/test_api_contract.py`: OpenAPI의 오류 모델과 예제, 후보 수·캐시, 요청 ID를 검증합니다.
- `scripts/check-api-contract.mjs`: 실행 중인 두 서버에 합성 정보로 실제 HTTP를 보내 위치→계산→해석, DST 오류, OpenAPI를 검증합니다. [API 문서](../docs/api.md)를 참고하세요.
- `astune-backend/tests/`: 시간대와 서머타임, 실제 Skyfield 계산, API 계약·오류 코드, 좌표·날짜 검증, 누락 데이터 처리.
- `locations.test.ts`: 위치 입력·Python 어댑터·출처·외부 검색 명시·오류 응답.
- `astune-backend/tests/test_locations.py`: 공용 사전, 좌표 시간대, 수동 보정, TTL/LRU·동시 요청, 외부 검색 제한·장애·중복 도시.
- `astune-backend/tests/test_engine_performance.py`: 배열과 단일 별 기준 결과 비교, 예열 뒤 반복 파일 읽기 차단, 동시 계산·동률 선택, 천체력 누락·손상 차단과 `/ready`.
- `npm run benchmark:preview -- --requests=100 --concurrency=1,4 --output=.audit-tmp/preview-benchmark.json`: 두 서버 실행 후 실제 HTTP P95 측정. 최대 등급 5.5와 다양한 합성 입력을 사용하며 2,500ms 이상이거나 오류가 발생하면 실패합니다. [측정 기록](../docs/verification/t102-t106.md).
- `astune-backend/tests/test_catalog.py`: 2,848개 성표의 범위·HIP ID·성좌, 좌표 누락 처리, 원본 해시, 메타데이터 변조, 고유운동·기준 시점과 Skyfield 기준 계산 비교. 원본 `hip_main.dat`이 있으면 전체 재생성 일치 검사도 실행합니다.

계산 테스트는 `backend:data`로 준비한 DE421 파일을 사용합니다. 정상 브라우저 흐름의 기준 예제는 1995-05-05 15:00 / Asia/Seoul / 37.5665, 126.978이며 최대 등급 2.0에서는 Capella (HIP 24608), 고도 약 81.564°와 해석 5개 영역·점수 4개가 표시됩니다. 최대 등급 5.5에서는 HIP 25292, 고도 약 88.827°이며 지평선 위 후보는 1,387개입니다.
