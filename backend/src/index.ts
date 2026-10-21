import { buildApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { isR2Configured } from './lib/storage.js';
import { cleanupOrphanImages } from './routes/images.js';

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

const app = await buildApp();
await migrate((msg) => app.log.warn(msg));

if (!isR2Configured) app.log.warn('R2 설정이 없어 사진을 backend/.uploads 에 저장해요 (로컬 개발용).');

const cleanup = () => cleanupOrphanImages((msg) => app.log.info(msg)).catch((err) => app.log.error(err));
cleanup();
setInterval(cleanup, CLEANUP_INTERVAL_MS).unref();

await app.listen({ port: config.PORT, host: '0.0.0.0' });
