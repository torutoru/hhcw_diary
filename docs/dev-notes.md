# 개발 노트 — 다음 작업 전에 읽기

지금까지 만든 것, 정한 규칙, 작업하면서 겪은 함정과 남은 일을 정리했습니다. 2026-10-22 기준이며, 마지막 커밋은 `1f0b95a`입니다.
구조·API·배포의 자세한 내용은 [architecture.md](architecture.md), [api.md](api.md), [deployment.md](deployment.md)에 있습니다.

## 1. 한눈에 보기

- **서비스**: 가족끼리만 쓰는 하루 한 장 사진 일기 SNS "우리가족"
- **디자인 원본**: Claude 아티팩트 "우리가족 SNS" — https://claude.ai/artifact/QzvuubdWvzkasdyubZ4eUw (사본: [design/artboards/](design/artboards/))
- **구성**: `frontend/`(React + Vite, Netlify) · `backend/`(Fastify, Render) · Turso(데이터) · Cloudflare R2(사진) · Resend(승인 메일)
- **운영 주소**: 백엔드 `https://hhcw-diary.onrender.com`. Netlify가 `/api/*`를 여기로 프록시합니다 ([netlify.toml](../netlify.toml)).

> **서비스 이름**은 환경변수로만 관리합니다. 프론트 `VITE_APP_NAME`(Netlify, 빌드 시 반영) + 백엔드 `APP_NAME`(Render, 알림 제목·승인 메일). 화면 코드에서는 "우리가족"을 직접 쓰지 말고 `APP_NAME`([frontend/src/lib/app.ts](../frontend/src/lib/app.ts))을 쓰고, 조사는 `withObject()`로 받침에 맞춥니다.

## 2. 지금까지 만든 기능

| 커밋 | 내용 |
| --- | --- |
| `8caa541` | 초기 구현: 로그인, 가입 요청 + 관리자 메일 승인(1시간·1회용 링크), 메인 피드, 상세 모달, 작성·수정, 이미지 WebP 변환(200~400KB) |
| `828fcd5` | '엄마'·'아빠'만 피드 작성. 각각 한 명만 등록 |
| `c477317` | 가족 구성원 관리(`/members`, 관리자만, soft delete로 제거) + 본인 댓글 삭제(자리에 안내 문구) |
| `3478267` | 로그인 상태 기억하기(400일 쿠키, 아이디만 localStorage) + 사진 크게 보기(라이트박스) |
| `625c54f` | Netlify 프록시 주소 수정(가입 요청 실패 원인), Fastify 요청 로그 끄기 |
| `d75f4bb` | "피드 작성하기" → 달력(`/compose`): 파란 점 = 수정, 빈 날 = 작성, 미래 불가. 지난 피드 수정 허용 |
| `5397639` | 작성 화면에서 뺀 사진 즉시 삭제, R2 삭제 실패를 `storage_deletions`에 기록해 서버 시작 시·매 정각 재시도 |
| `1f0b95a` | **가족관계(권한) / 호칭(화면 이름) 분리**, 내 정보 화면(`/me`) |

| `bb6e001`, `40dad40` | **PWA**: 홈 화면 설치(안드로이드·아이폰), 설치 안내(로그인 화면 카드 + 프로필 메뉴), 새 버전·오프라인 안내 → [pwa.md](pwa.md). 앱 아이콘은 사용자 제작본(`docs/design/pwa-icons/`) |
| `873d484` | **푸시 알림 + 아이콘 배지**: 새 피드(올린 사람 제외 모두), 새 댓글(피드 작성자 + 댓글 단 사람), 배지 "1", 안드로이드 상태바 N. 실제 기기 수신 확인 완료 |

### 디자인 시안에 없는데 추가한 화면

- 달력(`/compose`), 내 정보(`/me`), 사진 라이트박스, 확인 시트(구성원 제거·댓글 삭제), PWA 설치 안내 카드(로그인 화면)·시트, 새 버전·오프라인 안내
- 디자인을 다시 손볼 때는 이 화면들도 시안에 넣어 두면 좋습니다.

