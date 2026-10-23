# 아키텍처

```
 브라우저 ──▶ Netlify (React 정적 파일)
              │  /api/*  프록시 (같은 도메인)
              ▼
            Render (Fastify API) ──▶ Turso (사용자·피드·댓글·이미지 메타데이터)
              │                 └──▶ Cloudflare R2 (WebP 이미지 파일)
              ├──▶ Resend (관리자 승인 메일)
              └──▶ Web Push (FCM·Apple 등 브라우저 푸시 서비스 → 가족 휴대폰 알림)
```

- 프론트는 PWA입니다(홈 화면 설치, 서비스 워커 `frontend/src/sw.ts`). 자세한 내용은 [pwa.md](pwa.md).

## 폴더

| 폴더 | 내용 |
| --- | --- |
| `frontend/` | React 18 + Vite + TypeScript, react-router, vite-plugin-pwa(Workbox) |
| `backend/` | Node.js + Fastify 5 + TypeScript |
| `docs/` | 참고 자료와 설계 문서 |

## 기술 선택

**백엔드: Node.js + Fastify**
- 이미지 리사이즈·WebP 변환에 쓰는 `sharp`(libvips)가 Node에서 가장 빠르고 안정적입니다.
- Turso 공식 클라이언트(`@libsql/client`)와 R2용 S3 SDK가 모두 Node에서 잘 지원됩니다.
- Fastify는 Express보다 가볍고 빠르며, 멀티파트 업로드와 JWT 쿠키 플러그인이 공식으로 제공됩니다.
- 프론트와 같은 TypeScript라 타입 정의를 맞추기 쉽습니다.

**Netlify `/api` 프록시**
- 프론트(netlify.app)와 API(onrender.com) 도메인이 다르면 로그인 쿠키가 서드파티 쿠키가 되어 Safari 등에서 막힙니다.
- Netlify가 `/api/*` 를 Render로 넘겨주면 브라우저 입장에서는 같은 도메인이라 `httpOnly` 쿠키가 그대로 동작합니다. CORS 설정도 필요 없습니다.
- 승인 메일 링크도 시안 그대로 `https://[도메인]/api/signup/confirm/[uuid]` 형태가 됩니다.

**메일: Resend HTTP API**
- Render 무료 인스턴스는 외부 SMTP 포트가 막혀 있어 HTTP API로 보냅니다.
- `RESEND_API_KEY` 가 없으면 메일 내용을 서버 로그에 출력합니다 (로컬 개발용).

## 인증

- 비밀번호: bcrypt 해시
- 세션: JWT를 `hhcw_session` `httpOnly` 쿠키에 저장 (`SameSite=Lax`, 운영에서 `Secure`)
  - 로그인 화면 "아이디 · 로그인 상태 기억하기"를 켜면 400일(크롬 최대치) 쿠키를 주고, 앱을 열 때마다 400일로 다시 늘립니다. 끄면 브라우저를 닫을 때 지워지는 세션 쿠키(JWT 최대 1일)입니다.
  - 브라우저 localStorage에는 **아이디(이메일)만** 저장합니다. 비밀번호는 저장하지 않습니다(평문 저장 시 PC를 쓰는 누구나 볼 수 있어서). 비밀번호 저장은 브라우저의 비밀번호 관리자에 맡깁니다.
- 매 요청 DB에서 사용자 상태·권한을 다시 읽으므로, 권한 변경이 바로 반영됩니다.
- **로그인 잠금**: 비밀번호를 **5번 연속** 틀리면 그 시점부터 **1시간** 로그인할 수 없습니다(`users.failed_logins`, `users.locked_until`).
  - 잠긴 동안은 비밀번호가 맞아도 423과 풀리는 시각을 돌려줍니다.
  - 로그인에 성공하면 틀린 횟수를 0으로 되돌립니다. 1시간이 지난 뒤 첫 시도에서도 0으로 되돌린 다음 처리합니다.
  - 가입되지 않은 이메일은 횟수를 세지 않습니다. 횟수는 계정 기준이라 여러 기기의 실패가 합쳐집니다.
  - 실패 처리는 `UPDATE … RETURNING` 한 문장이라 동시에 여러 번 틀려도 숫자가 꼬이지 않습니다.
  - 관리자가 바로 풀어 주려면 Turso 콘솔에서 `UPDATE users SET failed_logins = 0, locked_until = NULL WHERE email = '<이메일>';`
