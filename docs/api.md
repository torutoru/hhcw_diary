# API 명세

- 기본 경로: `/api` (운영에서는 Netlify 도메인의 `/api`가 Render로 프록시됨)
- 요청·응답 형식: JSON (이미지 업로드만 `multipart/form-data`)
- 인증: 로그인 시 `hhcw_session` 쿠키 발급. 🔒 = 로그인 필요, 👪 = `parent` 권한 필요
- 오류 응답: `{ "error": "사용자에게 보여줄 한국어 메시지" }`

## 인증 / 가입

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/auth/signup` | 가입 요청. `{ email, password(4자+), relation(가족관계), nickname(호칭) }` → 201. 관리자에게 승인 메일 발송. 가족관계가 '엄마'/'아빠'면 `parent`, 그 외 `member`. 승인 대기 중인 이메일로 다시 요청하면 정보 갱신 후 새 링크 발송. 이미 가입된 이메일, 이미 등록된 '엄마'/'아빠' 가족관계는 409 |
| GET | `/signup/confirm/:token` | 승인 메일 링크. 처리 후 `{APP_URL}/signup/confirm?status=success\|expired\|used\|invalid\|taken&email=…&relation=…` 로 302 이동 |
| POST | `/auth/login` | `{ email, password, remember? }` → `{ user }` + 쿠키. 틀리면 401(남은 횟수 안내), 승인 전·제거된 계정이면 403, **잠긴 계정이면 423**(풀리는 시각 안내). `remember: true` 면 30일 쿠키(로그인된 요청마다 다시 30일로 연장, 하루 한 번 새로 발급), 아니면 브라우저를 닫으면 사라지는 세션 쿠키(최대 1일) |
| POST | `/auth/logout` | 쿠키 삭제 → `{ ok }` |
| GET | `/auth/me` 🔒 | `{ user: User }`. 로그인 안 됨(쿠키 없음·만료·잘못됨)이면 401. 화면은 정상이면 피드, 서버의 실제 오류(401·403·500 등)면 로그인 화면. 서버가 답하지 않으면(시간 초과·프록시 오류·로딩 페이지 등 JSON 아닌 응답) 1분씩 최대 2번 기다린 뒤 로그인 화면 |
| PATCH | `/auth/me` 🔒 | 내 정보 수정. `{ nickname?, fontSize? }` 중 바꿀 것만 (호칭 1~20자, 글자 크기 `'small' \| 'normal' \| 'large'`, 둘 다 없으면 400) → `{ user }`. 이메일·가족관계는 바꿀 수 없음 (보내도 무시) |

🔒 API 공통: `remember` 세션은 토큰을 받은 지 하루가 넘었으면 응답에 새 30일 쿠키(`Set-Cookie`)가 붙습니다(마지막 사용 후 29~30일 유지).

```ts
User = { id, email, nickname /* 호칭: 화면 표시 이름 */, relation /* 가족관계: 권한 기준 */, role: 'parent' | 'member', fontSize: 'small' | 'normal' | 'large' /* 글자 크기 75%·100%·125% */ }
```

## 피드

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/feeds?before=YYYY-MM-DD&limit=10` 🔒 | 최신순 목록(`limit` 기본 10, 최대 30). `{ items: FeedListItem[], nextBefore }`. 다음 페이지는 `before=nextBefore` |
| GET | `/feeds/dates?month=YYYY-MM` 🔒 | 달력용(작성하기·검색하기). `{ month, today, dates: string[], feeds: { date, id }[] }` — 그 달에 피드가 있는 날짜와 피드 id |
| GET | `/feeds/by-date/:date` 🔒 | `{ date, isToday, feed: FeedDetail \| null }` (작성/수정 화면용). 미래·없는 날짜는 400 |
| GET | `/feeds/:id` 🔒 | `{ feed: FeedDetail }` |
| POST | `/feeds/:id/read` 🔒 | 상세를 열 때 읽음 처리 → `{ previousReadAt }` (이전에 본 시각, 처음이면 기준 시각). 화면은 그 뒤 달린 남의 댓글에 "N". 없는 피드는 404 |
| POST | `/feeds` 👪 | 피드 작성. `{ date?, body, imageIds: [대표, ...추가] }` (1~6장). `date` 없으면 오늘. 지난 날짜 가능, 미래는 400. 그 날짜에 이미 있으면 409 → 201 `{ feed: FeedDetail }` |
| PUT | `/feeds/:id` 👪 | 피드 수정 (지난 날짜 포함). 본문은 `{ body, imageIds }`. 빠진 사진은 R2에서 삭제 → `{ feed: FeedDetail }`. 없는 피드는 404 |

