import type { FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../db/client.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export const SESSION_COOKIE = 'hhcw_session';
// "로그인 상태 기억하기": 브라우저가 허용하는 최대치(크롬 400일). 접속할 때마다 다시 늘린다
const REMEMBER_MAX_AGE = 60 * 60 * 24 * 400;
// 기억하지 않으면 브라우저를 닫을 때까지, 길어도 하루
const SESSION_ONLY_MAX_AGE = 60 * 60 * 24;

export type Role = 'parent' | 'member';

export interface SessionUser {
  id: string;
  email: string;
  /** 호칭: 화면에 보이는 이름 */
  nickname: string;
  /** 가족관계: 권한 기준 */
  relation: string;
  role: Role;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; rmb?: boolean };
    user: { sub: string; rmb?: boolean };
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
    sql: "SELECT id, email, nickname, relation, role FROM users WHERE id = ? AND status = 'active'",
    args: [req.user.sub],
  });
  const row = rs.rows[0];
  if (!row) throw unauthorized();
  req.currentUser = toSessionUser(row);
}

export function toSessionUser(row: Record<string, unknown>): SessionUser {
  return {
    id: String(row.id),
    email: String(row.email),
    nickname: String(row.nickname),
    relation: String(row.relation),
    role: row.role as Role,
  };
}

export async function requireParent(req: FastifyRequest) {
  await requireUser(req);
  if (req.currentUser!.role !== 'parent') throw forbidden('피드는 엄마, 아빠만 작성하고 수정할 수 있어요.');
}

export function setSession(reply: FastifyReply, userId: string, secure: boolean, remember: boolean) {
  const maxAge = remember ? REMEMBER_MAX_AGE : SESSION_ONLY_MAX_AGE;
  const token = reply.server.jwt.sign({ sub: userId, rmb: remember }, { expiresIn: maxAge });
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    // maxAge 가 없으면 브라우저를 닫을 때 지워지는 세션 쿠키
    ...(remember ? { maxAge } : {}),
  });
}

export function clearSession(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}
