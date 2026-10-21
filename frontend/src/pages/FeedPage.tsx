import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { FeedListItem } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { HomeIcon, PencilIcon, PlusIcon, UserIcon } from '../components/Icons';
import FeedCard from '../components/FeedCard';

export interface FeedOutletContext {
  onCommentAdded: (feedId: string, comment: { author: string; body: string }) => void;
}

export default function FeedPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedListItem[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
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

  async function onLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const isParent = user?.role === 'parent';
  const todayPosted = items[0]?.isToday ?? false;

  return (
    <>
      <header className="app-header">
        <div className="logo display">
          <span className="logo-mark">
            <HomeIcon />
          </span>
          우리가족
        </div>
        <div className="profile">
          <button
            type="button"
            className="icon-btn"
            aria-label="내 정보 · 로그아웃"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <UserIcon />
          </button>
          {menuOpen && (
            <div className="profile-menu">
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
              <button type="button" className="btn btn-outline" onClick={onLogout}>
                로그아웃
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="feed-main">
        {isParent && !loading && !error && (
          <Link to="/compose" className={`btn write-btn ${todayPosted ? 'is-edit' : 'btn-primary'}`}>
            {todayPosted ? <PencilIcon /> : <PlusIcon />}
            {todayPosted ? '오늘의 피드 수정하기' : '오늘의 피드 작성하기'}
          </Link>
        )}

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

      <Outlet context={{ onCommentAdded } satisfies FeedOutletContext} />
    </>
  );
}
