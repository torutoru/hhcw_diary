import type { FastifyBaseLogger } from 'fastify';
import { db } from '../db/client.js';
import { storage } from './storage.js';
import { nowISO } from './time.js';

const RETRY_BATCH = 500;

async function recordFailure(key: string, err: unknown) {
  const now = nowISO();
  await db.execute({
    sql: `INSERT INTO storage_deletions (storage_key, attempts, last_error, created_at, last_tried_at)
          VALUES (?, 1, ?, ?, ?)
          ON CONFLICT(storage_key) DO UPDATE SET
            attempts = attempts + 1,
            last_error = excluded.last_error,
            last_tried_at = excluded.last_tried_at`,
    args: [key, String((err as Error)?.message ?? err).slice(0, 500), now, now],
  });
}

/**
 * 저장소(R2) 파일을 지운다. 실패한 파일은 storage_deletions 에 남겨 두고 나중에 다시 지운다.
 * DB 의 images 행은 호출하는 쪽에서 먼저 정리한다 (DB 가 기준, 파일은 뒤따라 지움).
 */
export async function deleteStoredFiles(keys: string[], log: FastifyBaseLogger) {
  for (const key of keys) {
    try {
      await storage.delete(key);
    } catch (err) {
      log.warn(`사진 파일 삭제 실패, 나중에 다시 시도: ${key} (${(err as Error).message})`);
      await recordFailure(key, err).catch((e) => log.error(e));
    }
  }
}

/** 삭제에 실패했던 파일을 다시 지운다. 서버 시작 시와 매 정각에 실행 */
export async function retryFailedDeletions(log: FastifyBaseLogger) {
  const rs = await db.execute({
    sql: 'SELECT storage_key FROM storage_deletions ORDER BY created_at LIMIT ?',
    args: [RETRY_BATCH],
  });
  if (!rs.rows.length) return;

  let ok = 0;
  let failed = 0;
  for (const row of rs.rows) {
    const key = String(row.storage_key);
    try {
      await storage.delete(key);
      await db.execute({ sql: 'DELETE FROM storage_deletions WHERE storage_key = ?', args: [key] });
      ok++;
    } catch (err) {
      await recordFailure(key, err);
      failed++;
    }
  }
  log.info(`사진 파일 삭제 재시도: 성공 ${ok}개, 실패 ${failed}개`);
}
