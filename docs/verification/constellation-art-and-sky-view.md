# 별자리 일러스트와 그날의 하늘 연결 검증

검증일: 2026-10-13

## 변경 동작

- 첫 입력값은 2000-01-01 00:00이며, 출생 시간 모름은 기존대로 현지 낮 12시를 사용한다.
- 대표 별의 IAU 별자리 코드로 한글 이름, 라틴어 이름, 해당 별자리 일러스트를 표시한다. 기존 저장 리딩도 같은 카드에서 표시한다.
- 그림은 별자리의 상징을 표현한 일러스트이며 실제 별 배치도와 구분해 안내한다.
- `그날의 하늘 자세히 보기`는 Stellarium Web을 새 탭으로 연다. 계산 서버가 확정한 UTC 시각, 위도, 경도, HIP 번호를 전달하며 이름·리딩 본문은 전달하지 않는다.
- 시간 모름의 하늘 지도는 낮 12시 기준이라는 안내를 함께 표시한다. 낮의 별은 외부 지도의 Atmosphere 표시를 꺼서 볼 수 있다.

## 제작 기록

내장 `image_gen`으로 별자리마다 개별 그림을 제작했다. 공통 그림체와 개별 소재 프롬프트는 [프롬프트 목록](constellation-art-prompts.json)에 기록한다. 프로젝트 파일은 `public/images/constellations/<IAU code>.webp`에 저장하며, 원본 구도와 픽셀 크기를 유지한 채 WebP로 압축한다.

88개 파일을 모두 생성·저장했으며, 전체 웹용 용량은 17.41 MiB다.

## 확인한 화면

| 조건 | 확인 결과 |
| --- | --- |
| 서울, 2000-01-01 00:00 | HIP 28360, 마차부자리/Auriga, 마차부자리 그림 |
| 위 결과의 Stellarium 링크 | Seoul, 2000-01-01 00:00, Menkalinan/HIP 28360 선택 |
| 서울, 1995-05-05 15:00 링크 | Seoul, 1995-05-05 15:00, Capella 선택 |
| 서울, 2000-01-01, 시간 모름 | Vega, 거문고자리/Lyra, 거문고 그림, 낮 12시 경고 및 UTC 03:00 링크 |
| 모바일 390×844 | 그림 로딩 정상, 가로 넘침 없음, 별자리 이름 표시 |

## 자동 검사

`tests/sky-view.test.ts`는 계산 시각과 좌표 보존, 서머타임 중복 시각, 시간 모름, 잘못된 값 처리, 88개 별자리 이름, 영어 응답의 한글 변환, 88개 개별 WebP 파일의 존재·형식·중복 여부를 검사한다.

이 검사를 포함한 TypeScript·통합 테스트 56개가 모두 통과했다. 88개 이미지 파일의 SHA-256 해시가 모두 서로 다름을 확인했다.

결과 카드 변경을 포함한 Next.js 운영 빌드와 TypeScript 검사는 통과했다. Windows 제한 환경의 링크 생성 권한 때문에 일반 빌드는 실패했으며, 같은 검증 폴더에서 권한을 허용해 재실행한 빌드가 통과했다.

## 근거

- [한국천문연구원 2020 역서의 별자리 목록](https://astro.kasi.re.kr/file/astro_almanac_pdf/20200624134708539.pdf)
- [Stellarium Web URL 처리 소스](https://github.com/Stellarium/stellarium-web-engine/blob/master/apps/web-frontend/src/App.vue)
- [Stellarium Web 공유 링크 생성 소스](https://github.com/Stellarium/stellarium-web-engine/blob/master/apps/web-frontend/src/assets/sw_helpers.js)
