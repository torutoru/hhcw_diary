import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { HttpError } from '../lib/errors.js';
import { isPushConfigured } from '../lib/push.js';
import { nowISO } from '../lib/time.js';
import { requireUser } from '../plugins/auth.js';

const subscribeBody = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

const unsubscribeBody = z.object({ endpoint: z.string().url().max(1000) });

export async function pushRoutes(app: FastifyInstance) {
  // 브라우저가 구독할 때 쓰는 공개 키. 서버에 키가 없으면 null → 화면에서 알림 기능을 숨긴다
  app.get('/api/push/public-key', async () => ({
    publicKey: isPushConfigured ? config.VAPID_PUBLIC_KEY : null,
  }));

  // 이 기기에서 알림 받기. 같은 기기(endpoint)를 다른 계정으로 다시 구독하면 주인을 바꾼다
  app.post('/api/push/subscribe', { preHandler: requireUser }, async (req, reply) => {
    if (!isPushConfigured) throw new HttpError(503, '알림 기능이 아직 준비되지 않았어요.');
    const { endpoint, keys } = subscribeBody.parse(req.body);
    await db.execute({
      sql: `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, user_agent, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(endpoint) DO UPDATE SET
              user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
              user_agent = excluded.user_agent`,
      args: [
        endpoint,
        req.currentUser!.id,
        keys.p256dh,
        keys.auth,
        String(req.headers['user-agent'] ?? '').slice(0, 300),
        nowISO(),
      ],
    });
    return reply.code(201).send({ ok: true });
  });

  // 이 기기에서 알림 끄기 (로그아웃할 때도 호출)
  app.delete('/api/push/subscribe', { preHandler: requireUser }, async (req) => {
    const { endpoint } = unsubscribeBody.parse(req.body);
    await db.execute({
      sql: 'DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?',
      args: [endpoint, req.currentUser!.id],
    });
    return { ok: true };
  });
}
