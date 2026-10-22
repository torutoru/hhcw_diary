import type { Comment, FeedDetail, FeedListResponse, Member, UploadedImage, User } from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, '네트워크에 연결할 수 없어요.');
  }
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
  if (!res.ok) {
    // JSON 이 아니면 백엔드까지 가지 못한 것 (프록시 주소 오류, 서버 기동 중 등). 원인 파악용으로 상태 코드를 붙인다
    throw new ApiError(res.status, data?.error ?? `서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요. (${res.status})`);
  }
  return data as T;
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  me: () => request<{ user: User }>('/auth/me'),
  login: (email: string, password: string, remember: boolean) =>
    request<{ user: User }>('/auth/login', { method: 'POST', body: json({ email, password, remember }) }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  signup: (email: string, password: string, relation: string, nickname: string) =>
    request<{ ok: true }>('/auth/signup', { method: 'POST', body: json({ email, password, relation, nickname }) }),
  updateMe: (nickname: string) => request<{ user: User }>('/auth/me', { method: 'PATCH', body: json({ nickname }) }),

  feeds: (before?: string) =>
    request<FeedListResponse>(`/feeds${before ? `?before=${before}` : ''}`),
  feedDates: (month: string) =>
    request<{ month: string; today: string; dates: string[]; feeds: { date: string; id: string }[] }>(
      `/feeds/dates?month=${month}`,
    ),
  feedByDate: (date: string) =>
    request<{ date: string; isToday: boolean; feed: FeedDetail | null }>(`/feeds/by-date/${date}`),
  feed: (id: string) => request<{ feed: FeedDetail }>(`/feeds/${id}`),
  createFeed: (date: string, body: string, imageIds: string[]) =>
    request<{ feed: FeedDetail }>('/feeds', { method: 'POST', body: json({ date, body, imageIds }) }),
  updateFeed: (id: string, body: string, imageIds: string[]) =>
    request<{ feed: FeedDetail }>(`/feeds/${id}`, { method: 'PUT', body: json({ body, imageIds }) }),

  comments: (feedId: string, offset: number, limit = 5) =>
    request<{ items: Comment[]; total: number }>(`/feeds/${feedId}/comments?offset=${offset}&limit=${limit}`),
  addComment: (feedId: string, body: string) =>
    request<{ comment: Comment }>(`/feeds/${feedId}/comments`, { method: 'POST', body: json({ body }) }),
  editComment: (feedId: string, commentId: string, body: string) =>
    request<{ ok: true; body: string }>(`/feeds/${feedId}/comments/${commentId}`, {
      method: 'PATCH',
      body: json({ body }),
    }),
  deleteComment: (feedId: string, commentId: string) =>
    request<{ ok: true }>(`/feeds/${feedId}/comments/${commentId}`, { method: 'DELETE' }),

  members: () => request<{ me: Member; members: Member[] }>('/members'),
  removeMember: (id: string) => request<{ ok: true; nickname: string }>(`/members/${id}`, { method: 'DELETE' }),

  pushPublicKey: () => request<{ publicKey: string | null }>('/push/public-key'),
  pushSubscribe: (sub: PushSubscriptionJSON) =>
    request<{ ok: true }>('/push/subscribe', { method: 'POST', body: json(sub) }),
  pushUnsubscribe: (endpoint: string) =>
    request<{ ok: true }>('/push/subscribe', { method: 'DELETE', body: json({ endpoint }) }),

  deleteImage: (id: string) => request<{ ok: true }>(`/images/${id}`, { method: 'DELETE' }),
  uploadImage: (file: Blob, filename: string) => {
    const form = new FormData();
    form.append('file', file, filename);
    return request<UploadedImage>('/images', { method: 'POST', body: form });
  },
};
