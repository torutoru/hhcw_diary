import type { Comment, FeedDetail, FeedListResponse, FontSize, Member, UploadedImage, User } from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** 우리 서버가 실제로 답했는지. false 면 네트워크 끊김·시간 초과·프록시 오류 등 (서버가 깨는 중일 수 있음) */
    public reached = true,
  ) {
    super(message);
  }
}

/** timeoutMs: 이 시간 안에 응답이 없으면 끊고 ApiError(0) (없으면 브라우저 기본) */
async function request<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs, ...fetchInit } = init;
  const headers = new Headers(fetchInit.headers);
  if (fetchInit.body && !(fetchInit.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  const controller = timeoutMs ? new AbortController() : null;
  const timer = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : undefined;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...fetchInit,
      headers,
      credentials: 'same-origin',
      signal: controller?.signal,
    });
  } catch {
    throw new ApiError(
      0,
      controller?.signal.aborted ? '서버 응답이 너무 늦어요.' : '네트워크에 연결할 수 없어요.',
      false,
    );
  } finally {
    window.clearTimeout(timer);
  }
  const isJson = res.headers.get('content-type')?.includes('application/json');
  // 우리 서버는 항상 JSON 으로 답한다. JSON 이 아니면 서버까지 가지 못한 것
  // (Netlify 프록시 오류, 잠든 Render 가 깨는 동안 보여주는 로딩 페이지 등) → reached: false
  if (!isJson) {
    throw new ApiError(res.status, `서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요. (${res.status})`, false);
  }
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `요청을 처리하지 못했어요. (${res.status})`);
  return data as T;
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  // 앱을 열 때 로그인 확인. 잠든 서버(Render)가 깨는 데 1분쯤 걸려서 기다릴 시간을 정해 부른다 (AuthContext)
  me: (timeoutMs?: number) => request<{ user: User }>('/auth/me', { timeoutMs }),
  login: (email: string, password: string, remember: boolean) =>
    request<{ user: User }>('/auth/login', { method: 'POST', body: json({ email, password, remember }) }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  signup: (email: string, password: string, relation: string, nickname: string) =>
    request<{ ok: true }>('/auth/signup', { method: 'POST', body: json({ email, password, relation, nickname }) }),
  updateMe: (changes: { nickname?: string; fontSize?: FontSize }) =>
    request<{ user: User }>('/auth/me', { method: 'PATCH', body: json(changes) }),

  feeds: (before?: string) =>
    request<FeedListResponse>(`/feeds${before ? `?before=${before}` : ''}`),
  feedDates: (month: string) =>
    request<{ month: string; today: string; dates: string[]; feeds: { date: string; id: string }[] }>(
      `/feeds/dates?month=${month}`,
    ),
  feedByDate: (date: string) =>
    request<{ date: string; isToday: boolean; feed: FeedDetail | null }>(`/feeds/by-date/${date}`),
  feed: (id: string) => request<{ feed: FeedDetail }>(`/feeds/${id}`),
  /** 읽음 처리. 이전에 본 시각을 돌려준다 (그 뒤 댓글에 "N") */
  markRead: (id: string) => request<{ previousReadAt: string }>(`/feeds/${id}/read`, { method: 'POST' }),
  createFeed: (date: string, body: string, imageIds: string[]) =>
    request<{ feed: FeedDetail }>('/feeds', { method: 'POST', body: json({ date, body, imageIds }) }),
  updateFeed: (id: string, body: string, imageIds: string[]) =>
    request<{ feed: FeedDetail }>(`/feeds/${id}`, { method: 'PUT', body: json({ body, imageIds }) }),

  /** 시간순 댓글. before 가 없으면 최신 limit 개, 있으면 그 댓글보다 이전 limit 개. hasMore = 더 이전 댓글이 있음 */
  comments: (feedId: string, limit: number, before?: string) =>
    request<{ items: Comment[]; total: number; hasMore: boolean }>(
      `/feeds/${feedId}/comments?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ''}`,
    ),
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