- 사용자 정보는 **가족관계**와 **호칭** 두 가지로 나뉩니다.
  - **가족관계**(`relation`): 권한 기준. 가입 때 입력하고 바꿀 수 없습니다 ([backend/src/lib/family.ts](../backend/src/lib/family.ts)).
    - '엄마', '아빠' → `parent` (피드 작성·수정, 구성원 관리 + 댓글)
    - 그 외 → `member` (보기 + 댓글)
  - **호칭**(`nickname`): 화면에 보이는 이름. 댓글·메뉴·구성원 목록에 쓰이고, 옆에 가족관계가 작게 붙습니다. 내 정보(`/me`)에서 바꿀 수 있습니다.
- 가족관계 '엄마', '아빠'는 각각 한 명만 등록할 수 있습니다. 세 단계로 막습니다.
  1. 가입 요청: 승인된 사람이나, 유효한 링크로 승인 대기 중인 사람이 이미 있으면 409
  2. 승인 링크: 그 사이 같은 가족관계가 승인됐으면 승인하지 않고 `status=taken`
  3. DB: `uniq_parent_relation` 부분 고유 인덱스 (`status = 'active'` 이고 가족관계가 엄마/아빠인 행)
- 서버 시작 시 기존 사용자의 `role` 도 가족관계 기준으로 다시 맞춥니다.
- 예전 DB의 `users.name`(호칭이자 권한 기준)은 서버 시작 시 `relation` 으로 이름이 바뀌고, 새 `nickname` 은 가족관계 값으로 채워집니다.

### 구성원 제거 (탈퇴 처리)

- 엄마·아빠는 가족 구성원 관리 화면에서 다른 구성원을 제거할 수 있습니다. 자기 자신은 제거할 수 없습니다.
- 행을 지우지 않고 `removed_at` 을 기록하고 `status` 를 `pending` 으로 돌립니다 (soft delete).
  - 매 요청 `status = 'active'` 를 확인하므로 세션이 바로 끊깁니다.
  - 남은 승인 링크는 사용 처리해서 다시 들어올 수 없습니다.
  - 지난 피드·댓글은 원래 호칭 그대로 남습니다.
  - 제거된 '엄마'/'아빠' 자리는 비어서 새로 등록할 수 있습니다.
- 제거된 사람이 다시 가입을 요청하면 `removed_at` 이 지워지고, 일반 가입처럼 관리자 승인을 받습니다.
- `removed_at` 컬럼은 이미 만들어진 DB에도 서버 시작 시 자동으로 추가됩니다.

## DB 스키마 (Turso / libSQL)

스키마는 [backend/src/db/migrate.ts](../backend/src/db/migrate.ts) 에 있고, 서버 시작 시 `CREATE TABLE IF NOT EXISTS` 로 적용됩니다.

