import type { FastifyBaseLogger } from 'fastify';
import webpush from 'web-push';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { nowISO } from './time.js';

export const isPushConfigured = Boolean(config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY);

if (isPushConfigured) {
  webpush.setVapidDetails(
    config.VAPID_SUBJECT ?? `mailto:${config.ADMIN_EMAIL}`,
    config.VAPID_PUBLIC_KEY!,
    config.VAPID_PRIVATE_KEY!,
  );
}

/** 서비스 워커(frontend/src/sw.ts)가 받는 알림 내용 */
export interface PushPayload {
  kind: 'feed' | 'comment';
  title: string;
  body: string;
  /** 알림을 누르면 열 화면 */
  url: string;
  /** 같은 tag 의 알림은 하나로 묶여 덮어쓴다 (댓글 묶음) */
  tag: string;
  /** 댓글 묶음 문구용: "OO 피드에 새 댓글 3개" */
  feedLabel?: string;
}

/**
 * 사용자들의 모든 기기로 알림을 보낸다. 승인된(제거되지 않은) 사용자만 받는다.
 * 만료된 구독(404/410)은 지운다. 요청 처리를 붙잡지 않도록 호출하는 쪽에서 await 하지 않는다.
 */
export async function sendPush(userIds: string[], payload: PushPayload, log: FastifyBaseLogger) {
  if (!isPushConfigured || userIds.length === 0) return;

  const rs = await db.execute({
    sql: `SELECT s.endpoint, s.p256dh, s.auth FROM push_subscriptions s
          JOIN users u ON u.id = s.user_id
          WHERE u.status = 'active' AND u.removed_at IS NULL
            AND s.user_id IN (${userIds.map(() => '?').join(',')})`,
    args: userIds,
  });

  const body = JSON.stringify(payload);
  await Promise.all(
    rs.rows.map(async (row) => {
      const endpoint = String(row.endpoint);
      try {
        await webpush.sendNotification(
          { endpoint, keys: { p256dh: String(row.p256dh), auth: String(row.auth) } },
          body,
          { TTL: 60 * 60 * 24, urgency: 'normal', topic: payload.tag.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, '') },
        );
        await db.execute({
          sql: 'UPDATE push_subscriptions SET last_used_at = ? WHERE endpoint = ?',
          args: [nowISO(), endpoint],
        });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // 앱 삭제, 알림 해제 등으로 더 이상 쓸 수 없는 구독
          await db.execute({ sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?', args: [endpoint] });
        } else {
          log.warn(`푸시 발송 실패 (${status ?? 'network'}): ${(err as Error).message}`);
        }
      }
    }),
  );
}

/** 새 피드: 올린 사람을 뺀 가족 모두 */
export async function feedRecipients(authorId: string) {
  const rs = await db.execute({
    sql: "SELECT id FROM users WHERE status = 'active' AND removed_at IS NULL AND id <> ?",
    args: [authorId],
  });
  return rs.rows.map((r) => String(r.id));
}

/** 새 댓글: 피드 작성자 + 그 피드에 (지우지 않은) 댓글을 단 사람, 댓글 쓴 본인 제외 */
export async function commentRecipients(feedId: string, commenterId: string) {
  const rs = await db.execute({
    sql: `SELECT author_id AS id FROM feeds WHERE id = ?
          UNION
          SELECT DISTINCT author_id FROM comments WHERE feed_id = ? AND deleted_at IS NULL`,
    args: [feedId, feedId],
  });
  return rs.rows.map((r) => String(r.id)).filter((id) => id !== commenterId);
}

/** 알림에 쓰는 이름: 호칭(가족관계). 둘이 같으면 한 번만 */
export function displayName(nickname: string, relation: string) {
  return nickname === relation ? nickname : `${nickname}(${relation})`;
}

/** "10월 22일" (feed_date 는 KST YYYY-MM-DD) */
export function shortDate(date: string) {
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
}