```ts
FeedListItem = { id, date, isToday, coverUrl, photoCount, commentCount, comments: { id, author, authorRelation, body, deleted }[] /* 가장 최근 댓글 1개 */,
                 isNew /* 안 본 남의 피드 */, newComments /* 마지막으로 본 뒤 남의 댓글 수 */ }
FeedDetail   = { id, date, isToday, body, author, authorRelation, createdAt, updatedAt, commentCount, photos: { id, url /* 원본 */, thumbUrl /* 리스트용 */, width, height }[] }
// FeedListItem.coverUrl 은 리스트용 사진
```

## 댓글

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/feeds/:id/comments?limit=3&before=<댓글 id>` 🔒 | 시간순(오래된 것 → 최신). `before` 없으면 최신 `limit`개(기본 3), 있으면 그 댓글보다 이전 `limit`개(최대 50). `{ items: Comment[], total, hasMore }` (`hasMore` = 더 이전 댓글 있음). 삭제된 댓글도 자리를 지키며 포함됨 |
| POST | `/feeds/:id/comments` 🔒 | `{ body }` (1~500자) → `{ comment }` |
| PATCH | `/feeds/:id/comments/:commentId` 🔒 | **본인 댓글만** 수정 `{ body }`(1~500자) → `{ ok, body }`. `edited` 가 true 가 됨. 남의 댓글은 403, 삭제됐거나 없으면 404. 알림 없음 |
| DELETE | `/feeds/:id/comments/:commentId` 🔒 | **본인 댓글만** 삭제 → `{ ok }`. 남의 댓글은 403, 이미 삭제됐거나 없으면 404 |

```ts
Comment = { id, author /* 호칭 */, authorRelation /* 가족관계 */, body, createdAt, deleted /* 삭제됨이면 body 는 "" */, edited /* 수정됨 */, mine /* 내 댓글 */ }
```

- 삭제는 본문을 비우고 `deleted_at` 을 기록합니다 (행은 남김). 화면에는 그 자리에 "작성자의 요청으로 댓글이 삭제되었습니다"가 표시됩니다.
- `total`, 피드 목록의 `commentCount` 는 삭제된 자리까지 포함한 수입니다. 피드 목록의 `comments` 미리보기 항목에도 `id`, `deleted` 가 있습니다.

## 가족 구성원 관리 (👪 엄마·아빠만)

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/members` 👪 | `{ me: User, members: User[] }`. `members` 는 나를 뺀 승인된 구성원 (승인 순) |
| DELETE | `/members/:id` 👪 | 구성원 제거(탈퇴 처리) → `{ ok, nickname }`. 나 자신은 400, 이미 제거됐거나 없으면 404 |

제거된 계정은 바로 세션이 끊기고, 로그인하면 403("가족에서 제거된 계정이에요")을 받습니다. 다시 가입 요청을 보내 관리자 승인을 받으면 돌아올 수 있습니다.

## 이미지

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/images` 👪 | `multipart/form-data`, 필드 `file` 1개 (최대 25MB). 원본(2048px)과 리스트용(1080px) WebP를 R2에 저장 → `{ id, url, thumbUrl, width, height, bytes }` |
| DELETE | `/images/:id` 👪 | 작성 화면에서 뺀 사진 즉시 삭제 → `{ ok }`. **내가 올렸고 아직 피드에 연결되지 않은** 사진만. 남의 사진 403, 피드에 연결된 사진 409, 없으면 404. R2 삭제가 실패해도 200 (나중에 재시도) |
| GET | `/images/file/*` 🔒 | **로컬 개발 전용** (R2 설정이 없을 때만 등록됨) |

## 푸시 알림

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/push/public-key` | `{ publicKey }` — 서버에 VAPID 키가 없으면 `null` (화면에서 알림 기능 숨김) |
| POST | `/push/subscribe` 🔒 | 이 기기 알림 켜기. 브라우저의 `PushSubscription.toJSON()` 그대로 (`{ endpoint, keys: { p256dh, auth } }`) → 201. 같은 기기를 다른 계정으로 구독하면 주인이 바뀜. 키가 없으면 503 |
| DELETE | `/push/subscribe` 🔒 | 이 기기 알림 끄기 `{ endpoint }` (로그아웃 시에도 호출) |

발송 시점: 피드 작성(올린 사람 제외 모두), 댓글 작성(피드 작성자 + 그 피드에 댓글 단 사람, 본인 제외). 알림 내용 형식은 `backend/src/lib/push.ts`의 `PushPayload`.

## 기타

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/health` | `{ ok: true }` (Render 헬스체크) |
