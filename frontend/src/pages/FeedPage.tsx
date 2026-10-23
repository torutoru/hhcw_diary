import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useMatch } from 'react-router-dom';
import { api } from '../api/client';
import type { CommentPreview, FeedListItem } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import FabMenu from '../components/FabMenu';
import FeedCard from '../components/FeedCard';
import { HomeIcon, RefreshIcon } from '../components/Icons';
import LoadingQuotes from '../components/LoadingQuotes';
import { NotificationCard } from '../components/NotificationSettings';
import { APP_NAME } from '../lib/app';
import { PULL_THRESHOLD, usePullToRefresh } from '../lib/usePullToRefresh';
import ProfileMenu from '../components/ProfileMenu';

export interface FeedOutletContext {
  onCommentAdded: (feedId: string, comment: CommentPreview) => void;
  onCommentDeleted: (feedId: string, commentId: string) => void;
  onCommentEdited: (feedId: string, commentId: string, body: string) => void;
  /** 상세를 열어 읽음 처리됨 → 카드의 "N" 지우기 */
  onFeedRead: (feedId: string) => void;
  /** 상세를 닫으면 돌아갈 화면: 메인 피드 '/' 또는 검색 달력 '/search' */
  closeTo: string;
}

export default function FeedPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedListItem[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async (before?: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const res = await api.feeds(before);
      setItems((prev) => (before ? [...prev, ...res.items] : res.items));
      setNextBefore(res.nextBefore);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 당겨서 새로고침: 맨 위에서 아래로 당겼다 놓으면 최신 피드부터 다시 불러온다 (상세가 떠 있을 때는 쉼)
  const detailOpen = useMatch('/feeds/:id') !== null;
  const refresh = useCallback(() => load(), [load]);
  const { pull, dragging, refreshing } = usePullToRefresh(refresh, !detailOpen);

  // 목록 끝에 닿기 전(아래로 화면 한두 장 남았을 때) 다음 10개를 미리 불러온다
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !nextBefore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) load(nextBefore);
      },
      { rootMargin: '0px 0px 1200px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [nextBefore, load]);

  const onCommentAdded = useCallback<FeedOutletContext['onCommentAdded']>((feedId, comment) => {
    setItems((prev) =>
      prev.map((f) =>
        f.id === feedId
          ? {
              ...f,
              commentCount: f.commentCount + 1,
              // 미리보기는 가장 최근 댓글 1개
              comments: [comment],
            }
          : f,
      ),
    );
  }, []);

  // 삭제된 댓글은 미리보기에서도 안내 문구로 바뀐다 (자리와 댓글 수는 그대로)
  const onCommentDeleted = useCallback<FeedOutletContext['onCommentDeleted']>((feedId, commentId) => {
    setItems((prev) =>
      prev.map((f) =>
        f.id === feedId
          ? { ...f, comments: f.comments.map((c) => (c.id === commentId ? { ...c, body: '', deleted: true } : c)) }
          : f,
      ),
    );
  }, []);

  // 고친 댓글은 미리보기에도 바로 반영
  const onCommentEdited = useCallback<FeedOutletContext['onCommentEdited']>((feedId, commentId, body) => {
    setItems((prev) =>
      prev.map((f) =>
        f.id === feedId ? { ...f, comments: f.comments.map((c) => (c.id === commentId ? { ...c, body } : c)) } : f,
      ),
    );
  }, []);

  const onFeedRead = useCallback<FeedOutletContext['onFeedRead']>((feedId) => {
    setItems((prev) => prev.map((f) => (f.id === feedId ? { ...f, isNew: false, newComments: 0 } : f)));
  }, []);

  const isParent = user?.role === 'parent';

  return (
    <>
      <header className="app-header">
        <div className="logo display">
          <span className="logo-mark">
            <HomeIcon />
          </span>
          <span className="logo-text">{APP_NAME}</span>
        </div>
        <ProfileMenu />
      </header>

      {/* 당겨서 새로고침: 목록이 내려가며 생긴 위쪽 빈 공간(배경)에 "불러오는 중"과 같은 모양의 작은 아이콘 + 회색 글자.
          당기는 중엔 화살표가 돌고, 충분히 당기면 초록색 "놓으면 새로고침" */}
      <div className="ptr-zone" aria-hidden={pull === 0}>
        <div
          className={`ptr-indicator loading-status${pull >= PULL_THRESHOLD ? ' is-ready' : ''}${
            dragging ? ' is-dragging' : ''
          }`}
          style={{ height: pull, opacity: Math.min(1, pull / (PULL_THRESHOLD * 0.6)) }}
        >
          <span className="ptr-icon" style={{ transform: `rotate(${pull * 3}deg)` }} aria-hidden="true">
            <RefreshIcon size={16} />
          </span>
          {pull >= PULL_THRESHOLD ? '놓으면 새로고침' : pull > 0 ? '당겨서 새로고침' : ''}
        </div>
      </div>

      {/* 놓은 뒤 새로고침 중: 화면 전체를 짙은 회색이 덮고, 첫 로딩과 같은 가족 문구 + 작은 진행 표시. 끝나면 사라짐 */}
      {refreshing && (
        <div className="refresh-overlay">
          <LoadingQuotes immediate />
        </div>
      )}

      <main
        className={`feed-main has-fab${dragging ? ' is-pulling' : ''}`}
        style={pull ? { transform: `translateY(${pull}px)` } : undefined}
      >
        <NotificationCard />

        {items.map((item) => (
          <FeedCard key={item.id} item={item} />
        ))}

        {!loading && !error && items.length === 0 && (
          <p className="feed-empty">
            아직 올라온 피드가 없어요.
            {isParent && (
              <>
                <br />
                오늘의 첫 피드를 올려보세요.
              </>
            )}
          </p>
        )}

        {error && (
          <div className="feed-status" role="alert">
            {error}{' '}
            <button type="button" className="btn-text" onClick={() => load(nextBefore ?? undefined)}>
              다시 시도
            </button>
          </div>
        )}

        {/* 첫 불러오기: 가족 문구 / 다음 10개: 아래쪽 작은 스피너 */}
        {loading && items.length === 0 && <LoadingQuotes />}
        {loading && items.length > 0 && (
          <div className="feed-status loading-status" role="status">
            <span className="spinner" aria-hidden="true" />
            불러오는 중
          </div>
        )}
        {!loading && !error && items.length > 0 && !nextBefore && (
          <p className="feed-end">모든 피드를 다 봤어요</p>
        )}
        <div ref={sentinel} />
      </main>

      {/* 오른쪽 아래 플로팅 버튼: 일반은 돋보기(검색), 엄마·아빠는 ＋ → 작성하기·검색하기 메뉴 */}
      <FabMenu isParent={isParent} />

      <Outlet
        context={
          { onCommentAdded, onCommentDeleted, onCommentEdited, onFeedRead, closeTo: '/' } satisfies FeedOutletContext
        }
      />
    </>
  );
}
