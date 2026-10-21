import { PARENT_NAMES } from '../lib/family.js';
import { db } from './client.js';

// 시각은 모두 UTC ISO 문자열, 피드 날짜(feed_date)는 한국 시간 기준 YYYY-MM-DD
const schema = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  relation      TEXT NOT NULL, -- 가족관계 (권한 기준: '엄마', '아빠'만 parent)
  nickname      TEXT,          -- 호칭 (화면에 보이는 이름)
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

-- R2 파일 삭제에 실패한 경로. 서버 시작 시와 매 정각에 다시 지운다
CREATE TABLE IF NOT EXISTS storage_deletions (
  storage_key   TEXT PRIMARY KEY,
  attempts      INTEGER NOT NULL DEFAULT 1,
  last_error    TEXT,
  created_at    TEXT NOT NULL,
  last_tried_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  feed_id    TEXT NOT NULL REFERENCES feeds(id),
  author_id  TEXT NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_feed ON comments(feed_id, created_at);
`;

// 권한은 가족관계로 정해진다: '엄마', '아빠'만 parent. 기존 데이터도 이 규칙에 맞춘다
const parentNames = PARENT_NAMES.map((n) => `'${n}'`).join(', ');
const roleRules = `
UPDATE users SET role = CASE WHEN relation IN (${parentNames}) THEN 'parent' ELSE 'member' END;
DROP INDEX IF EXISTS uniq_parent_name;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_parent_relation ON users(relation)
  WHERE status = 'active' AND relation IN (${parentNames});
`;

/**
 * 컬럼 추가는 이미 만들어진 DB(Turso)에도 적용되도록 없을 때만 ALTER 한다.
 * - users.removed_at: 가족 구성원 관리에서 제거된 시각. 제거되면 status 를 'pending' 으로 돌려
 *   로그인·세션을 막고, '엄마'/'아빠' 자리도 비운다. 행은 남겨서 지난 댓글의 이름을 유지한다.
 * - comments.deleted_at: 작성자가 지운 시각. 본문은 비우고 행은 남겨 목록에 안내 문구를 보여준다.
 */
async function columnsOf(table: string) {
  const cols = await db.execute(`PRAGMA table_info(${table})`);
  return new Set(cols.rows.map((c) => String(c.name)));
}

async function addColumnIfMissing(table: string, column: string, type: string) {
  if (!(await columnsOf(table)).has(column)) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

/**
 * 예전 users.name(호칭이자 권한 기준)을 가족관계(relation)로 바꾸고, 화면용 호칭(nickname)을 새로 둔다.
 * 기존 사용자의 호칭은 가족관계 값으로 채운다 (내 정보에서 바꿀 수 있음).
 */
async function splitRelationAndNickname() {
  const cols = await columnsOf('users');
  if (cols.has('name') && !cols.has('relation')) {
    await db.execute('ALTER TABLE users RENAME COLUMN name TO relation');
  }
  await addColumnIfMissing('users', 'nickname', 'TEXT');
  await db.execute('UPDATE users SET nickname = relation WHERE nickname IS NULL');
}

async function addMissingColumns() {
  await splitRelationAndNickname();
  await addColumnIfMissing('users', 'removed_at', 'TEXT');
  await addColumnIfMissing('comments', 'deleted_at', 'TEXT');
}

export async function migrate(log: (msg: string) => void) {
  await db.executeMultiple(schema);
  await addMissingColumns();
  try {
    await db.executeMultiple(roleRules);
  } catch (err) {
    log(`가족관계 '엄마', '아빠'가 중복된 승인 사용자가 있어 고유 인덱스를 만들지 못했어요: ${(err as Error).message}`);
  }
}
