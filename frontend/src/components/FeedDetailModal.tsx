import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Comment, FeedDetail } from '../api/types';
import { avatarColor } from '../lib/avatar';
import { DELETED_COMMENT_TEXT } from '../lib/comments';
import ConfirmSheet from './ConfirmSheet';
import Lightbox from './Lightbox';
import { formatDateTime, formatFullDate, formatWrittenLine } from '../lib/format';
import type { FeedOutletContext } from '../pages/FeedPage';
import { CloseIcon, SendIcon } from './Icons';

const PAGE = 5;

export default function FeedDetailModal() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { onCommentAdded, onCommentDeleted } = useOutletContext<FeedOutletContext>();
  const [deleting, setDeleting] = useState<Comment | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const closeLightbox = useCallback(() => setViewing(null), []);
  const [feed, setFeed] = useState<FeedDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = () => navigate('/', { replace: false });

  useEffect(() => {
    let alive = true;
    setFeed(null);
    setError('');
    Promise.all([api.feed(id), api.comments(id, 0, PAGE)])
      .then(([f, c]) => {
        if (!alive) return;
        setFeed(f.feed);
        setComments(c.items);
        setTotal(c.total);
      })
      .catch((err) => alive && setError((err as Error).message));
    return () => {
      alive = false;
    };
  }, [id]);

  // 열려 있는 동안 배경 스크롤을 막고, Esc 로 닫는다
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && navigate('/');
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [navigate]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await api.comments(id, comments.length, PAGE);
      setComments((prev) => [...prev, ...res.items]);
      setTotal(res.total);
    } finally {
      setLoadingMore(false);
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const { comment } = await api.addComment(id, body);
      // 남은 댓글이 있으면 먼저 다 불러온 뒤 새 댓글을 붙여 순서를 지킨다
      let list = comments;
      if (comments.length < total) {
        const rest = await api.comments(id, comments.length, total - comments.length);
        list = [...comments, ...rest.items];
      }
      setComments([...list, comment]);
      setTotal((t) => t + 1);
      setDraft('');
      onCommentAdded(id, { id: comment.id, author: comment.author, body: comment.body, deleted: false });
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  const closeSheet = useCallback(() => setDeleting(null), []);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteComment(id, deleting.id);
      setComments((list) => list.map((c) => (c.id === deleting.id ? { ...c, body: '', deleted: true } : c)));
      onCommentDeleted(id, deleting.id);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDeleteBusy(false);
      setDeleting(null);
    }
  }

  const left = total - comments.length;

  return (
    <div className="modal-root">
      <button type="button" className="modal-backdrop" aria-label="배경을 눌러 상세보기 닫기" onClick={close} />
      <section className="modal" role="dialog" aria-modal="true" aria-label="피드 상세">
        <div className="modal-head">
          <div className="modal-head-text">
            <h2 className="display">{feed ? formatFullDate(feed.date) : ' '}</h2>
            {feed && <span className="hint">{formatWrittenLine(feed.date, feed.createdAt, feed.updatedAt)}</span>}
          </div>
          <button ref={closeRef} type="button" className="icon-btn modal-close" aria-label="닫기" onClick={close}>
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          {error && <p className="feed-status" role="alert">{error}</p>}
          {!feed && !error && <p className="feed-status">불러오는 중…</p>}
          {feed && (
            <>
              <div className="stack" style={{ gap: 8 }}>
                <div className="carousel">
                  {feed.photos.map((p, i) => (
                    <div key={p.id} className="carousel-item">
                      <button
                        type="button"
                        className="carousel-open"
                        aria-label={`${i + 1}번째 사진 크게 보기`}
                        onClick={() => setViewing(i)}
                      >
                        <img src={p.url} alt={i === 0 ? '대표 사진' : `사진 ${i + 1}`} loading={i < 2 ? 'eager' : 'lazy'} />
                      </button>
                      <span className="carousel-index">
                        {i + 1} / {feed.photos.length}
                      </span>
                    </div>
                  ))}
                </div>
                {feed.photos.length > 1 && (
                  <span className="hint" style={{ padding: '0 20px' }}>
                    옆으로 넘겨서 사진 {feed.photos.length}장을 볼 수 있어요
                  </span>
                )}
              </div>

              {feed.body && <p className="feed-body">{feed.body}</p>}

              <div className="section-gap" />

              <div className="comments">
                <h3>
                  댓글 <span>{total}</span>
                </h3>
                {comments.map((c) =>
                  c.deleted ? (
                    <div key={c.id} className="comment is-deleted">
                      <div className="avatar" aria-hidden="true" />
                      <span className="comment-text">{DELETED_COMMENT_TEXT}</span>
                    </div>
                  ) : (
                    <div key={c.id} className="comment">
                      <div className="avatar" style={{ background: avatarColor(c.author) }} aria-hidden="true">
                        {c.author.slice(0, 1)}
                      </div>
                      <div className="comment-main">
                        <div className="comment-meta">
                          <b>{c.author}</b>
                          <span>{formatDateTime(c.createdAt, feed.date)}</span>
                        </div>
                        <span className="comment-text">{c.body}</span>
                      </div>
                      {c.mine && (
                        <button
                          type="button"
                          className="comment-remove"
                          aria-label="내 댓글 제거"
                          onClick={() => setDeleting(c)}
                        >
                          제거
                        </button>
                      )}
                    </div>
                  ),
                )}
                {left > 0 && (
                  <button type="button" className="more-btn" onClick={loadMore} disabled={loadingMore}>
                    댓글 더보기 ({Math.min(PAGE, left)}개 / 남은 {left}개)
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <form className="comment-form" onSubmit={send}>
          <label htmlFor="detail-comment" className="sr-only">
            댓글 입력
          </label>
          <input
            id="detail-comment"
            className="comment-input"
            type="text"
            placeholder="따뜻한 한마디 남기기"
            maxLength={500}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!feed}
          />
          <button type="submit" className="send-btn" aria-label="댓글 등록" disabled={!feed || !draft.trim() || sending}>
            <SendIcon />
          </button>
        </form>
      </section>

      {feed && viewing !== null && (
        <Lightbox photos={feed.photos} startIndex={viewing} onClose={closeLightbox} />
      )}

      {deleting && (
        <ConfirmSheet
          title="댓글을 삭제할까요?"
          confirmLabel="삭제하기"
          busyLabel="삭제 중…"
          busy={deleteBusy}
          onConfirm={confirmDelete}
          onCancel={closeSheet}
        >
          삭제하면 되돌릴 수 없어요.
          <br />
          댓글 자리에는 "{DELETED_COMMENT_TEXT}"라고 표시돼요.
        </ConfirmSheet>
      )}
    </div>
  );
}
