import type { Role } from '../plugins/auth.js';

/** 피드를 작성·수정할 수 있는 호칭. 각각 한 명만 등록할 수 있다 */
export const PARENT_NAMES = ['엄마', '아빠'] as const;

export function roleForName(name: string): Role {
  return (PARENT_NAMES as readonly string[]).includes(name) ? 'parent' : 'member';
}
