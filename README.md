# hhcw_diary — 우리가족

가족끼리만 쓰는 하루 한 장 사진 일기 SNS입니다.
부모 계정이 하루에 한 번 사진(최대 6장)과 이야기를 올리고, 가족 모두가 댓글을 남깁니다.
가입은 관리자가 메일로 승인합니다.

| 영역 | 기술 | 배포 |
| --- | --- | --- |
| [frontend/](frontend/) | React 18 · Vite · TypeScript | Netlify |
| [backend/](backend/) | Node.js · Fastify 5 · TypeScript · sharp | Render |
| DB | Turso (libSQL) — 이미지 외 모든 데이터 | |
| 이미지 | Cloudflare R2 — WebP(200~400KB)만 저장, DB에는 키만 보관 | |
| [docs/](docs/) | 디자인 참고 자료, 설계·API·배포 문서 | |

## 빠르게 실행하기

```bash
cd backend && cp .env.example .env && npm install && npm run dev    # :4000
cd frontend && npm install && npm run dev                           # :5173
```

로컬에서는 외부 서비스 없이 바로 실행됩니다 (파일 DB, 로컬 사진 폴더, 메일은 로그 출력).
자세한 내용은 [docs/deployment.md](docs/deployment.md)를 보세요.

## 문서

- [디자인 참고](docs/design/README.md)
- [아키텍처](docs/architecture.md)
- [API](docs/api.md)
- [설정과 배포](docs/deployment.md)