| 테이블 | 주요 컬럼 |
| --- | --- |
| `users` | `email`(unique), `password_hash`, `relation`(가족관계, 권한 기준), `nickname`(호칭, 화면 표시), `role`, `status`(pending/active), `removed_at`(제거 시각), `failed_logins`·`locked_until`(로그인 잠금), `font_size`(글자 크기 small/normal/large), `approved_at`(승인 시각), `read_baseline_at`("N" 기준 시각: 기능 도입 시점, 이후 가입자는 비어 있어 승인 시각 사용) |
| `signup_tokens` | `token`(uuid), `user_id`, `expires_at`(1시간), `used_at` |
| `feeds` | `feed_date`(KST `YYYY-MM-DD`, **unique** → 하루 한 번), `author_id`, `body` |
| `images` | `storage_key`(원본 R2 키), `thumb_key`(리스트용 R2 키), `feed_id`, `position`(0 = 대표), `width`, `height`, `bytes`, `uploader_id`(올린 사람: 본인 사진만 즉시 삭제), `created_at`(24시간 지난 미연결 사진 정리 기준) |
| `comments` | `feed_id`, `author_id`, `body`, `edited_at`(작성자가 고친 시각), `deleted_at`(작성자가 삭제한 시각, 본문은 비움) |
| `feed_reads` | `user_id`, `feed_id`, `last_read_at` — 사람별·피드별 마지막으로 본 시각 ("N" 표시). 기준 시각은 `users.read_baseline_at`(기능 도입 시점 또는 승인 시점) |
| `push_subscriptions` | `endpoint`(기기 구분), `user_id`, `p256dh`, `auth`, `user_agent`, `last_used_at` — 웹 푸시 구독, 만료되면 자동 삭제 |
| `storage_deletions` | `storage_key`(삭제에 실패한 R2 경로), `attempts`, `last_error` — 정각마다 재시도 |

- 이미지 파일은 R2에만 있고, DB에는 **R2 키(`images/2026-10/<uuid>.webp`)만** 저장합니다.
- 화면에 줄 URL은 API가 응답할 때 키로 만듭니다 (아래 참고).
- 시각은 UTC ISO 문자열, "오늘" 판단은 한국 시간 기준입니다.

## 이미지 처리 흐름

```
[브라우저]                       [백엔드]                          [R2]
 사진 선택
 1차 축소 (긴 변 2560px, JPEG)
 한 장씩 POST /api/images  ──▶  sharp
                                 · EXIF 회전 적용, 메타데이터 제거
                                 · 긴 변 2048px로 리사이즈
                                 · WebP 품질 88→50 이진 탐색으로
                                   400KB 이하 최고 품질 선택
                                 · 안 되면 1600 → 1280 → 1024px  ──▶ PUT images/YYYY-MM/<uuid>.webp
                                 · 리스트용 1080px WebP           ──▶ PUT images/YYYY-MM/<uuid>_thumb.webp
                                 · images 행 저장 (feed_id = NULL, uploader_id)
 ◀── { id, url, thumbUrl, width, height, bytes }
 POST /api/feeds { imageIds }  ──▶  images.feed_id, position 연결
```

- **브라우저 1차 축소**: 휴대폰 원본(5~10MB)을 그대로 보내지 않아 업로드가 빠릅니다. 1.5MB 이하는 그대로 보냅니다.
- **서버 최종 변환**: Safari 등 일부 브라우저는 WebP 인코딩을 지원하지 않거나 품질이 일정하지 않아, 최종 변환은 서버에서 합니다.
- **결과 크기**: 일반 사진은 2048px, 200~400KB 정도가 나옵니다. 압축이 가장 어려운 노이즈 이미지(4000×3000, 4.5MB JPEG)로 시험했을 때 1600×1200, 400KB가 나왔습니다. 원본이 작은 사진은 200KB보다 작을 수 있으며, 일부러 키우지 않습니다.

### 리스트용 사진 (썸네일)

업로드할 때 두 벌을 저장합니다. 피드가 많이 쌓여도 메인 피드 스크롤이 가볍도록, 카드에는 작은 사진을 씁니다.

| | 원본 | 리스트용 |
| --- | --- | --- |
| 크기 | 긴 변 2048px, 200~400KB | 긴 변 **1080px**, 약 80~130KB (3배율 휴대폰에서 카드 폭을 선명하게 채우는 크기) |
| R2 키 | `images/2026-10/<id>.webp` | `images/2026-10/<id>_thumb.webp` (`images.thumb_key`) |
| 쓰는 곳 | 사진 크게 보기(라이트박스) | 메인 피드 카드, 상세 가로 스크롤, 작성 화면 미리보기 |

