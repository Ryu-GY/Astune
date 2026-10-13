# Google 로그인 설정

Astune은 Google 로그인과 게스트 이용을 지원합니다. 첫 Google 로그인에서 계정을 만들며 별도 비밀번호 가입은 없습니다. 게스트는 전체 해석을 볼 수 있지만 리딩·출생 정보를 서버나 브라우저 저장소에 저장하지 않습니다. 로그인으로 이동하면 입력을 다시 해야 합니다.

## 1. Google OAuth 클라이언트 만들기

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 만들거나 선택합니다.
2. Google Auth Platform에서 앱 이름(Astune), 지원 이메일, 대상 사용자를 설정합니다. 개인 Google 계정도 사용할 앱이면 외부 사용자를 선택합니다. 테스트 상태라면 사용할 계정을 테스트 사용자로 추가합니다.
3. 클라이언트(또는 API 및 서비스 → 사용자 인증 정보)에서 OAuth 클라이언트 ID를 만듭니다. 유형은 **웹 애플리케이션**입니다.
4. 로컬 개발용 승인된 JavaScript 원본에 `http://localhost:3000`을 등록합니다.
5. 승인된 리디렉션 URI에 **`http://localhost:3000/api/auth/callback/google`**를 등록합니다.
6. 발급된 클라이언트 ID와 보안 비밀번호를 로컬 `.env`에 입력합니다. 채팅이나 Git에 올리지 않습니다.

콜백 주소는 [Better Auth Google 설정](https://better-auth.com/docs/authentication/google)을 따릅니다. Google의 클라이언트 생성 및 리디렉션 규칙은 [Google OAuth 공식 안내](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred)를 참고하세요.

## 2. 로컬 환경 설정

프로젝트 루트의 `.env`에서 아래 항목을 설정합니다. 기존의 다른 설정은 유지합니다.

```dotenv
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=<아래 명령으로 만든 임의 값>
GOOGLE_CLIENT_ID=<발급받은 클라이언트 ID>
GOOGLE_CLIENT_SECRET=<발급받은 보안 비밀번호>
ASTUNE_ALLOW_DEV_AUTH=0
```

터미널에서 비밀값을 한 번 생성해 `BETTER_AUTH_SECRET`에 넣습니다.

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
npm run db:migrate
npm run db:generate
npm run db:seed
```

Next.js 서버를 재시작하고 **http://localhost:3000/login**을 엽니다. 브라우저 주소·`BETTER_AUTH_URL`·Google 콜백의 호스트와 포트를 맞춰야 합니다. `localhost`와 `127.0.0.1`을 섞지 마세요. 실행 중 Prisma 생성 파일이 잠겼다면 해당 프로젝트의 Next.js 서버를 종료한 뒤 `db:generate`를 실행합니다.

Google 계정 선택 → 동의 → Astune 보관함으로 복귀를 확인합니다. 이후 별을 찾고 ‘내 계정에 리딩 저장하기’를 누릅니다. 보관함에서 결과 재열기, 로그아웃 후 보관함 접근 차단도 확인합니다. OAuth 값이 없으면 게스트 기능은 동작하고 Google 로그인 API는 `AUTH_NOT_CONFIGURED`를 반환합니다.

## 3. 관리자 계정

먼저 사용할 계정으로 Google 로그인을 한 번 완료합니다. 서버 운영자가 프로젝트 터미널에서 실행합니다.

```powershell
npm run admin:grant -- your-google-email@example.com
```

이미 Google로 연결된 사용자에게만 ADMIN 권한을 부여하고 변경 기록을 남깁니다. `/admin/rule-versions`에서 초안 생성 → 규칙 작성·수정 → 게시 확인 → 감사 기록을 확인할 수 있습니다. 권한은 매 요청 DB에서 확인합니다. 요청 헤더로 관리자 역할을 바꿀 수 없습니다. seed의 로컬 예제 사용자는 Google 로그인 계정이 아닙니다.

## 4. 배포 설정

실제 HTTPS 도메인으로 `BETTER_AUTH_URL`을 설정하고 Google 원본·콜백에도 같은 도메인을 추가합니다. 예: `https://your-domain.com/api/auth/callback/google`. 운영 환경에는 별도의 비밀값, 영속 DB, 마이그레이션 적용이 필요합니다. 발급 정보가 아직 없으므로 이번 구현에서 실제 Google 계정 선택부터 콜백까지의 로그인은 검증하지 않았습니다.
