# 설정과 배포

순서: **Turso → R2 → Resend → Render(백엔드) → Netlify(프론트) → 관리자 가입 → 부모 계정 지정**

## 로컬 개발

```bash
# 백엔드 (http://localhost:4000)
cd backend
cp .env.example .env      # JWT_SECRET, ADMIN_EMAIL 정도만 바꾸면 바로 실행됨
npm install
npm run dev

# 프론트엔드 (http://localhost:5173, /api 는 4000번으로 프록시)
cd frontend
npm install
npm run dev
```

- `TURSO_DATABASE_URL=file:local.db` 이면 로컬 파일 DB를 씁니다.
- R2 값이 비어 있으면 사진을 `backend/.uploads/` 에 저장합니다.
- `RESEND_API_KEY` 가 비어 있으면 승인 메일 HTML을 서버 로그에 출력합니다. 로그에서 `/api/signup/confirm/...` 링크를 찾아 브라우저로 열면 승인됩니다. (로컬에서는 `http://localhost:5173/api/signup/confirm/...` 로 열면 됩니다.)

## 1. Turso

1. https://turso.tech 에서 DB를 만듭니다. 리전은 한국과 가까운 도쿄(`aws-ap-northeast-1`)를 권장합니다.
2. DB URL(`libsql://<db>-<org>.turso.io`)과 토큰을 받습니다.
   ```bash
   turso db show <db> --url
   turso db tokens create <db>
   ```
3. 테이블은 백엔드가 처음 시작할 때 자동으로 만듭니다.

## 2. Cloudflare R2

1. R2 → **버킷 만들기** (예: `hhcw-diary-images`)
2. R2 → **API 토큰 관리** → 해당 버킷에 *객체 읽기 및 쓰기* 권한으로 토큰 생성
3. 받은 값: 계정 ID, Access Key ID, Secret Access Key
4. (선택) 버킷 **설정 → 공개 액세스 → 사용자 지정 도메인**을 연결하면 `R2_PUBLIC_URL` 에 넣을 수 있습니다. 넣지 않으면 서명된 URL을 씁니다 ([architecture.md](architecture.md#이미지-url) 참고).

## 3. Resend (승인 메일)

1. https://resend.com 에서 API 키를 만듭니다.
2. 도메인을 인증하지 않으면 `onboarding@resend.dev` 발신으로 **가입한 본인 메일에만** 보낼 수 있습니다. `ADMIN_EMAIL` 을 Resend 가입 메일로 하면 도메인 없이도 동작합니다.
3. 자신의 도메인을 인증했다면 `MAIL_FROM=우리가족 <no-reply@내도메인>` 으로 바꿉니다.

## 4. Render (백엔드)

1. Render → **New → Blueprint** → 이 저장소 선택. 루트의 [render.yaml](../render.yaml) 을 읽어 `backend/` 를 Node 웹 서비스로 만듭니다.
2. 환경변수를 입력합니다 (`JWT_SECRET` 은 자동 생성).

   | 변수 | 값 |
   | --- | --- |
   | `APP_URL` | Netlify 사이트 주소 (예: `https://hhcw-diary.netlify.app`) |
   | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | 1단계 값 |
   | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | 2단계 값 |
   | `R2_PUBLIC_URL` | (선택) |
   | `ADMIN_EMAIL` | 승인 메일을 받을 관리자 메일 |
   | `RESEND_API_KEY`, `MAIL_FROM` | 3단계 값 |
   | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | 푸시 알림 키 ([pwa.md](pwa.md#운영-설정-render) 7번). 비우면 알림만 꺼짐 |

3. 배포가 끝나면 `https://<서비스>.onrender.com/api/health` 가 `{"ok":true}` 를 돌려주는지 확인합니다.

## 5. Netlify (프론트엔드)

1. Netlify → **Add new site → Import from Git** → 이 저장소 선택. 루트의 [netlify.toml](../netlify.toml) 이 `frontend/` 를 빌드합니다.
2. **배포 전에** `netlify.toml` 의 `/api/*` 프록시 주소를 4단계의 Render 주소로 바꿔서 커밋합니다.
   ```toml
   to = "https://<서비스>.onrender.com/api/:splat"
   ```
3. 사이트 주소가 정해지면 Render 의 `APP_URL` 과 일치하는지 확인합니다.

## 6. 가족 가입

1. 엄마, 아빠가 먼저 사이트에서 가족관계를 **'엄마'**, **'아빠'**로 입력해 가입 요청 → 관리자가 메일에서 승인합니다.
   이 두 가족관계만 피드 작성·수정과 구성원 관리를 할 수 있고, 각각 한 명만 등록됩니다.
2. 다른 가족은 가족관계를 자유롭게 입력해 가입 요청 → 관리자가 승인합니다. (보기 + 댓글)
3. 호칭(화면에 보이는 이름)은 가입 때 정하고, 이후 각자 **내 정보**에서 바꿀 수 있습니다.

권한은 가족관계로 정해지므로 따로 지정할 필요가 없습니다.
가족관계를 잘못 입력해 승인됐다면 화면에서는 바꿀 수 없으니, Turso 콘솔에서 고친 뒤 서버를 재시작하면 권한도 맞춰집니다.
```sql
UPDATE users SET relation = '엄마' WHERE email = '<이메일>';
```
