# 인증·설정 및 공통 UI 리팩터링

## 실제 코드와 제안 리뷰의 차이

- `src/lib/validation`, `src/server/services`, 단위·DB 통합 테스트와 CI는 이미 구현되어 있다. 기존 계층과 테스트 러너(Node test + tsx)를 유지했다.
- 개발용 헤더 인증은 기존에도 운영에서 비활성화되었다. 이번 변경은 명시적인 development 환경으로 한정하고 Vercel/Render 배포 표시가 있으면 추가로 차단한다.
- Prisma 전역 객체에는 이미 타입이 있었다. 원시 ORM 로그는 입력값이 포함될 수 있어 계속 비활성화하고, 기존 요청별 오류 코드·단계별 소요 시간 기록을 유지한다.
- 한국어 안내 문구와 themeColor 상수는 보안 취약점이 아니다. 다국어·폰트 체계 변경은 이번 범위에 포함하지 않는다.

## 변경

1. 서버 설정은 `src/lib/config/env.ts`의 Zod 기반 함수로 읽는다. SQLite와 PostgreSQL을 모두 지원하며 운영 DB URL 누락, 잘못된 OAuth 원본, 부분적으로 설정된 인증 정보, 짧거나 공백뿐인 시크릿, 잘못된 천문 API 주소·시간 제한·규칙 소스를 검사한다. 오류에는 키 이름만 포함된다. OAuth가 전부 비어 있는 로컬 게스트 사용과 CI 빌드는 유지한다.
2. Better Auth 설정은 검증 결과로만 초기화하고 단일 인스턴스를 유지한다. 공식 `advanced` 옵션으로 HTTPS Secure 쿠키, HttpOnly, SameSite=Lax를 명시한다. 계정 연결 금지, 쿠키 세션 캐시 비활성화, DB 기반 IP·경로별 요청 제한은 유지한다. `window` 단위는 초다.
3. 인증된 쓰기 요청은 유효한 동일 Origin을 요구하며 Origin이 아예 없을 때만 Referer를 사용한다. 불투명 `null`, 잘못된 원본, 출처가 모두 없는 요청, 교차 출처 요청, 비 JSON 요청을 거부한다. Better Auth OAuth 콜백에는 이 앱 전용 가드를 적용하지 않는다.
4. Next.js 응답에 nosniff, DENY, Referrer-Policy 및 기본 CSP를 추가했다. CSP는 base-uri, object-src, frame-ancestors를 제한한다. 스크립트·스타일 전체 제한은 nonce와 동적 렌더링 설계가 필요하므로 이 변경이 완전한 XSS 방어 CSP를 제공한다고 주장하지 않는다. Leaflet 동적 스타일과 Next.js hydration을 유지한다.
5. 공통 Button은 기본 type=button, 명시적 submit, busy/disabled/aria-busy를 제공한다. 로그인·프로필 저장·운세 폼에서 사용하며 네비게이션의 인증 상태·로그아웃 처리는 AccountNavigation으로 분리했다.
6. Prisma 6의 `@prisma/config` 아래에서만 `deepmerge-ts`를 8.0.2로 고정했다. GHSA-ggr8-5vv4-36mx 한 건이 Prisma 포함 세 의존성 항목으로 보고되던 문제를 해소했다. Prisma 메이저 버전·DB 스키마 변경은 없다.
7. push/PR에 npm audit와 고정 버전 Gitleaks를 실행하는 보안 CI를 추가했다. 댓글, 탐지 결과 아티팩트 업로드, 자동 배포는 포함하지 않는다.

## 검증

- 실제 개발 서버·DB와 분리한 `.audit-tmp/refactor-20261014`에서 잠금 파일대로 설치하고 Prisma 6.19.3 생성·임시 DB 마이그레이션을 실행했다.
- TypeScript 단위·통합 테스트 73개 통과. HTTPS 쿠키, 세션 위조·만료·로그아웃, 운영 개발 헤더 차단, 소유권, 출처 검사, 규칙 게시와 저장 스냅샷 불변성을 포함한다.
- Next.js 운영 빌드 및 타입 검사 통과.
- npm audit: 0건.
- Gitleaks 8.30.1: Git 이력 21개 커밋 및 현재 소스 검사에서 탐지 0건. 로컬 출력과 보고서는 비밀값을 마스킹한다.
- 운영 빌드를 별도 포트에서 실행하여 메인·로그인·세션·운세의 응답 보안 헤더, 실제 로컬 Skyfield 호출(HIP 28360, 해석 5영역), 브라우저 운세 입력→조회와 메뉴 표시를 확인했다.
- 운영 OAuth 자격 증명과 DB는 이 검증에 사용하지 않았다. 실제 Google 계정 로그인은 이번 검증 범위에 포함하지 않는다.

## 운용 시 주의

쿠키를 사용하는 외부 스크립트에서 쓰기 API를 호출한다면 명시적인 올바른 Origin 또는 Referer와 application/json이 필요하다. 서버 설정값을 바꿀 때는 키뿐 아니라 URL 형식과 타임아웃 범위(1,000~120,000ms)도 맞춰야 한다.

참고: [Better Auth 옵션](https://better-auth.com/docs/reference/options), [쿠키 설정](https://better-auth.com/docs/concepts/cookies), [취약점 공지](https://github.com/advisories/GHSA-ggr8-5vv4-36mx).
