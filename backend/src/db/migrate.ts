import { db } from './client.js';

// 시각은 모두 UTC ISO 문자열, 피드 날짜(feed_date)는 한국 시간 기준 YYYY-MM-DD
const schema = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('parent', 'member')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  created_at    TEXT NOT NULL,
  approved_at   TEXT
);

CREATE TABLE IF NOT EXISTS signup_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feeds (
  id         TEXT PRIMARY KEY,
  feed_date  TEXT NOT NULL UNIQUE,
  author_id  TEXT NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 이미지 바이너리는 R2에, 여기에는 저장 위치(storage_key)와 메타데이터만 둔다
CREATE TABLE IF NOT EXISTS images (
  id          TEXT PRIMARY KEY,
  storage_key TEXT NOT NULL UNIQUE,
  feed_id     TEXT REFERENCES feeds(id),
  position    INTEGER NOT NULL DEFAULT 0,
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  bytes       INTEGER NOT NULL,
  uploader_id TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_images_feed ON images(feed_id, position);

CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  feed_id    TEXT NOT NULL REFERENCES feeds(id),
  author_id  TEXT NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_feed ON comments(feed_id, created_at);
`;

export async function migrate() {
  await db.executeMultiple(schema);
}
