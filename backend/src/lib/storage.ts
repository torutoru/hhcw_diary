import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';

export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  url(key: string): Promise<string>;
}

const HOUR = 60 * 60 * 1000;

function createR2Storage(): Storage {
  const bucket = config.R2_BUCKET!;
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.R2_ACCESS_KEY_ID!,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY!,
    },
  });
  const publicBase = config.R2_PUBLIC_URL?.replace(/\/$/, '');

  return {
    async put(key, data, contentType) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: data,
          ContentType: contentType,
          // 키에 UUID가 들어가 내용이 바뀌지 않으므로 오래 캐시해도 된다
          CacheControl: 'private, max-age=31536000, immutable',
        }),
      );
    },
    async delete(key) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    async url(key) {
      if (publicBase) return `${publicBase}/${key}`;
      // 서명 시각을 1시간 단위로 내림해서, 같은 시간대에는 URL이 같아 브라우저 캐시가 동작하게 한다.
      // 만료는 2시간이라 발급 시점부터 최소 1시간은 유효하다.
      const signingDate = new Date(Math.floor(Date.now() / HOUR) * HOUR);
      return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn: (2 * HOUR) / 1000,
        signingDate,
      });
    },
  };
}

/** R2 설정이 없을 때 쓰는 로컬 개발용 저장소 */
export const LOCAL_UPLOAD_DIR = path.resolve('.uploads');

function createLocalStorage(): Storage {
  return {
    async put(key, data) {
      const file = path.join(LOCAL_UPLOAD_DIR, key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, data);
    },
    async delete(key) {
      await rm(path.join(LOCAL_UPLOAD_DIR, key), { force: true });
    },
    async url(key) {
      return `/api/images/file/${key}`;
    },
  };
}

export const isR2Configured = Boolean(
  config.R2_ACCOUNT_ID && config.R2_ACCESS_KEY_ID && config.R2_SECRET_ACCESS_KEY && config.R2_BUCKET,
);

export const storage: Storage = isR2Configured ? createR2Storage() : createLocalStorage();

export async function readLocalFile(key: string) {
  const file = path.resolve(LOCAL_UPLOAD_DIR, key);
  if (!file.startsWith(LOCAL_UPLOAD_DIR + path.sep)) return null;
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}
