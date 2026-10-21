export type Role = 'parent' | 'member';

export interface User {
  id: string;
  email: string;
  name: string;
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
  comments: { author: string; body: string }[];
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
}

export interface UploadedImage extends Photo {
  bytes: number;
}
