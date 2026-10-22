import { randomUUID } from 'node:crypto';
import type { InStatement } from '@libsql/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { deleteStoredFiles } from '../lib/fileCleanup.js';
import { imageKeys } from './images.js';
import { commentRecipients, displayName, feedRecipients, sendPush, shortDate } from '../lib/push.js';
import { storage } from '../lib/storage.js';
import { nowISO, todayKST } from '../lib/time.js';
import { requireParent, requireUser } from '../plugins/auth.js';

const MAX_PHOTOS = 6; // 대표 사진 1 + 추가 5
const PREVIEW_COMMENTS = 2;

// 실제로 있는 날짜이면서 오늘(KST) 이전인지. 미래 날짜의 피드는 만들 수 없다
const feedDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않아요.')
  .refine((d) => new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d, '없는 날짜예요.')
  .refine((d) => d <= todayKST(), '아직 오지 않은 날의 피드는 쓸 수 없어요.');

const feedBody = z.object({
  body: z.string().max(5000).default(''),
  // 첫 번째가 대표 사진
  imageIds: z.array(z.string().uuid()).min(1, '대표 사진을 골라 주세요.').max(MAX_PHOTOS, `사진은 ${MAX_PHOTOS}장까지 올릴 수 있어요.`),
});

const createBody = feedBody.extend({
  // 없으면 오늘. 지난 날짜의 피드도 쓸 수 있다
  date: feedDate.optional(),
});

const monthQuery = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, '월 형식이 올바르지 않아요.'),
});

