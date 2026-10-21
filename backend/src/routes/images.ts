import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { deleteStoredFiles } from '../lib/fileCleanup.js';
import { toWebp } from '../lib/image.js';
import { isR2Configured, readLocalFile, storage } from '../lib/storage.js';
import { nowISO } from '../lib/time.js';
import { requireParent, requireUser } from '../plugins/auth.js';

const ORPHAN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * 사진은 한 장씩 먼저 올리고 받은 id 목록으로 피드를 저장한다.
 * 요청 하나가 작아서 모바일에서도 안정적이고, 장마다 진행 상태를 보여줄 수 있다.
 */
export async function imageRoutes(app: FastifyInstance) {
  app.post('/api/images', { preHandler: requireParent }, async (req, reply) => {
    const file = await req.file();
    if (!file) throw badRequest('사진 파일이 없어요.');
    if (!file.mimetype.startsWith('image/')) throw badRequest('이미지 파일만 올릴 수 있어요.');

    const input = await file.toBuffer();
    let out;
    try {
      out = await toWebp(input);
    } catch {
      throw badRequest('이 사진 형식은 읽을 수 없어요. JPG나 PNG로 올려 주세요.');
    }

    const id = randomUUID();
    const now = nowISO();
    const key = `images/${now.slice(0, 7)}/${id}.webp`;
    await storage.put(key, out.data, 'image/webp');
    await db.execute({
      sql: `INSERT INTO images (id, storage_key, width, height, bytes, uploader_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [id, key, out.width, out.height, out.bytes, req.currentUser!.id, now],
    });

    return reply.code(201).send({
      id,
      url: await storage.url(key),
      width: out.width,
      height: out.height,
      bytes: out.bytes,
    });
  });

  // 작성 화면에서 뺀 사진을 바로 지운다. 아직 피드에 연결되지 않은, 내가 올린 사진만 가능
  // (피드에 연결된 사진은 피드를 저장할 때 빠지면 지워진다)
  app.delete<{ Params: { id: string } }>('/api/images/:id', { preHandler: requireParent }, async (req) => {
    const rs = await db.execute({
      sql: 'SELECT storage_key, feed_id, uploader_id FROM images WHERE id = ?',
      args: [req.params.id],
    });
    const row = rs.rows[0];
    if (!row) throw notFound('이미 삭제된 사진이에요.');
    if (row.uploader_id !== req.currentUser!.id) throw forbidden('내가 올린 사진만 삭제할 수 있어요.');
    if (row.feed_id !== null) throw conflict('피드에 연결된 사진은 피드를 저장할 때 정리돼요.');

    await db.execute({ sql: 'DELETE FROM images WHERE id = ? AND feed_id IS NULL', args: [req.params.id] });
    await deleteStoredFiles([String(row.storage_key)], req.log);
    return { ok: true };
  });

  if (!isR2Configured) {
    // 로컬 개발용 파일 서빙
    app.get<{ Params: { '*': string } }>('/api/images/file/*', { preHandler: requireUser }, async (req, reply) => {
      const data = await readLocalFile(req.params['*']);
      if (!data) throw notFound();
      return reply.type('image/webp').header('Cache-Control', 'private, max-age=31536000, immutable').send(data);
    });
  }
}

/** 피드에 연결되지 않은 채 하루가 지난 사진(창을 그냥 닫은 경우 등)을 지운다 */
export async function cleanupOrphanImages(log: FastifyBaseLogger) {
  const cutoff = new Date(Date.now() - ORPHAN_TTL_MS).toISOString();
  const rs = await db.execute({
    sql: 'SELECT id, storage_key FROM images WHERE feed_id IS NULL AND created_at < ?',
    args: [cutoff],
  });
  if (!rs.rows.length) return;

  await db.execute({
    sql: `DELETE FROM images WHERE feed_id IS NULL AND id IN (${rs.rows.map(() => '?').join(',')})`,
    args: rs.rows.map((r) => r.id),
  });
  await deleteStoredFiles(
    rs.rows.map((r) => String(r.storage_key)),
    log,
  );
  log.info(`연결되지 않은 사진 ${rs.rows.length}장 정리`);
}
