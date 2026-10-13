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