## 3. 꼭 기억할 규칙과 결정

### 사용자 정보와 권한
- **가족관계**(`users.relation`): 권한 기준이고 수정할 수 없습니다. '엄마'·'아빠' → `parent`(관리자). DB 부분 고유 인덱스 `uniq_parent_relation`으로 한 명씩만 허용
- **호칭**(`users.nickname`): 화면에 보이는 이름이고 내 정보에서 수정할 수 있습니다. 댓글 등에서 `<PersonName>`으로 "호칭 + 작은 가족관계"를 표시합니다 ([Person.tsx](../frontend/src/components/Person.tsx)).
- 권한은 매 요청 DB에서 다시 읽습니다. 서버 시작 시 `role`을 가족관계 기준으로 다시 맞춥니다.

### 데이터 삭제는 모두 soft delete
- 구성원 제거: `users.removed_at` 기록, `status='pending'`, 남은 승인 링크 무효화. 재가입 요청으로 돌아올 수 있음
- 댓글 삭제: `comments.deleted_at` 기록, 본문은 비움. 목록에는 "작성자의 요청으로 댓글이 삭제되었습니다"
- 사진: DB 행을 먼저 지우고(DB가 기준) R2 파일을 지움. 실패하면 `storage_deletions`에 기록

### DB 마이그레이션 방식
- 별도 도구 없이 [backend/src/db/migrate.ts](../backend/src/db/migrate.ts)가 **서버 시작 시** 실행됩니다.
- 새 테이블: `CREATE TABLE IF NOT EXISTS`
- 기존 테이블에 컬럼 추가: `addColumnIfMissing()` (PRAGMA로 확인 후 ALTER)
- 운영 Turso에도 배포하면 자동으로 적용되므로, **되돌릴 수 없는 변경인지** 먼저 생각해야 합니다.

> ⚠️ `1f0b95a`에서 `users.name` → `relation`으로 컬럼 이름을 바꿨습니다. **이 커밋 이전 버전의 백엔드로 롤백하면 동작하지 않습니다.**

### 보안 관련 결정
- **비밀번호는 브라우저에 저장하지 않습니다.** "기억하기"는 아이디(localStorage) + 400일 httpOnly 쿠키입니다. 사용자는 비밀번호까지 저장하길 원했지만, 평문 저장의 위험을 설명하고 이 방식으로 합의했습니다.
- R2 버킷은 비공개이고, 사진은 2시간짜리 서명 URL로만 보여줍니다. 서명 시각을 1시간 단위로 맞춰 브라우저 캐시가 동작합니다. `R2_PUBLIC_URL`은 비워 둡니다.
- 사진 업로드 시 EXIF(위치정보 등)를 제거합니다.

### 날짜
- "오늘" 판단과 `feed_date`는 **한국 시간(KST)** 기준이고, 시각 값은 UTC ISO 문자열입니다.
- 피드는 **날짜마다 하나**(`feeds.feed_date` UNIQUE)이고, 미래 날짜는 서버에서 막습니다.

## 4. 작업 방식 (사용자와 합의한 것)

- **Git**: 혼자 쓰는 저장소이므로 브랜치를 만들지 말고 **`main`에 바로 커밋·푸시**합니다. 커밋·푸시는 사용자가 요청할 때만 합니다.
  - 사용자가 GitHub에서 직접 병합하는 경우가 있으니, 푸시 전에 `git fetch` 후 뒤처졌으면 `rebase`합니다.
- 사용자는 기능을 받으면 **로컬에서 직접 확인한 뒤** "반영해줘", "배포해줘"라고 요청합니다. 확인 전에는 커밋하지 않습니다.
- 커밋 메시지는 한국어 제목 + 변경 요약 목록 형식입니다.
- 기능을 바꾸면 `docs/`의 관련 문서(api, architecture, design/README)도 함께 고칩니다.

## 5. 함정과 해결법 (이번에 실제로 겪은 것)

