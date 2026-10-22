# hhcw_diary — 우리가족

가족끼리만 쓰는 하루 한 장 사진 일기 SNS입니다.
엄마·아빠가 날짜마다 사진(최대 6장)과 이야기를 올리고, 가족 모두가 댓글을 남깁니다.
가입은 관리자가 메일로 승인하고, 휴대폰 홈 화면에 앱처럼 설치해 새 피드·댓글 알림을 받습니다.

| 영역 | 기술 | 배포 |
| --- | --- | --- |
| [frontend/](frontend/) | React 18 · Vite · TypeScript · PWA(홈 화면 설치, 푸시 알림) | Netlify |
| [backend/](backend/) | Node.js · Fastify 5 · TypeScript · sharp · web-push | Render |
| DB | Turso (libSQL) — 이미지 외 모든 데이터 | |
| 이미지 | Cloudflare R2 — WebP(200~400KB)만 저장, DB에는 키만 보관 | |
| [docs/](docs/) | 디자인 참고 자료, 설계·API·배포·PWA 문서, 개발 노트 | |

서비스 이름은 환경변수(`VITE_APP_NAME`, `APP_NAME`)로 정합니다. 기본값은 "우리가족"입니다.

## 빠르게 실행하기

```bash
cd backend && cp .env.example .env && npm install && npm run dev    # :4000
cd frontend && npm install && npm run dev                           # :5173
```

로컬에서는 외부 서비스 없이 바로 실행됩니다 (파일 DB, 로컬 사진 폴더, 메일은 로그 출력).
PWA·알림은 `npm run build` 후 `npx vite preview --port 4173`에서 확인합니다.

## 문서

- **[개발 노트](docs/dev-notes.md) — 다음 작업 전에 먼저 읽기**
- [디자인 참고](docs/design/README.md)
- [아키텍처](docs/architecture.md)
- [API](docs/api.md)
- [설정과 배포](docs/deployment.md)
- [PWA·푸시 알림](docs/pwa.md)
