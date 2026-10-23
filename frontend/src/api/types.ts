export type Role = 'parent' | 'member';

export interface User {
  id: string;
  email: string;
  /** 호칭: 화면에 보이는 이름 (내 정보에서 수정 가능) */
  nickname: string;
  /** 가족관계: 권한 기준. '엄마', '아빠'만 관리자 (수정 불가) */
  relation: string;
  role: Role;
}

export type Member = User;

export interface Photo {
  id: string;
  /** 원본(2048px): 크게 보기 */
  url: string;
  /** 리스트용(1080px): 상세 가로 스크롤·작성 미리보기 */
  thumbUrl: string;
  width: number;
  height: number;
}

export interface FeedListItem {
  id: string;
  date: string;
  isToday: boolean;
  coverUrl: string | null;
  photoCount: number;
  commentCount: number;
  comments: CommentPreview[];
  /** 아직 열어 보지 않은 남의 피드 ("N" 표시) */
  isNew: boolean;
  /** 마지막으로 본 뒤 달린 남의 댓글 수 */
  newComments: number;
}

export interface CommentPreview {
  id: string;
  /** 작성자 호칭 */
  author: string;
  /** 작성자 가족관계 */
  authorRelation: string;
  body: string;
  deleted: boolean;
}

export interface FeedListResponse {
  items: FeedListItem[];
  nextBefore: string | null;
}

export interface FeedDetail {
  id: string;
  date: string;
  isToday: boolean;
  body: string;
  author: string;
  authorRelation: string;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  photos: Photo[];
}

export interface Comment {
  id: string;
  author: string;
  authorRelation: string;
  body: string;
  createdAt: string;
  /** 작성자가 삭제한 댓글. 본문은 비어 있고 자리만 남는다 */
  deleted: boolean;
  /** 작성자가 고친 댓글 ("수정됨" 표시) */
  edited: boolean;
  /** 내가 쓴 댓글 (삭제 버튼 표시) */
  mine: boolean;
}

export interface UploadedImage extends Photo {
  bytes: number;
}