### Windows PowerShell 5.1
- **커밋 메시지에 큰따옴표(")가 있으면** `git commit -m @'...'@`가 깨집니다(pathspec 오류). → 메시지를 파일로 써서 `git commit -F <파일>`로 넘깁니다.
- **`git push`가 종료 코드 255나 빨간 오류처럼 보여도** 진행 메시지가 stderr로 나온 것일 뿐입니다. `abc..def main -> main` 줄이 있으면 성공입니다.
- **`$env:X = ''`는 변수를 지웁니다.** 빈 값으로 덮어쓰는 효과가 없어서 `.env` 값이 그대로 쓰입니다(실제 메일이 나갈 뻔함). 테스트용 설정은 별도 폴더의 `.env`로 분리합니다(아래 6번).
- `Set-Content -Encoding utf8`은 BOM을 붙입니다. `.env` 첫 줄이 주석이라 문제는 없었습니다.

### 개발 서버
- **개발 서버가 켜진 상태에서 브랜치를 바꾸면** Vite가 `vite.config.ts`가 잠깐 없는 순간에 재시작해서 `/api` 프록시가 빠집니다(로그인 404). → 브랜치 전환 뒤에는 프론트 개발 서버를 다시 켭니다.
- 백엔드 `npm run dev`(tsx watch)는 소스가 바뀌면 재시작하고, **그때마다 마이그레이션이 로컬 DB에 적용됩니다.**
- 백엔드는 `0.0.0.0:4000`, 프론트는 `localhost:5173`입니다. 첫 기동은 몇 초 걸리니 health 체크를 재시도합니다.

### 배포
- Render는 `NODE_ENV=production`이면 devDependencies를 빼고 설치하므로, 빌드 명령은 `npm ci --include=dev && npm run build`입니다([render.yaml](../render.yaml)).
- Render 무료 플랜은 SMTP가 막혀 있어서 메일은 Resend HTTP API로 보냅니다.
- Render 무료 플랜은 15분 동안 요청이 없으면 잠들고, 깨어날 때 첫 요청이 30초 이상 걸릴 수 있습니다. 매 정각 정리 작업도 잠든 동안에는 돌지 않습니다(시작 시 실행으로 보완).
- 프론트 오류 문구 "서버에 연결하지 못했어요. (상태코드)"는 응답이 JSON이 아니라는 뜻입니다. 백엔드까지 가지 못한 것이니 **프록시 주소나 서버 상태부터** 봅니다.

### PWA
- `npm run dev`(5173)에서는 서비스 워커가 돌지 않습니다. PWA 확인은 `npm run build` 후 `npx vite preview --port 4173`.
- 서비스 워커가 `/api/*`를 가로채지 않게 `navigateFallbackDenylist`를 꼭 유지합니다. 승인 메일 링크가 서버로 가야 합니다.
- 사이트 주소를 바꾸면 설치된 앱을 모두 다시 설치해야 합니다.

- 서비스 워커는 `src/sw.ts`를 직접 작성하는 방식(injectManifest)입니다. 이 파일은 워커 환경이라 `tsconfig.sw.json`으로 따로 타입 검사합니다(`npm run typecheck`가 둘 다 실행).
- 푸시 알림 키(VAPID)는 **한 번 정하면 바꾸지 않습니다.** 바꾸면 모든 기기 구독이 무효가 됩니다. 로컬 `backend/.env`에는 로컬 전용 키, Render에는 별도 키.
- 푸시 받는 사람 규칙은 로컬 가짜 HTTPS 푸시 서버로 시험할 수 있습니다: 자체 서명 인증서 + 테스트 서버 `.env`에 `NODE_TLS_REJECT_UNAUTHORIZED=0`, 구독은 `crypto.createECDH('prime256v1')`로 만든 가짜 키로 등록.

### Fastify
- `disableRequestLogging: true`가 현재 버전에서 deprecation 경고(FSTDEP023)를 냅니다. Fastify 5에서는 동작하고, 6으로 올릴 때 바꿔야 합니다.

## 6. 로컬에서 시험하는 방법

- **로컬 계정** (`backend/local.db`, 비밀번호 모두 `1234`)

  | 이메일 | 가족관계 | 권한 |
  | --- | --- | --- |
  | `mom@example.com` | 엄마 | 관리자 |
  | `dad@example.com` | 아빠 | 관리자 |
  | `kid@example.com` | 큰딸 | 일반 |

- `backend/.env`에는 **실제 Resend 키**가 들어 있습니다. 로컬 4000번 서버로 가입 요청을 보내면 진짜 메일이 나갑니다.
- **메일 없는 테스트 서버** 띄우는 법:
  1. 임시 폴더에 `.env.example`을 복사해 `.env`를 만들고 `PORT=4100`, `JWT_SECRET=<32자 이상>`, `TURSO_DATABASE_URL=file:C:/workspace/hhcw_diary/backend/local.db`로 바꿉니다. `RESEND_API_KEY`는 비워 둡니다.
  2. 그 폴더에서 `node C:\workspace\hhcw_diary\backend\node_modules\tsx\dist\cli.mjs C:\workspace\hhcw_diary\backend\src\index.ts`를 실행합니다.
  3. `http://localhost:4100/api`로 요청하면 메일 내용이 서버 로그에만 찍힙니다.
- API 시험은 Node 스크립트(`fetch` + 쿠키)로 하고, 승인 토큰은 `@libsql/client`로 `local.db`의 `signup_tokens`에서 읽었습니다.
- 테스트로 만든 데이터는 끝나고 지웁니다. 사용자가 직접 올린 로컬 피드(10월 21일 "오늘은 너무 힘든 날이였다")가 있으니 건드리지 않습니다.
- 사진 삭제 실패는 R2/로컬 파일 자리에 같은 이름의 **폴더**를 만들어 재현했습니다.
- 자동화된 테스트 코드는 아직 없습니다. 지금까지는 위 방식으로 수동 확인했고, **화면은 사용자가 브라우저로 직접 확인**했습니다.

## 7. 운영 설정 확인 목록 (사용자 쪽에서 할 일)

- [ ] Render `MAIL_FROM` = `우리가족 <onboarding@resend.dev>` (naver.com 같은 미인증 도메인이면 Resend가 403으로 거부합니다. 로컬 `.env`도 마지막 확인 때 바뀌지 않은 상태였습니다)
- [ ] `ADMIN_EMAIL` = Resend 가입 메일 주소 (도메인 인증 전에는 그 주소로만 받을 수 있습니다)
- [ ] Render `APP_URL` = Netlify 사이트 주소
- [ ] R2 버킷 Public Development URL(r2.dev) 꺼짐, Custom Domain 없음, `R2_PUBLIC_URL` 비어 있음
- [ ] R2 API 토큰 권한이 이 버킷 하나의 Object Read & Write로 제한됨
- [ ] 가족들에게 내 정보에서 호칭을 바꾸도록 안내 (마이그레이션 직후에는 호칭 = 가족관계)

## 8. 남은 일 / 아이디어

| 항목 | 메모 |
| --- | --- |
| 로그인·가입 요청 횟수 제한 | 아직 없음 |
| 비밀번호 변경·찾기 | 없음. 내 정보 화면에 추가하기 좋음 |
| 가족관계 변경 | 화면에서는 불가. 지금은 Turso 콘솔에서 `UPDATE users SET relation=...` 후 서버 재시작 |
| 승인 링크 미리 열림 | 회사 메일의 링크 검사기가 GET을 먼저 열면 1회용 링크가 소모될 수 있음. 생기면 확인 버튼 화면을 한 단계 추가 |
| 서명 URL 유효 시간 | 2시간. 줄이면 보안은 좋아지지만 캐시 효율이 떨어짐 |
| 24시간 넘게 작성 중인 사진 | 자동 정리로 지워져 저장 시 "사진 정보가 올바르지 않아요" 오류가 날 수 있음 (드묾) |
| 자동화 테스트 | 없음. API 통합 테스트부터 추가 권장 |
| Fastify 6 대비 | `disableRequestLogging` 교체 |
| 정리 | `PencilIcon`이 더 이상 쓰이지 않음 |
