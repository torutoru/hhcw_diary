# API 명세

- 기본 경로: `/api` (운영에서는 Netlify 도메인의 `/api`가 Render로 프록시됨)
- 요청·응답 형식: JSON (이미지 업로드만 `multipart/form-data`)
- 인증: 로그인 시 `hhcw_session` 쿠키 발급. 🔒 = 로그인 필요, 👪 = `parent` 권한 필요
- 오류 응답: `{ "error": "사용자에게 보여줄 한국어 메시지" }`

## 인증 / 가입

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/auth/signup` | 가입 요청. `{ email, password(4자+), name(호칭) }` → 201. 관리자에게 승인 메일 발송. 승인 대기 중인 이메일로 다시 요청하면 정보 갱신 후 새 링크 발송. 이미 가입된 이메일은 409 |
| GET | `/signup/confirm/:token` | 승인 메일 링크. 처리 후 `{APP_URL}/signup/confirm?status=success\|expired\|used\|invalid&email=…` 로 302 이동 |
| POST | `/auth/login` | `{ email, password }` → `{ user }` + 쿠키. 틀리면 401, 승인 전이면 403 |
| POST | `/auth/logout` | 쿠키 삭제 |
| GET | `/auth/me` 🔒 | `{ user: { id, email, name, role } }` |

## 피드

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/feeds?before=YYYY-MM-DD&limit=10` 🔒 | 최신순 목록. `{ items: FeedListItem[], nextBefore }`. 다음 페이지는 `before=nextBefore` |
| GET | `/feeds/today` 🔒 | `{ date, feed: FeedDetail \| null }` (작성/수정 화면용) |
| GET | `/feeds/:id` 🔒 | `{ feed: FeedDetail }` |
| POST | `/feeds` 👪 | 오늘 피드 작성. `{ body, imageIds: [대표, ...추가] }` (1~6장). 오늘 피드가 있으면 409 |
| PUT | `/feeds/:id` 👪 | 오늘 피드 수정. 본문은 POST와 같음. 빠진 사진은 R2에서 삭제. 지난 피드는 403 |

```ts
FeedListItem = { id, date, isToday, coverUrl, photoCount, commentCount, comments: { author, body }[] /* 앞 2개 */ }
FeedDetail   = { id, date, isToday, body, author, createdAt, updatedAt, commentCount, photos: { id, url, width, height }[] }
```

## 댓글

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/feeds/:id/comments?offset=0&limit=5` 🔒 | 오래된 순. `{ items: { id, author, body, createdAt }[], total }` |
| POST | `/feeds/:id/comments` 🔒 | `{ body }` (1~500자) → `{ comment }` |

## 이미지

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/images` 👪 | `multipart/form-data`, 필드 `file` 1개 (최대 25MB). WebP로 변환해 R2에 저장 → `{ id, url, width, height, bytes }` |
| GET | `/images/file/*` 🔒 | **로컬 개발 전용** (R2 설정이 없을 때만 등록됨) |

## 기타

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/health` | `{ ok: true }` (Render 헬스체크) |
