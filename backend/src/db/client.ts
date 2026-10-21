import { createClient } from '@libsql/client';
import { config } from '../config.js';

export const db = createClient({
  url: config.TURSO_DATABASE_URL,
  authToken: config.TURSO_AUTH_TOKEN,
});