- 휴대폰 메모리는 파일 용량이 아니라 픽셀 수만큼 씁니다(2048×1536 ≈ 12MB, 1080×810 ≈ 3.5MB).
- 리스트용은 **이 기능 이후 업로드한 사진에만** 만듭니다. 그 전에 올린 사진은 `thumb_key`가 비어 있고, 화면에는 원본을 대신 보여줍니다(목록 `COALESCE(thumb_key, storage_key)`, 상세 `thumbUrl` = 원본). 기존 사진이 적어서 따로 변환하지 않기로 했습니다.
- 사진을 지울 때는 두 파일을 함께 지웁니다(`imageKeys`).
- 작성 화면은 업로드가 끝나면 미리보기를 휴대폰 원본(장당 수십 MB 메모리)에서 리스트용으로 바꿉니다.
- 메인 피드 카드는 `content-visibility: auto`로 화면 밖 카드의 그리기를 건너뛰고, 모든 사진은 `decoding="async"`로 그립니다.

### 쓰지 않는 사진 정리

| 상황 | 처리 |
| --- | --- |
| 작성 화면에서 새로 올린 사진을 X로 빼거나 "사진 바꾸기"로 교체 | 즉시 `DELETE /api/images/:id` (업로드 중이었다면 업로드가 끝나는 즉시) |
| 작성 화면에서 **취소** | 이번에 새로 올린 사진 모두 즉시 삭제 |
| 저장된 피드의 기존 사진을 빼고 **저장** | 저장 시 삭제 (빼고 취소하면 그대로 유지) |
| 창을 그냥 닫는 등 위에서 놓친 사진 | 피드에 연결되지 않은 채 **24시간**이 지나면 자동 삭제 |

- 삭제 순서: DB의 `images` 행을 먼저 지우고(DB가 기준) R2 파일을 지웁니다.
- R2 파일 삭제가 실패하면 경로를 `storage_deletions` 표에 기록합니다 (시도 횟수, 마지막 오류).
- **정리 작업**은 서버 시작 시 한 번, 이후 **매 정각**에 실행합니다 ([backend/src/index.ts](../backend/src/index.ts)).
  1. 24시간 지난 연결 안 된 사진 삭제
  2. `storage_deletions` 재시도: 성공하면 기록 삭제, 실패하면 시도 횟수 증가
- Render 무료 플랜은 잠든 동안 정각 작업이 돌지 않고, 깨어날 때 시작 시 실행으로 처리됩니다.

### 이미지 URL

- `R2_PUBLIC_URL`(버킷에 연결한 공개 도메인)이 있으면 `https://<도메인>/<키>` 를 씁니다. CDN 캐시가 되어 빠르지만, 주소를 아는 사람은 누구나 볼 수 있습니다 (키에 UUID가 있어 추측은 어렵습니다).
- 없으면 **서명된 URL**(2시간 유효)을 발급합니다. 로그인한 가족만 사진을 볼 수 있습니다. 서명 시각을 1시간 단위로 맞춰서 같은 시간대에는 URL이 같고, 브라우저 캐시가 동작합니다.
- 가족 사진이므로 기본값은 서명된 URL을 권장합니다.

## 알려진 제약 / 다음 작업 후보

- 메일 보안 검사기가 링크를 미리 열면(일부 회사 메일의 링크 검사) 승인 링크가 먼저 사용될 수 있습니다. 개인 메일(Gmail 등)에서는 문제가 없지만, 생기면 "승인하기" 버튼이 있는 확인 화면을 한 단계 두는 방식으로 바꿀 수 있습니다.
- 가입 요청 횟수 제한(rate limit)이 아직 없습니다. 로그인은 계정 잠금(5회 실패 → 1시간)으로 대응합니다.
- 비밀번호 변경·찾기 기능이 없습니다 (시안에 없음).
- Render 무료 플랜은 15분 동안 요청이 없으면 잠들어서, 첫 요청이 30초 이상 걸릴 수 있습니다.
