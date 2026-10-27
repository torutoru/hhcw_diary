# 디자인 참고 자료

- 원본: Claude 아티팩트 **우리가족 SNS** (Design 캔버스) — https://claude.ai/artifact/QzvuubdWvzkasdyubZ4eUw
- [artboards/](artboards/) 에 2026-10-21 기준 화면 소스(`.dc.html`)와 캔버스 정보(`canvas.json`)를 복사해 두었습니다. (가족 구성원 관리 화면 추가본 포함)
  이 파일들은 캔버스 전용 형식이라 브라우저에서 바로 열면 그대로 보이지 않습니다. 화면 확인은 위 링크에서 하세요.

## 화면 → 구현 위치

| 시안 | 파일 | 구현 |
| --- | --- | --- |
| 로그인 | `Main.dc.html` | [frontend/src/pages/LoginPage.tsx](../../frontend/src/pages/LoginPage.tsx) (`/login`) |
| 회원가입 | `Signup.dc.html` | [frontend/src/pages/SignupPage.tsx](../../frontend/src/pages/SignupPage.tsx) (`/signup`) |
| 메인 피드 | `Feed.dc.html` | [frontend/src/pages/FeedPage.tsx](../../frontend/src/pages/FeedPage.tsx) (`/`) |
| 피드 상세 (모달) | `Detail.dc.html` | [frontend/src/components/FeedDetailModal.tsx](../../frontend/src/components/FeedDetailModal.tsx) (`/feeds/:id`) |
| 피드 작성 / 수정 | `Compose.dc.html` | [frontend/src/pages/ComposePage.tsx](../../frontend/src/pages/ComposePage.tsx) (`/compose/:date`) |
| 메인 피드 우측 상단 메뉴 | `Feed.dc.html` | [frontend/src/components/ProfileMenu.tsx](../../frontend/src/components/ProfileMenu.tsx) |
| 가족 구성원 관리 | `Members.dc.html` | [frontend/src/pages/MembersPage.tsx](../../frontend/src/pages/MembersPage.tsx) (`/members`) |
| 관리자 승인 메일 | `ApprovalEmail.dc.html` | [backend/src/templates/approvalEmail.ts](../../backend/src/templates/approvalEmail.ts) |
| 승인 링크 결과 | `Confirm.dc.html` | [frontend/src/pages/ConfirmPage.tsx](../../frontend/src/pages/ConfirmPage.tsx) (`/signup/confirm`) |

## 디자인 토큰

[frontend/src/styles/global.css](../../frontend/src/styles/global.css) 의 `:root` 에 정의되어 있습니다.

| 이름 | 값 | 용도 |
| --- | --- | --- |
| `--bg` | `#F4F2EC` | 배경 |
| `--surface` | `#FFFFFF` | 카드, 입력창 |
| `--text` | `#1D2620` | 본문 |
| `--text-muted` | `#5E665F` | 보조 글자 |
| `--primary` | `#2F6B4F` | 주 버튼, 로고 |
| `--accent` | `#F2C14E` | "오늘" 배지 |
| `--danger` | `#A3361F` | 오류, 필수 표시 |
| `--border` / `--border-soft` | `#D8D4C8` / `#E4E1D8` | 입력창 / 카드 테두리 |
| `--dot` | `#2F6FD6` | 달력의 피드 있는 날 점 |
| `--font-scale` | `1` (0.75 / 1 / 1.25) | 글자 크기 설정 배율 |

- 글꼴: 제목 **Gowun Dodum**, 본문 **Noto Sans KR** (Google Fonts)
- 모서리: 입력·버튼 14px, 카드 20px, 모달 24px
- 기준 화면: 모바일 390px. 넓은 화면에서는 최대 480px로 가운데 정렬
- 글자 크기는 모두 `calc(Npx * var(--font-scale))`로 씁니다(내 정보 > 글자 크기). 버튼·입력칸·사진 크기는 바뀌지 않습니다.

## 시안에서 정해진 동작 규칙

