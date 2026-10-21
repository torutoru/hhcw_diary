import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { config } from './config.js';
import { HttpError } from './lib/errors.js';
import { SESSION_COOKIE } from './plugins/auth.js';
import { authRoutes } from './routes/auth.js';
import { feedRoutes } from './routes/feeds.js';
import { imageRoutes } from './routes/images.js';

export async function buildApp() {
  const app = Fastify({
    logger: true,
    // Netlify 프록시 뒤에서 동작
    trustProxy: true,
  });

  await app.register(cookie);
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    cookie: { cookieName: SESSION_COOKIE, signed: false },
  });
  await app.register(multipart, {
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  });

  app.setErrorHandler<FastifyError>((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: err.issues[0]?.message ?? '입력값을 확인해 주세요.' });
    }
    if (err instanceof HttpError) {
      return reply.code(err.statusCode).send({ error: err.message });
    }
    if (err.code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.code(413).send({ error: '사진 한 장은 25MB까지 올릴 수 있어요.' });
    }
    req.log.error(err);
    const status = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    return reply.code(status).send({ error: status === 500 ? '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' : err.message });
  });

  app.get('/api/health', async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(feedRoutes);
  await app.register(imageRoutes);

  return app;
}
