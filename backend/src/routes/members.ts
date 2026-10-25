import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../db/client.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { nowISO } from '../lib/time.js';
import { requireUser, toSessionUser } from '../plugins/auth.js';

// 가족 구성원 관리는 관리자('엄마', '아빠')만
async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireUser(req, reply);
  if (req.currentUser!.role !== 'parent') throw forbidden('가족 구성원 관리는 엄마, 아빠만 할 수 있어요.');
}

export async function memberRoutes(app: FastifyInstance) {
  app.get('/api/members', { preHandler: requireAdmin }, async (req) => {
    const me = req.currentUser!;
    const rs = await db.execute({
      sql: `SELECT id, email, nickname, relation, role FROM users
            WHERE status = 'active' AND removed_at IS NULL AND id <> ?
            ORDER BY approved_at, created_at`,
      args: [me.id],
    });
    return { me, members: rs.rows.map(toSessionUser) };
  });

  // 제거 = 탈퇴 처리. 행은 남기고 로그인·세션을 막는다 (지난 댓글의 이름 유지)
  app.delete<{ Params: { id: string } }>('/api/members/:id', { preHandler: requireAdmin }, async (req) => {
    if (req.params.id === req.currentUser!.id) throw badRequest('나 자신은 제거할 수 없어요.');

    const rs = await db.execute({
      sql: "SELECT nickname FROM users WHERE id = ? AND status = 'active' AND removed_at IS NULL",
      args: [req.params.id],
    });
    if (!rs.rows[0]) throw notFound('이미 제거되었거나 없는 구성원이에요.');

    const now = nowISO();
    await db.batch(
      [
        {
          sql: "UPDATE users SET status = 'pending', removed_at = ? WHERE id = ?",
          args: [now, req.params.id],
        },
        // 남아 있는 승인 링크로 다시 들어오지 못하게
        {
          sql: 'UPDATE signup_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL',
          args: [now, req.params.id],
        },
      ],
      'write',
    );
    req.log.info(`구성원 제거: ${req.params.id} by ${req.currentUser!.id}`);
    return { ok: true, nickname: String(rs.rows[0].nickname) };
  });
}
