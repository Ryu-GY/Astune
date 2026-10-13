# Astune 수동 배포

## 운영 구성

| 구성 | 대상 | 설정 |
| --- | --- | --- |
| 웹·공개 API·해석 | https://astune.vercel.app | Vercel `ryu-gayoungs-projects/astune`, Node 24, 함수 Singapore |
| 천문·위치 계산 | https://astune-api.onrender.com | Render Free, Singapore, Docker, `develop` |
| DB | Neon `astune-db` | Free, Singapore, PostgreSQL |
| 계정 | Google OAuth + Better Auth | Neon에 계정·세션 저장 |

Vercel 프로젝트는 Git 연결이 없고 `vercel.json`의 `git.deploymentEnabled=false`를 유지한다. Render는 Public Git Repository로 연결하고 Auto-Deploy를 **Off**로 설정한다. GitHub Actions는 테스트와 빌드만 실행한다. Git push만으로 서비스가 바뀌지 않는다.

## 새 로컬 환경

Node 24.x, Python 3.11, uv 0.11.6으로 검증했다. `.env.example`과 `astune-backend/.env.example`을 각각 `.env`로 복사하고 기존 값은 보존한다.

```powershell
npm ci
npm run db:generate
npm run backend:sync
npm run backend:data
npm run backend:check
npm run db:migrate
npm run db:seed
npm run verify
```

터미널 두 개에서 `npm run backend:dev`, `npm run dev`를 실행한다. 로컬 Google 로그인 주소는 `http://localhost:3000`으로 통일한다. 게스트 해석은 OAuth 설정 없이도 사용할 수 있다.

PostgreSQL을 선택하면 Docker 실행 후 로컬 환경에 `POSTGRES_PASSWORD`를 설정하고 `docker compose -f compose.postgres.yml up -d --wait`를 실행한다. `.env`의 `DATABASE_URL`을 `postgresql://astune:<password>@127.0.0.1:5432/astune`으로 바꾼 뒤 `db:generate`, `db:migrate`, `db:seed`를 순서대로 실행한다. 실제 데이터를 이관할 때는 [백업·이관 안내](accounts-and-storage.md)를 따른다. 운영 DB에 테스트용 백업을 가져오지 않는다.

`postgres-compose` CI는 매번 비어 있는 PostgreSQL 17 컨테이너에 초기 스키마를 적용하고 합성 SQLite 데이터를 이관한다. 값·날짜·BigInt의 왕복 일치, 기존 데이터 덮어쓰기 거부, SQL 제약을 확인한 뒤 테스트 볼륨을 제거한다. 운영 DB와 연결하지 않도록 검증 스크립트는 localhost만 허용한다.

## Render 계산 서버

1. 저장소 `https://github.com/Ryu-GY/Astune`, 브랜치 `develop`, Dockerfile `Dockerfile.backend`, build context는 루트.
2. Free, Singapore, health check `/ready`, Auto-Deploy Off.
3. `astune-backend/.env.production.example`을 기준으로 환경 변수를 등록한다. `ASTUNE_ASTRO_API_KEY`는 임의 32바이트 이상으로 만들고 웹 서버와 동일하게 설정한다. 저장소나 브라우저 공개 변수에 넣지 않는다.
4. 변경 버전을 develop에 push한 뒤 Render의 **Manual Deploy → Deploy latest commit**을 실행한다.

컨테이너 빌드 때 잠금 의존성을 설치하고 DE421을 다운로드·검사한다. 실행은 비관리자 사용자, 단일 worker이며 요청 중 파일을 내려받지 않는다. `/health`와 `/ready`는 공개 상태 확인용이고 `/api/`는 내부 인증 키가 필요하다. 운영 `/docs`는 비활성화한다.

Free 인스턴스는 비활성 시간이 지나면 잠들 수 있어 첫 요청이 50초 이상 지연될 수 있다. 웹의 계산 제한 시간은 120초, Vercel API 실행 제한은 180초로 설정했다. 유휴 서버를 인위적으로 깨우는 자동 작업은 만들지 않았다.

## Vercel 웹

공식 Vercel CLI 63.1.2로 검증했다. 먼저 `vercel whoami`와 연결 프로젝트를 확인한다. 이 PC에는 이전 계정도 있어 배포에 별도 CLI 인증 디렉터리를 사용했다. 다음 명령은 **새 Astune 계정으로 인증된 CLI**에서 실행한다.

```powershell
vercel link --yes --project astune --scope ryu-gayoungs-projects
vercel env ls production
vercel deploy --prod --skip-domain --scope ryu-gayoungs-projects
vercel curl https://<생성된-배포-주소>/readings/preview
vercel promote https://<검증한-배포-주소> --scope ryu-gayoungs-projects
node scripts/check-deployment.mjs https://astune.vercel.app
```

`.env.production.example`의 설정을 Vercel **Production** 환경에 등록한다. Neon 연결이 `DATABASE_URL`을 제공한다. OAuth·세션 서명·계산 서버 인증값은 Secret으로 저장하며 미리보기 환경에 운영 DB를 공유하지 않는다. 민감값은 표준 입력이나 대시보드로 입력하고 명령 인수·Git에 넣지 않는다. 자동 생성된 `.vercel`, 내려받은 환경 파일, 인증 디렉터리도 커밋하지 않는다.

새 운영 DB에는 서버 환경에 연결값을 주입한 별도 작업 디렉터리에서 `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`를 실행한다. 기존 DB는 먼저 백업하고 마이그레이션을 검토한다. 운영 seed는 규칙을 생성하며 `*.astune.local` 예제 사용자는 실제 Google 로그인 계정이 아니다. 실제 관리자 부여는 [계정 설정](google-login.md)에 명시된 운영 절차를 따른다.

Google 클라이언트에는 JavaScript 원본 `https://astune.vercel.app`, 콜백 `https://astune.vercel.app/api/auth/callback/google`을 등록하고 `BETTER_AUTH_URL=https://astune.vercel.app`로 맞춘다.

## 확인·복구

`scripts/check-deployment.mjs`는 공개 페이지, 게스트 권한, 미래 날짜, 도시, 실제 계산·해석, 시간 모름 경고를 확인한다. 실제 Google 로그인 → 예제 계산 → 저장 → 보관함 재열기 → 로그아웃도 브라우저에서 확인한다. 성능은 `benchmark-preview.mjs`로 합성 입력을 사용해 측정하며 무료 서버의 유휴 기동은 따로 취급한다.

웹 문제는 검증했던 이전 운영 배포로 `vercel rollback <deployment-url>`을 실행할 수 있다. Render는 이전 성공 배포를 수동 재배포한다. DB 스키마 변경이 포함된 릴리스는 앱 롤백만으로 되돌리지 말고 백업·스키마 호환성을 먼저 확인한다.
