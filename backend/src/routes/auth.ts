import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { conflict, forbidden, HttpError, unauthorized } from '../lib/errors.js';
import { roleForRelation } from '../lib/family.js';
import { sendMail } from '../lib/mailer.js';
import { formatKST, formatKSTClock, nowISO } from '../lib/time.js';
import { clearSession, FONT_SIZES, requireUser, setSession, toSessionUser } from '../plugins/auth.js';
import { approvalEmail } from '../templates/approvalEmail.js';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 승인 링크 1시간

const nickname = z.string().trim().min(1, '호칭을 입력해 주세요.').max(20, '호칭은 20자 이하로 적어 주세요.');

const signupBody = z.object({
  email: z.string().trim().toLowerCase().email('이메일 형식을 확인해 주세요.'),
  password: z.string().min(4, '비밀번호는 4자 이상이어야 해요.').max(100),
  relation: z.string().trim().min(1, '가족관계를 입력해 주세요.').max(20, '가족관계는 20자 이하로 적어 주세요.'),
  nickname,
});

// 바꿀 항목만 보낸다 (호칭 저장, 글자 크기 선택이 따로 일어난다)
const updateMeBody = z
  .object({ nickname: nickname.optional(), fontSize: z.enum(FONT_SIZES, { message: '글자 크기는 작게, 보통, 크게 중에서 골라 주세요.' }).optional() })
  .refine((b) => b.nickname !== undefined || b.fontSize !== undefined, '바꿀 내용이 없어요.');

const loginBody = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
  remember: z.boolean().default(false),
});

// 로그인 잠금: 비밀번호를 5번 연속 틀리면 그때부터 1시간 동안 로그인 불가
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 60 * 60 * 1000;

const lockedError = (until: Date) =>
  new HttpError(
    423,
    `비밀번호를 ${MAX_FAILED_LOGINS}번 틀려서 계정이 잠겼어요. ${formatKSTClock(until)} 이후에 다시 시도해 주세요.`,
  );

