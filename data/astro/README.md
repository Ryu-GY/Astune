# Astune Hipparcos 밝은 별 카탈로그

`bright-stars.json`은 ESA의 1997년 Hipparcos 주 성표에서 Johnson V 등급이 5.5 이하인 항목을 추출한 데이터입니다. 118,218개 원본 항목 중 조건에 맞는 2,851개에서 좌표가 없는 HIP 55203, 78727, 115125를 제외해 2,848개를 제공합니다. 천체의 중복·다중성계를 분해한 개별 물리적 별의 수를 의미하지는 않습니다.

출처: ESA 1997, *The Hipparcos and Tycho Catalogues*, ESA SP-1200, CDS `I/239/hip_main`. 필드 정의와 기준 시점은 [CDS 원본 설명](https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/I/239?format=html&tex=true), Skyfield 사용 방식은 [공식 별 계산 안내](https://rhodesmill.org/skyfield/stars.html)를 참고합니다.

## 데이터 규칙

- ICRS 좌표는 J1991.25 기준이며 고유운동 단위는 mas/년입니다. RA 고유운동은 원본의 cos(dec) 보정값을 그대로 사용합니다.
- 성좌는 Skyfield에 포함된 경계와 카탈로그 좌표로 판별합니다. 카탈로그의 고정 소속이며 요청 날짜마다 재분류하지 않습니다.
- 시차가 음수·0이거나 누락되면 0으로 정규화하여 거리를 미상으로 처리합니다. 이 카탈로그에서는 10개가 해당하며 메타데이터에 HIP ID가 있습니다. 시선속도는 제공되지 않아 Skyfield 기본값 0을 사용합니다.
- 등급은 원본의 고정 Vmag 값입니다. 변광성의 현재 밝기나 매 요청 시점의 밝기를 계산하지 않습니다.
- 기존 표시 이름 31개는 `star-names.json`에 분리했습니다. 나머지는 `HIP 번호`로 표시하며 공식 IAU 고유명 전체 목록을 주장하지 않습니다.
- 밝기 오름차순, 동률일 때 HIP ID 오름차순으로 정렬합니다. 상위 몇백 개로 임의 절단하지 않습니다.

## 재생성

프로젝트 루트에서 실행합니다.

```powershell
npm run backend:sync
npm run backend:catalog -- --download
npm run backend:test
```

이미 받은 원본을 사용하려면 `npm run backend:catalog -- --source C:/path/hip_main.dat`를 실행합니다. 출력 경로는 `--output`으로 지정할 수 있으며, 같은 이름의 `.meta.json`도 생성됩니다. 버전 관리를 하는 기본 출력의 변경은 두 파일을 함께 커밋합니다.

원본은 [CDS hip_main.dat](https://cdsarc.cds.unistra.fr/ftp/cats/I/239/hip_main.dat), SHA-256 `58ceabb104d647160d9437ce6e513a02a036bb4ad9f8879a5a22fd52943616e0`으로 고정합니다. 53,316,318바이트 원본은 Git에서 제외하고, 약 1MB의 정규화된 결과와 메타데이터만 배포합니다. 재현 환경은 `astune-backend/uv.lock`의 Skyfield 1.55입니다.

`bright-stars.meta.json`에는 원본/결과/표시 이름 해시, 행 수, 품질 예외, 라이브러리 버전이 있습니다. 결과 해시는 JSON 값을 정렬된 키·압축 구분자·UTF-8로 직렬화해 계산하므로 Windows 줄바꿈 변환에 영향을 받지 않습니다. 생성 시각을 넣지 않아 동일 입력·라이브러리에서는 동일하게 재생성됩니다.

런타임은 배포된 두 JSON 파일만 검증·캐시합니다. 원본 성표 다운로드는 명시적인 준비 명령에서만 실행되며 카탈로그 변경 후 Python 서버 재시작이 필요합니다. 이전 TypeScript 계산기는 유지된 레거시 코드로, 정밀 계산 경로는 FastAPI/Skyfield입니다.
