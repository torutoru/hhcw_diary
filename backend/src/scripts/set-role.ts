/**
 * 가족 구성원의 권한을 바꾼다. 피드 작성은 parent 만 가능.
 *   npm run user:role -- mom@example.com parent
 *   npm run user:role -- kid@example.com member
 */
import { db } from '../db/client.js';

const [email, role] = process.argv.slice(2);
if (!email || (role !== 'parent' && role !== 'member')) {
  console.error('사용법: npm run user:role -- <이메일> <parent|member>');
  process.exit(1);
}

const rs = await db.execute({
  sql: 'UPDATE users SET role = ? WHERE email = ?',
  args: [role, email.trim().toLowerCase()],
});
if (rs.rowsAffected === 0) {
  console.error(`${email} 사용자를 찾을 수 없어요.`);
  process.exit(1);
}
console.log(`${email} → ${role}`);
