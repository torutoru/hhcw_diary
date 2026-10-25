import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export const SESSION_COOKIE = 'hhcw_session';
// "로그인 상태 기억하기": 마지막으로 쓴 뒤 30일. 로그인된 요청이 올 때마다 다시 30일로 늘린다(requireUser)
const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30;
// 늘리기는 토큰을 받은 지 이만큼 지났을 때만 (매 요청마다 새 쿠키를 내려보내지 않게). 그래서 실제로는 마지막 사용 후 29~30일
const RENEW_AFTER_SEC = 60 * 60 * 24;
// 기억하지 않으면 브라우저를 닫을 때까지, 길어도 하루
const SESSION_ONLY_MAX_AGE = 60 * 60 * 24;

export type Role = 'parent' | 'member';
export const FONT_SIZES = ['small', 'normal', 'large'] as const;
export type FontSize = (typeof FONT_SIZES)[number];

export interface SessionUser {
  id: string;
  email: string;
  /** 호칭: 화면에 보이는 이름 */
  nickname: string;
  /** 가족관계: 권한 기준 */
  relation: string;
  role: Role;
  /** 글자 크기 설정 (화면 전체에 적용) */
  fontSize: FontSize;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; rmb?: boolean };
    user: { sub: string; rmb?: boolean; iat?: number };
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: SessionUser;
  }
}

export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify({ onlyCookie: true });
  } catch {
    throw unauthorized();
  }
  // 승인 상태나 권한이 바뀔 수 있어 매 요청 DB에서 다시 읽는다
  const rs = await db.execute({
    sql: "SELECT id, email, nickname, relation, role, font_size FROM users WHERE id = ? AND status = 'active'",
    args: [req.user.sub],
  });
  const row = rs.rows[0];
  if (!row) throw unauthorized();
  req.currentUser = toSessionUser(row);

  // 기억하기 세션은 쓸 때마다 만료를 다시 30일로 (하루에 한 번만 새로 발급)
  const issuedAt = req.user.iat ?? 0;
  if (req.user.rmb && Date.now() / 1000 - issuedAt > RENEW_AFTER_SEC) {
    setSession(reply, req.currentUser.id, config.isProd, true);
  }
}

export function toSessionUser(row: Record<string, unknown>): SessionUser {
  return {
    id: String(row.id),
    email: String(row.email),
    nickname: String(row.nickname),
    relation: String(row.relation),
    role: row.role as Role,
    fontSize: FONT_SIZES.includes(row.font_size as FontSize) ? (row.font_size as FontSize) : 'normal',
  };
}

export async function requireParent(req: FastifyRequest, reply: FastifyReply) {
  await requireUser(req, reply);
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