const listQuery = z.object({
  before: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

const commentsQuery = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

const commentBody = z.object({
  body: z.string().trim().min(1, '댓글을 입력해 주세요.').max(500, '댓글은 500자까지 쓸 수 있어요.'),
});

async function feedPhotos(feedId: string) {
  const rs = await db.execute({
    sql: 'SELECT id, storage_key, thumb_key, width, height FROM images WHERE feed_id = ? ORDER BY position',
    args: [feedId],
  });
  return Promise.all(
    rs.rows.map(async (r) => ({
      id: String(r.id),
      // 원본(2048px): 크게 보기
      url: await storage.url(String(r.storage_key)),
      // 리스트용(1080px): 상세 가로 스크롤·작성 미리보기. 아직 없으면 원본
      thumbUrl: await storage.url(String(r.thumb_key ?? r.storage_key)),
      width: Number(r.width),
      height: Number(r.height),
    })),
  );
}

async function feedDetail(feedId: string) {
  const rs = await db.execute({
    sql: `SELECT f.id, f.feed_date, f.body, f.created_at, f.updated_at,
            u.nickname AS author_name, u.relation AS author_relation,
            (SELECT COUNT(*) FROM comments c WHERE c.feed_id = f.id) AS comment_count
          FROM feeds f JOIN users u ON u.id = f.author_id
          WHERE f.id = ?`,
    args: [feedId],
  });
  const row = rs.rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    date: String(row.feed_date),
    isToday: row.feed_date === todayKST(),
    body: String(row.body),
    author: String(row.author_name),
    authorRelation: String(row.author_relation),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    commentCount: Number(row.comment_count),
    photos: await feedPhotos(feedId),
  };
}

/**
 * 피드의 사진 목록을 imageIds 순서대로 맞추는 쿼리를 만든다.
 * 넘어온 id는 이 피드의 사진이거나 아직 피드에 붙지 않은 업로드여야 한다.
 */
async function photoStatements(feedId: string, imageIds: string[]) {
  if (new Set(imageIds).size !== imageIds.length) throw badRequest('같은 사진이 두 번 들어 있어요.');

  const placeholders = imageIds.map(() => '?').join(',');
  const rs = await db.execute({
    sql: `SELECT id FROM images WHERE id IN (${placeholders}) AND (feed_id IS NULL OR feed_id = ?)`,
    args: [...imageIds, feedId],
  });
  if (rs.rows.length !== imageIds.length) throw badRequest('사진 정보가 올바르지 않아요. 다시 올려 주세요.');

  const removed = await db.execute({
    sql: `SELECT id, storage_key, thumb_key FROM images WHERE feed_id = ? AND id NOT IN (${placeholders})`,
    args: [feedId, ...imageIds],
  });

  const stmts: InStatement[] = imageIds.map((id, position) => ({
    sql: 'UPDATE images SET feed_id = ?, position = ? WHERE id = ?',
    args: [feedId, position, id],
  }));
  for (const r of removed.rows) {
    stmts.push({ sql: 'DELETE FROM images WHERE id = ?', args: [r.id] });
  }
  return { stmts, removedKeys: removed.rows.flatMap(imageKeys) };
}

export async function feedRoutes(app: FastifyInstance) {
  // 메인 피드: 날짜 내림차순, 대표 사진 + 댓글 미리보기 2개
  app.get('/api/feeds', { preHandler: requireUser }, async (req) => {
    const { before, limit } = listQuery.parse(req.query);
    const rs = await db.execute({
      sql: `SELECT f.id, f.feed_date,
              -- 메인 피드 카드는 리스트용 사진(1080px). 아직 없으면 원본
              (SELECT COALESCE(thumb_key, storage_key) FROM images i WHERE i.feed_id = f.id ORDER BY position LIMIT 1)
                AS cover_key,
              (SELECT COUNT(*) FROM images i WHERE i.feed_id = f.id) AS photo_count,
              (SELECT COUNT(*) FROM comments c WHERE c.feed_id = f.id) AS comment_count
            FROM feeds f
            WHERE (? IS NULL OR f.feed_date < ?)
            ORDER BY f.feed_date DESC
            LIMIT ?`,
      args: [before ?? null, before ?? null, limit + 1],
    });
    const rows = rs.rows.slice(0, limit);
    const ids = rows.map((r) => String(r.id));

    const previews = new Map<
      string,
      { id: string; author: string; authorRelation: string; body: string; deleted: boolean }[]
    >();
    if (ids.length) {
      const crs = await db.execute({
        sql: `SELECT id, feed_id, author, author_relation, body, deleted_at FROM (
                SELECT c.id, c.feed_id, u.nickname AS author, u.relation AS author_relation, c.body, c.deleted_at,
                  ROW_NUMBER() OVER (PARTITION BY c.feed_id ORDER BY c.created_at) AS rn
                FROM comments c JOIN users u ON u.id = c.author_id
                WHERE c.feed_id IN (${ids.map(() => '?').join(',')})
              ) WHERE rn <= ?`,
        args: [...ids, PREVIEW_COMMENTS],
      });
      for (const c of crs.rows) {
        const list = previews.get(String(c.feed_id)) ?? [];
        list.push({
          id: String(c.id),
          author: String(c.author),
          authorRelation: String(c.author_relation),
          body: String(c.body),
          deleted: c.deleted_at !== null,
        });
        previews.set(String(c.feed_id), list);
      }
    }

    const today = todayKST();
    const items = await Promise.all(
      rows.map(async (r) => ({
        id: String(r.id),
        date: String(r.feed_date),
        isToday: r.feed_date === today,
        coverUrl: r.cover_key ? await storage.url(String(r.cover_key)) : null,
        photoCount: Number(r.photo_count),
        commentCount: Number(r.comment_count),
        comments: previews.get(String(r.id)) ?? [],
      })),
    );

    return {
      items,
      nextBefore: rs.rows.length > limit ? items[items.length - 1].date : null,
    };
  });

  // 달력용: 그 달에 피드가 있는 날짜 목록
  // feeds: 날짜별 피드 id (검색 달력에서 날짜를 누르면 상세를 열 때 사용)
  app.get('/api/feeds/dates', { preHandler: requireUser }, async (req) => {
    const { month } = monthQuery.parse(req.query);
    const rs = await db.execute({
      sql: 'SELECT id, feed_date FROM feeds WHERE feed_date LIKE ? ORDER BY feed_date',
      args: [`${month}-%`],
    });
    return {
      month,
      today: todayKST(),
      dates: rs.rows.map((r) => String(r.feed_date)),
      feeds: rs.rows.map((r) => ({ date: String(r.feed_date), id: String(r.id) })),
    };
  });

  // 특정 날짜의 피드 (작성/수정 화면용). 없으면 feed: null
  app.get<{ Params: { date: string } }>('/api/feeds/by-date/:date', { preHandler: requireUser }, async (req) => {
    const date = feedDate.parse(req.params.date);
    const rs = await db.execute({ sql: 'SELECT id FROM feeds WHERE feed_date = ?', args: [date] });
    const id = rs.rows[0]?.id;
    return { date, isToday: date === todayKST(), feed: id ? await feedDetail(String(id)) : null };
  });

  app.get<{ Params: { id: string } }>('/api/feeds/:id', { preHandler: requireUser }, async (req) => {
    const feed = await feedDetail(req.params.id);
    if (!feed) throw notFound('피드를 찾을 수 없어요.');
    return { feed };
  });

  // 하루 한 번: 그 날짜의 피드가 없을 때만 만들 수 있다
  app.post('/api/feeds', { preHandler: requireParent }, async (req, reply) => {
    const { body, imageIds, date = todayKST() } = createBody.parse(req.body);
    const exists = await db.execute({ sql: 'SELECT id FROM feeds WHERE feed_date = ?', args: [date] });
    if (exists.rows[0]) throw conflict('이 날짜의 피드는 이미 있어요. 달력에서 그 날짜를 눌러 수정해 주세요.');

    const id = randomUUID();
    const now = nowISO();
    const { stmts } = await photoStatements(id, imageIds);
    await db.batch(
      [
        {
          sql: 'INSERT INTO feeds (id, feed_date, author_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          args: [id, date, req.currentUser!.id, body, now, now],
        },
        ...stmts,
      ],
      'write',
    );

    // 새 피드 알림: 올린 사람을 뺀 가족 모두 (응답을 기다리게 하지 않는다)
    const me = req.currentUser!;
    void feedRecipients(me.id)
      .then((to) =>
        sendPush(
          to,
          {
            kind: 'feed',
            title: config.APP_NAME,
            body: `${displayName(me.nickname, me.relation)} 님이 ${shortDate(date)} 피드를 올렸어요`,
            url: `/feeds/${id}`,
            tag: `feed-${id}`,
          },
          req.log,
        ),
      )
      .catch((err) => req.log.error(err));

    return reply.code(201).send({ feed: await feedDetail(id) });
  });

  // 지난 날짜의 피드도 수정할 수 있다 (달력에서 선택)
  app.put<{ Params: { id: string } }>('/api/feeds/:id', { preHandler: requireParent }, async (req) => {
    const { body, imageIds } = feedBody.parse(req.body);
    const rs = await db.execute({ sql: 'SELECT 1 FROM feeds WHERE id = ?', args: [req.params.id] });
    if (!rs.rows[0]) throw notFound('피드를 찾을 수 없어요.');

    const { stmts, removedKeys } = await photoStatements(req.params.id, imageIds);
    await db.batch(
      [
        { sql: 'UPDATE feeds SET body = ?, updated_at = ? WHERE id = ?', args: [body, nowISO(), req.params.id] },
        ...stmts,
      ],
      'write',
    );
    await deleteStoredFiles(removedKeys, req.log);
    return { feed: await feedDetail(req.params.id) };
  });

  // 댓글: 오래된 순, 5개씩 더보기. 삭제된 댓글도 자리를 지키며 deleted: true 로 내려간다
  app.get<{ Params: { id: string } }>('/api/feeds/:id/comments', { preHandler: requireUser }, async (req) => {
    const { offset, limit } = commentsQuery.parse(req.query);
    const [list, count] = await db.batch(
      [
        {
          sql: `SELECT c.id, c.body, c.created_at, c.deleted_at, c.edited_at, c.author_id,
                  u.nickname AS author, u.relation AS author_relation
                FROM comments c JOIN users u ON u.id = c.author_id
                WHERE c.feed_id = ?
                ORDER BY c.created_at
                LIMIT ? OFFSET ?`,
          args: [req.params.id, limit, offset],
        },
        { sql: 'SELECT COUNT(*) AS n FROM comments WHERE feed_id = ?', args: [req.params.id] },
      ],
      'read',
    );
    return {
      items: list.rows.map((r) => ({
        id: String(r.id),
        author: String(r.author),
        authorRelation: String(r.author_relation),
        body: String(r.body),
        createdAt: String(r.created_at),
        deleted: r.deleted_at !== null,
        edited: r.edited_at !== null,
        mine: r.author_id === req.currentUser!.id,
      })),
      total: Number(count.rows[0].n),
    };
  });

  // 본인 댓글만 수정. 지운 댓글은 고칠 수 없다. 알림은 보내지 않는다
  app.patch<{ Params: { id: string; commentId: string } }>(
    '/api/feeds/:id/comments/:commentId',
    { preHandler: requireUser },
    async (req) => {
      const { body } = commentBody.parse(req.body);
      const rs = await db.execute({
        sql: 'SELECT author_id, deleted_at FROM comments WHERE id = ? AND feed_id = ?',
        args: [req.params.commentId, req.params.id],
      });
      const row = rs.rows[0];
      if (!row || row.deleted_at !== null) throw notFound('이미 삭제되었거나 없는 댓글이에요.');
      if (row.author_id !== req.currentUser!.id) throw forbidden('내가 쓴 댓글만 수정할 수 있어요.');

      await db.execute({
        sql: 'UPDATE comments SET body = ?, edited_at = ? WHERE id = ?',
        args: [body, nowISO(), req.params.commentId],
      });
      return { ok: true, body };
    },
  );

  // 본인 댓글만 삭제. 본문을 비우고 deleted_at 을 남긴다
  app.delete<{ Params: { id: string; commentId: string } }>(
    '/api/feeds/:id/comments/:commentId',
    { preHandler: requireUser },
    async (req) => {
      const rs = await db.execute({
        sql: 'SELECT author_id, deleted_at FROM comments WHERE id = ? AND feed_id = ?',
        args: [req.params.commentId, req.params.id],
      });
      const row = rs.rows[0];
      if (!row || row.deleted_at !== null) throw notFound('이미 삭제되었거나 없는 댓글이에요.');
      if (row.author_id !== req.currentUser!.id) throw forbidden('내가 쓴 댓글만 삭제할 수 있어요.');

      await db.execute({
        sql: "UPDATE comments SET body = '', deleted_at = ? WHERE id = ?",
        args: [nowISO(), req.params.commentId],
      });
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string } }>('/api/feeds/:id/comments', { preHandler: requireUser }, async (req, reply) => {
    const { body } = commentBody.parse(req.body);
    const feed = await db.execute({
      sql: `SELECT f.feed_date, u.nickname, u.relation FROM feeds f JOIN users u ON u.id = f.author_id
            WHERE f.id = ?`,
      args: [req.params.id],
    });
    const feedRow = feed.rows[0];
    if (!feedRow) throw notFound('피드를 찾을 수 없어요.');

    const comment = {
      id: randomUUID(),
      author: req.currentUser!.nickname,
      authorRelation: req.currentUser!.relation,
      body,
      createdAt: nowISO(),
      deleted: false,
      edited: false,
      mine: true,
    };
    await db.execute({
      sql: 'INSERT INTO comments (id, feed_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [comment.id, req.params.id, req.currentUser!.id, body, comment.createdAt],
    });

    // 새 댓글 알림: 피드 작성자 + 이 피드에 댓글을 단 사람 (본인 제외). 같은 피드 알림은 하나로 묶인다
    const me = req.currentUser!;
    const feedLabel = `${displayName(String(feedRow.nickname), String(feedRow.relation))} 님의 ${shortDate(
      String(feedRow.feed_date),
    )} 피드`;
    void commentRecipients(req.params.id, me.id)
      .then((to) =>
        sendPush(
          to,
          {
            kind: 'comment',
            title: config.APP_NAME,
            body: `${displayName(me.nickname, me.relation)}: ${body.length > 60 ? `${body.slice(0, 60)}…` : body}`,
            // #comments: 상세를 열면 댓글을 끝까지 불러와 최신 댓글 위치로 스크롤
            url: `/feeds/${req.params.id}#comments`,
            tag: `comments-${req.params.id}`,
            feedLabel,
          },
          req.log,
        ),
      )
      .catch((err) => req.log.error(err));

    return reply.code(201).send({ comment });
  });
}
