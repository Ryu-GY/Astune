# Astune 테스트

프로젝트 루트에서 실행합니다.

```powershell
npm test
npm run backend:data
npm run backend:test
npm run typecheck
npm run build
```

- `interpretation.test.ts`: 규칙 우선순위, 올바른 별 ID, 성좌 코드 매칭, 두 입력 계약, 입력 검증, Python 응답 어댑터.
- `database-rules.test.ts`: 임시 SQLite에서 게시된 규칙과 초안 규칙을 구분하고 실제 해석 결과에 반영하는지 확인. 기존 개발 DB는 사용하지 않습니다.
- `astune-backend/tests/`: 시간대와 서머타임, 실제 Skyfield 계산, API 계약·오류 코드, 좌표·날짜 검증, 누락 데이터 처리.
- `astune-backend/tests/test_catalog.py`: 2,848개 성표의 범위·HIP ID·성좌, 좌표 누락 처리, 원본 해시, 메타데이터 변조, 고유운동·기준 시점과 Skyfield 기준 계산 비교. 원본 `hip_main.dat`이 있으면 전체 재생성 일치 검사도 실행합니다.

계산 테스트는 `backend:data`로 준비한 DE421 파일을 사용합니다. 정상 브라우저 흐름의 기준 예제는 1995-05-05 15:00 / Asia/Seoul / 37.5665, 126.978이며 최대 등급 2.0에서는 Capella (HIP 24608), 고도 약 81.564°와 해석 5개 영역·점수 4개가 표시됩니다. 최대 등급 5.5에서는 HIP 25292, 고도 약 88.827°이며 지평선 위 후보는 1,387개입니다.

- `locations.test.ts`: 위치 입력·Python 어댑터·출처·외부 검색 명시·오류 응답.
- `astune-backend/tests/test_locations.py`: 공용 사전, 좌표 시간대, 수동 보정, TTL/LRU·동시 요청, 외부 검색 제한·장애·중복 도시.
- `astune-backend/tests/test_engine_performance.py`: 배열과 단일 별 기준 결과 비교, 예열 뒤 반복 파일 읽기 차단, 동시 계산·동률 선택, 천체력 누락·손상 차단과 `/ready`.
- `npm run benchmark:preview -- --requests=100 --concurrency=1,4 --output=.audit-tmp/preview-benchmark.json`: 두 서버 실행 후 실제 HTTP P95 측정. 최대 등급 5.5와 다양한 합성 입력을 사용하며 2,500ms 이상이거나 오류가 발생하면 실패합니다. [측정 기록](../docs/verification/t102-t106.md).
