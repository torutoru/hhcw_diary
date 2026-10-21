import { buildApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { retryFailedDeletions } from './lib/fileCleanup.js';
import { isR2Configured } from './lib/storage.js';
import { cleanupOrphanImages } from './routes/images.js';

const HOUR_MS = 60 * 60 * 1000;

const app = await buildApp();
await migrate((msg) => app.log.warn(msg));

if (!isR2Configured) app.log.warn('R2 설정이 없어 사진을 backend/.uploads 에 저장해요 (로컬 개발용).');

// 사진 정리: 연결 안 된 사진(24시간 경과) 삭제 + 삭제 실패한 파일 재시도
async function maintenance() {
  await cleanupOrphanImages(app.log).catch((err) => app.log.error(err));
  await retryFailedDeletions(app.log).catch((err) => app.log.error(err));
}

// 서버 시작 시 한 번, 이후 매 정각마다. (Render 무료 플랜은 잠든 동안 돌지 않고, 깨어날 때 시작 시 실행으로 처리된다)
maintenance();
setTimeout(() => {
  maintenance();
  setInterval(maintenance, HOUR_MS).unref();
}, HOUR_MS - (Date.now() % HOUR_MS)).unref();

await app.listen({ port: config.PORT, host: '0.0.0.0' });
