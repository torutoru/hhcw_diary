import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { api } from '../api/client';
import type { CommentPreview, FeedListItem } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import FeedCard from '../components/FeedCard';
import { HomeIcon, PencilIcon } from '../components/Icons';
import { NotificationCard } from '../components/NotificationSettings';
import { APP_NAME } from '../lib/app';
import ProfileMenu from '../components/ProfileMenu';

export interface FeedOutletContext {
  onCommentAdded: (feedId: string, comment: CommentPreview) => void;
  onCommentDeleted: (feedId: string, commentId: string) => void;
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

  // 목록 끝에 닿으면 다음 페이지
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !nextBefore) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) load(nextBefore);
    });
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
              comments: f.comments.length < 2 ? [...f.comments, comment] : f.comments,
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

      <main className={`feed-main${isParent ? ' has-fab' : ''}`}>
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
        {loading && <div className="feed-status">불러오는 중…</div>}
        <div ref={sentinel} />
      </main>

      {/* 피드 작성하기 (엄마·아빠만): 오른쪽 아래 떠 있는 버튼 → 달력에서 날짜를 골라 작성하거나 수정 */}
      {isParent && (
        <Link to="/compose" className="fab" aria-label="피드 작성하기" title="피드 작성하기">
          <PencilIcon size={26} strokeWidth={2.2} />
        </Link>
      )}

      <Outlet context={{ onCommentAdded, onCommentDeleted } satisfies FeedOutletContext} />
    </>
  );
}
