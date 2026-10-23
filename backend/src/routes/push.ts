import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { HttpError } from '../lib/errors.js';
import { isPushConfigured } from '../lib/push.js';
import { nowISO } from '../lib/time.js';
import { requireUser } from '../plugins/auth.js';

// 서버가 알림을 보낼 때 이 주소로 요청한다. 아무 주소나 받으면 서버 안쪽 주소로 요청을 보내게 만들 수 있어서,
// 브라우저 회사의 푸시 서버(https)만 허용한다: 크롬·안드로이드·삼성(FCM), 파이어폭스, 사파리(아이폰·맥), 엣지
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /\.notify\.windows\.com$/];

function isPushServiceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && PUSH_HOSTS.some((h) => h.test(url.hostname));
  } catch {
    return false;
  }
}

const subscribeBody = z.object({
  endpoint: z.string().url().max(1000).refine(isPushServiceUrl, '지원하지 않는 알림 주소예요.'),
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