async function isParentRelationTaken(relation: string, exceptUserId: string) {
  const rs = await db.execute({
    sql: "SELECT 1 FROM users WHERE relation = ? AND status = 'active' AND id <> ? LIMIT 1",
    args: [relation, exceptUserId],
  });
  return rs.rows.length > 0;
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/signup', async (req, reply) => {
    const { email, password, relation, nickname } = signupBody.parse(req.body);
    const now = nowISO();
    const role = roleForRelation(relation);

    const existing = await db.execute({ sql: 'SELECT id, status FROM users WHERE email = ?', args: [email] });
    if (existing.rows[0]?.status === 'active') throw conflict('이미 가입된 이메일이에요.');

    // '엄마', '아빠'는 한 명만: 승인된 사람이나 유효한 링크로 승인 대기 중인 사람이 있으면 막는다
    if (role === 'parent') {
      const taken = await db.execute({
        sql: `SELECT 1 FROM users u
              WHERE u.relation = ? AND u.email <> ?
                AND (u.status = 'active' OR EXISTS (
                  SELECT 1 FROM signup_tokens t
                  WHERE t.user_id = u.id AND t.used_at IS NULL AND t.expires_at > ?))
              LIMIT 1`,
        args: [relation, email, now],
      });
      if (taken.rows[0]) throw conflict(`가족관계 '${relation}'은(는) 이미 등록되어 있어요. 다른 가족관계를 입력해 주세요.`);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let userId: string;
    if (existing.rows[0]) {
      // 승인 대기 중이거나 제거된 계정이 다시 요청하면 정보를 갱신하고 새 링크를 보낸다.
      // 예전 메일의 링크는 쓸 수 없게 한다: 관리자가 예전 메일(이전 정보)을 보고 승인했는데
      // 덮어쓴 정보(다른 사람이 같은 이메일로 다시 요청한 비밀번호·가족관계)로 활성화되는 것을 막는다
      userId = String(existing.rows[0].id);
      await db.batch(
        [
          {
            sql: `UPDATE users SET password_hash = ?, relation = ?, nickname = ?, role = ?, removed_at = NULL
                  WHERE id = ?`,
            args: [passwordHash, relation, nickname, role, userId],
          },
          { sql: 'UPDATE signup_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL', args: [now, userId] },
        ],
        'write',
      );
    } else {
      userId = randomUUID();
      await db.execute({
        sql: `INSERT INTO users (id, email, password_hash, relation, nickname, role, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [userId, email, passwordHash, relation, nickname, role, now],
      });
    }

    const token = randomUUID();
    const expires = new Date(Date.now() + TOKEN_TTL_MS);
    await db.execute({
      sql: 'INSERT INTO signup_tokens (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
      args: [token, userId, expires.toISOString(), now],
    });

    try {
      await sendMail(
        {
          to: config.ADMIN_EMAIL,
          subject: `[${config.APP_NAME}] 회원가입 요청이 들어왔어요`,
          html: approvalEmail({
            email,
            relation,
            nickname,
            canWrite: role === 'parent',
            requestedAt: formatKST(new Date(now)),
            expiresAt: formatKST(expires),
            confirmUrl: `${config.APP_URL}/api/signup/confirm/${token}`,
          }),
        },
        (msg) => req.log.info(msg),
      );
    } catch (err) {
      req.log.error(err);
      throw new HttpError(502, '관리자에게 승인 메일을 보내지 못했어요. 잠시 후 다시 요청해 주세요.');
    }

    return reply.code(201).send({ ok: true });
  });

  // 관리자 메일의 승인 링크. 처리 후 프론트의 결과 화면으로 보낸다
  app.get<{ Params: { token: string } }>('/api/signup/confirm/:token', async (req, reply) => {
    const rs = await db.execute({
      sql: `SELECT t.user_id, t.expires_at, t.used_at, u.email, u.relation, u.role
            FROM signup_tokens t JOIN users u ON u.id = t.user_id
            WHERE t.token = ?`,
      args: [req.params.token],
    });
    const row = rs.rows[0];

    let status: 'success' | 'expired' | 'used' | 'invalid' | 'taken';
    if (!row) status = 'invalid';
    else if (row.used_at) status = 'used';
    else if (new Date(String(row.expires_at)).getTime() < Date.now()) status = 'expired';
    else if (row.role === 'parent' && (await isParentRelationTaken(String(row.relation), String(row.user_id))))
      status = 'taken';
    else {
      const now = nowISO();
      try {
        await db.batch(
          [
            { sql: 'UPDATE signup_tokens SET used_at = ? WHERE token = ?', args: [now, req.params.token] },
            {
              // read_baseline_at: 승인 전 피드·댓글에는 "N"을 붙이지 않는다
              sql: `UPDATE users SET status = 'active', approved_at = COALESCE(approved_at, ?),
                      read_baseline_at = COALESCE(read_baseline_at, ?)
                    WHERE id = ?`,
              args: [now, now, row.user_id],
            },
          ],
          'write',
        );
        status = 'success';
      } catch (err) {
        // 동시에 승인된 경우 uniq_parent_relation 인덱스가 막는다
        if (!String((err as Error).message).includes('UNIQUE')) throw err;
        status = 'taken';
      }
    }

    const qs = new URLSearchParams({ status });
    if (row?.email) qs.set('email', String(row.email));
    if (row?.relation) qs.set('relation', String(row.relation));
    return reply.redirect(`${config.APP_URL}/signup/confirm?${qs}`);
  });

  app.post('/api/auth/login', async (req, reply) => {
    const { email, password, remember } = loginBody.parse(req.body);
    const rs = await db.execute({
      sql: `SELECT id, email, nickname, relation, role, font_size, status, removed_at, password_hash, locked_until
            FROM users WHERE email = ?`,
      args: [email],
    });
    const row = rs.rows[0];
    // 없는 이메일은 횟수를 세지 않는다
    if (!row) throw unauthorized('이메일 또는 비밀번호가 맞지 않아요.');

    const userId = String(row.id);
    const now = new Date();

    // 잠긴 동안은 비밀번호가 맞아도 막는다. 잠금 시간이 지났으면 횟수를 0으로 되돌리고 계속
    if (row.locked_until) {
      const until = new Date(String(row.locked_until));
      if (until > now) throw lockedError(until);
      await db.execute({
        sql: 'UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?',
        args: [userId],
      });
    }

    if (!(await bcrypt.compare(password, String(row.password_hash)))) {
      // 실패 횟수 +1, 5번째면 지금부터 1시간 잠금 (동시 요청에도 숫자가 꼬이지 않게 한 문장으로)
      const lockUntil = new Date(now.getTime() + LOCK_MS).toISOString();
      const updated = await db.execute({
        sql: `UPDATE users SET
                failed_logins = failed_logins + 1,
                locked_until = CASE WHEN failed_logins + 1 >= ? THEN ? ELSE locked_until END
              WHERE id = ?
              RETURNING failed_logins, locked_until`,
        args: [MAX_FAILED_LOGINS, lockUntil, userId],
      });
      const after = updated.rows[0];
      if (after?.locked_until) {
        req.log.warn(`로그인 잠금: ${userId} (${MAX_FAILED_LOGINS}회 실패)`);
        throw lockedError(new Date(String(after.locked_until)));
      }
      const left = MAX_FAILED_LOGINS - Number(after?.failed_logins ?? 0);
      throw unauthorized(`이메일 또는 비밀번호가 맞지 않아요. ${left}번 더 틀리면 1시간 동안 로그인할 수 없어요.`);
    }

    // 비밀번호가 맞으면 틀린 횟수 초기화
    await db.execute({ sql: 'UPDATE users SET failed_logins = 0 WHERE id = ? AND failed_logins <> 0', args: [userId] });

    if (row.removed_at) throw forbidden('가족에서 제거된 계정이에요. 다시 함께하려면 가입을 요청해 주세요.');
    if (row.status !== 'active') throw forbidden('아직 관리자 승인 전이에요. 승인 후 로그인할 수 있어요.');

    setSession(reply, userId, config.isProd, remember);
    return { user: toSessionUser(row) };
  });

  app.post('/api/auth/logout', async (_req, reply) => {
    clearSession(reply);
    return { ok: true };
  });

  // 앱을 열 때마다 호출된다. 기억하기로 로그인했다면 만료를 다시 400일로 늘린다
  app.get('/api/auth/me', { preHandler: requireUser }, async (req, reply) => {
    if (req.user.rmb) setSession(reply, req.currentUser!.id, config.isProd, true);
    return { user: req.currentUser };
  });

  // 내 정보 수정: 호칭과 글자 크기만 바꿀 수 있다 (이메일, 가족관계는 고정)
  app.patch('/api/auth/me', { preHandler: requireUser }, async (req) => {
    const body = updateMeBody.parse(req.body);
    const user = { ...req.currentUser!, ...body };
    await db.execute({
      sql: 'UPDATE users SET nickname = ?, font_size = ? WHERE id = ?',
      args: [user.nickname, user.fontSize, user.id],
    });
    return { user };
  });
}
