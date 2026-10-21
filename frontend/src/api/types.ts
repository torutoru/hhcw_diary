export type Role = 'parent' | 'member';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Photo {
  id: string;
  url: string;
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
}

export interface CommentPreview {
  id: string;
  author: string;
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
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  photos: Photo[];
}

export interface Comment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  /** 작성자가 삭제한 댓글. 본문은 비어 있고 자리만 남는다 */
  deleted: boolean;
  /** 내가 쓴 댓글 (삭제 버튼 표시) */
  mine: boolean;
}

export interface UploadedImage extends Photo {
  bytes: number;
}