- 가입 요청 → 관리자에게 승인 메일 → 링크 클릭으로 승인. 링크는 **1시간, 1회용**
- 비밀번호 4자 이상
- 피드는 **날짜마다 하나**, **엄마·아빠 계정만** 작성·수정
- **피드 작성하기** 버튼 → 달력(`/compose`, [CalendarPage.tsx](../../frontend/src/pages/CalendarPage.tsx)): 피드가 있는 날은 파란 점(누르면 수정), 빈 날은 누르면 작성. 미래 날짜는 선택 불가 (시안에는 없는 화면으로, 사용자 요청으로 추가)
- 오른쪽 아래 **플로팅 버튼**(62px 초록 원, 그림자). 시안은 작성하기 하나(＋/연필)였지만, 검색 기능이 추가되면서 사용자 요청으로 바뀌었습니다.
  - 일반 사용자: **돋보기** → 피드 검색하기 달력(`/search`, 피드 있는 날만 누를 수 있음, 누르면 상세가 달력 위에)
  - 엄마·아빠: **＋** → 누르면 ×로 돌며 "피드 작성하기"(연필 아이콘), "피드 검색하기"(돋보기 아이콘) 메뉴가 위로 펼쳐짐
- 사진: 대표 사진 1장(필수) + 추가 최대 5장
- 가족 구성원 관리: 관리자('엄마', '아빠')만 들어올 수 있고, 다른 구성원을 제거(탈퇴 처리)할 수 있음. 그 외에는 "관리자만 볼 수 있어요" 화면
- 메인 피드 카드: 댓글 앞 2개 미리보기 + "댓글 N개 더보기"
- 상세: 사진 가로 스와이프, 댓글 5개씩 더보기, 하단 댓글 입력

## 구현하면서 달라진 점

- **회원가입에 "가족관계"와 "호칭" 입력란 추가.** 시안의 댓글에 "할머니", "큰딸" 같은 이름이 보이는데 가입 폼에는 이름 입력이 없어서 추가했습니다.
  - **가족관계**는 권한 기준: '엄마', '아빠'면 피드 작성·수정과 구성원 관리(`parent`), 그 외는 보기·댓글(`member`). '엄마', '아빠'는 각각 한 명만. 가입 후 바꿀 수 없음
  - **호칭**은 화면에 보이는 이름: 댓글 등에서 이름으로 쓰이고 옆에 가족관계가 작게 붙음. 내 정보에서 수정 가능
- **승인 메일에 가족관계·호칭 행 추가.** 관리자가 누가 요청했는지 알 수 있게 했습니다.
- **승인 결과에 `invalid` 상태 추가.** 잘못된 링크로 들어온 경우를 위해서입니다.
- **승인 결과에 `taken` 상태 추가.** 승인 시점에 같은 가족관계('엄마'/'아빠')가 이미 승인되어 있으면 승인하지 않고 이 화면을 보여줍니다.
- **프로필 메뉴에 "내 정보" 추가** (`/me`, [MyInfoPage.tsx](../../frontend/src/pages/MyInfoPage.tsx)): 이메일(수정 불가), 호칭(수정 가능), 가족관계(수정 불가), **글자 크기**(작게 75%·보통·크게 125%, 누르면 바로 저장), **알림**(이 기기 알림 켜기·끄기). 시안에 없는 화면으로, 사용자 요청으로 추가
- **승인 메일에 권한 행 추가.** 관리자가 승인 전에 이 사람이 피드를 쓸 수 있는지 볼 수 있습니다.
- **댓글 미리보기·더보기 방식 변경.** 메인 카드는 가장 최근 댓글 1개(+ 위에 "댓글 N개 더보기"), 상세는 최근 3개만 보이고 "이전 댓글 N개 보기"를 누르면 댓글 영역이 펼쳐져(피드 내용은 한 줄 요약) 위로 올릴 때 20개씩 더 불러옵니다. 시간순(맨 아래가 최신)은 시안과 같습니다.
- **피드 검색하기 달력** (`/search`, [SearchPage.tsx](../../frontend/src/pages/SearchPage.tsx)): 피드 있는 날만 누를 수 있고, 상세가 달력 위에 뜸. 시안에 없음
- **⋯ 팝오버 메뉴**(내 댓글 수정하기·제거하기)와 **확인 시트**. 고친 댓글은 시간 옆 "· 수정됨"
- **상세 날짜 옆 "수정하기"** (엄마·아빠만)
- **안 본 피드·댓글 빨간 N** (카드 날짜 옆, 상세 댓글 이름 옆)
- **당겨서 새로고침**(메인 피드, 1초가 넘으면 짙은 덮개 + 가족 문구), 첫 로딩 가족 문구 화면, 스켈레톤 로딩
- **사진 크게 보기 확대** (핀치, 두 번 탭하면 확대 ↔ 원래 크기). 앱 화면 자체의 확대는 막음
- 작성·수정 화면은 **항상 사진 정리 모드**(사진이 흔들림): 사진을 끌어 순서 바꾸기(사진 더하기 안에서는 끼워 넣기, 대표 사진과는 맞바꾸기)
