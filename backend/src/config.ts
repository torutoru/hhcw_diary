import { z } from 'zod';

try {
  process.loadEnvFile();
} catch {
  // .env 파일이 없으면 실제 환경변수만 사용 (Render 등)
}

const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET 은 32자 이상이어야 해요'),

  TURSO_DATABASE_URL: z.string().min(1),
  TURSO_AUTH_TOKEN: optional,

  R2_ACCOUNT_ID: optional,
  R2_ACCESS_KEY_ID: optional,
  R2_SECRET_ACCESS_KEY: optional,
  R2_BUCKET: optional,
  R2_PUBLIC_URL: optional,

  ADMIN_EMAIL: z.string().email(),
  RESEND_API_KEY: optional,
  MAIL_FROM: z.string().default('우리가족 <onboarding@resend.dev>'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('환경변수 설정이 올바르지 않아요:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = {
  ...parsed.data,
  APP_URL: parsed.data.APP_URL.replace(/\/$/, ''),
  isProd: parsed.data.NODE_ENV === 'production',
};
