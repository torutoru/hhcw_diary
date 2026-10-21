import type { Role } from '../plugins/auth.js';

/** 관리자(피드 작성·수정, 구성원 관리) 권한을 갖는 가족관계. 각각 한 명만 등록할 수 있다 */
export const PARENT_NAMES = ['엄마', '아빠'] as const;

export function roleForRelation(relation: string): Role {
  return (PARENT_NAMES as readonly string[]).includes(relation) ? 'parent' : 'member';
}
