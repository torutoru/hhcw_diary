import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { conflict, forbidden, unauthorized } from '../lib/errors.js';
import { sendMail } from '../lib/mailer.js';
import { formatKST, nowISO } from '../lib/time.js';
import { clearSession, requireUser, setSession } from '../plugins/auth.js';
import { approvalEmail } from '../templates/approvalEmail.js';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 승인 링크 1시간

const signupBody = z.object({
  email: z.string().trim().toLowerCase().email('이메일 형식을 확인해 주세요.'),
  password: z.string().min(4, '비밀번호는 4자 이상이어야 해요.').max(100),
  name: z.string().trim().min(1, '호칭을 입력해 주세요.').max(20, '호칭은 20자 이하로 적어 주세요.'),
});

const loginBody = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/signup', async (req, reply) => {
    const { email, password, name } = signupBody.parse(req.body);
    const now = nowISO();
    const passwordHash = await bcrypt.hash(password, 10);

    const existing = await db.execute({ sql: 'SELECT id, status FROM users WHERE email = ?', args: [email] });
    let userId: string;
    if (existing.rows[0]) {
      if (existing.rows[0].status === 'active') throw conflict('이미 가입된 이메일이에요.');
      // 승인 대기 중에 다시 요청하면 정보를 갱신하고 새 링크를 보낸다
      userId = String(existing.rows[0].id);
      await db.execute({
        sql: 'UPDATE users SET password_hash = ?, name = ? WHERE id = ?',
        args: [passwordHash, name, userId],
      });
    } else {
      userId = randomUUID();
      await db.execute({
        sql: 'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)',
        args: [userId, email, passwordHash, name, now],
      });
    }

    const token = randomUUID();
    const expires = new Date(Date.now() + TOKEN_TTL_MS);
    await db.execute({
      sql: 'INSERT INTO signup_tokens (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
      args: [token, userId, expires.toISOString(), now],
    });

    await sendMail(
      {
        to: config.ADMIN_EMAIL,
        subject: '[우리가족] 회원가입 요청이 들어왔어요',
        html: approvalEmail({
          email,
          name,
          requestedAt: formatKST(new Date(now)),
          expiresAt: formatKST(expires),
          confirmUrl: `${config.APP_URL}/api/signup/confirm/${token}`,
        }),
      },
      (msg) => req.log.info(msg),
    );

    return reply.code(201).send({ ok: true });
  });

  // 관리자 메일의 승인 링크. 처리 후 프론트의 결과 화면으로 보낸다
  app.get<{ Params: { token: string } }>('/api/signup/confirm/:token', async (req, reply) => {
    const rs = await db.execute({
      sql: `SELECT t.user_id, t.expires_at, t.used_at, u.email
            FROM signup_tokens t JOIN users u ON u.id = t.user_id
            WHERE t.token = ?`,
      args: [req.params.token],
    });
    const row = rs.rows[0];

    let status: 'success' | 'expired' | 'used' | 'invalid';
    if (!row) status = 'invalid';
    else if (row.used_at) status = 'used';
    else if (new Date(String(row.expires_at)).getTime() < Date.now()) status = 'expired';
    else {
      const now = nowISO();
      await db.batch(
        [
          { sql: 'UPDATE signup_tokens SET used_at = ? WHERE token = ?', args: [now, req.params.token] },
          {
            sql: "UPDATE users SET status = 'active', approved_at = COALESCE(approved_at, ?) WHERE id = ?",
            args: [now, row.user_id],
          },
        ],
        'write',
      );
      status = 'success';
    }

    const qs = new URLSearchParams({ status });
    if (row?.email) qs.set('email', String(row.email));
    return reply.redirect(`${config.APP_URL}/signup/confirm?${qs}`);
  });

  app.post('/api/auth/login', async (req, reply) => {
    const { email, password } = loginBody.parse(req.body);
    const rs = await db.execute({
      sql: 'SELECT id, email, name, role, status, password_hash FROM users WHERE email = ?',
      args: [email],
    });
    const row = rs.rows[0];
    if (!row || !(await bcrypt.compare(password, String(row.password_hash)))) {
      throw unauthorized('이메일 또는 비밀번호가 맞지 않아요.');
    }
    if (row.status !== 'active') throw forbidden('아직 관리자 승인 전이에요. 승인 후 로그인할 수 있어요.');

    setSession(reply, String(row.id), config.isProd);
    return { user: { id: row.id, email: row.email, name: row.name, role: row.role } };
  });

  app.post('/api/auth/logout', async (_req, reply) => {
    clearSession(reply);
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: requireUser }, async (req) => {
    return { user: req.currentUser };
  });
}
