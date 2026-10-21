import type { FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../db/client.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export const SESSION_COOKIE = 'hhcw_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30일

export type Role = 'parent' | 'member';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: SessionUser;
  }
}

export async function requireUser(req: FastifyRequest) {
  try {
    await req.jwtVerify({ onlyCookie: true });
  } catch {
    throw unauthorized();
  }
  // 승인 상태나 권한이 바뀔 수 있어 매 요청 DB에서 다시 읽는다
  const rs = await db.execute({
    sql: "SELECT id, email, name, role FROM users WHERE id = ? AND status = 'active'",
    args: [req.user.sub],
  });
  const row = rs.rows[0];
  if (!row) throw unauthorized();
  req.currentUser = {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: row.role as Role,
  };
}

export async function requireParent(req: FastifyRequest) {
  await requireUser(req);
  if (req.currentUser!.role !== 'parent') throw forbidden('피드는 부모님만 작성할 수 있어요.');
}

export function setSession(reply: FastifyReply, userId: string, secure: boolean) {
  const token = reply.server.jwt.sign({ sub: userId }, { expiresIn: SESSION_MAX_AGE });
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSession(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}
