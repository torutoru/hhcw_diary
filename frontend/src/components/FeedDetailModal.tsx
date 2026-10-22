import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Comment, FeedDetail } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { DELETED_COMMENT_TEXT } from '../lib/comments';
import ConfirmSheet from './ConfirmSheet';
import Lightbox from './Lightbox';
import { Avatar, PersonName } from './Person';
import PopoverMenu from './PopoverMenu';
import { formatDateTime, formatFullDate, formatWrittenLine } from '../lib/format';
import type { FeedOutletContext } from '../pages/FeedPage';
import { CheckIcon, CloseIcon, MoreIcon, PencilIcon, SendIcon, TrashIcon } from './Icons';

const PAGE = 5;
// 댓글 알림으로 열 때 한 번에 불러오는 최대 개수 (API 상한)
const COMMENTS_MAX = 50;

/**
 * 상세를 불러오는 동안 보여주는 뼈대(스켈레톤). 실제 화면과 같은 자리에 회색 틀을 두고,
 * 깜빡여서(.skeleton 애니메이션) 멈춘 게 아니라 불러오는 중임을 알린다. 글자는 화면 읽기 기능용으로만 둔다
 */
function DetailSkeleton() {
  return (
    <div className="detail-skeleton" aria-busy="true">
      <span className="sr-only" role="status">
        불러오는 중
      </span>
      <div className="carousel" aria-hidden="true">
        <span className="skeleton carousel-item" />
      </div>
      <div className="detail-skeleton-body" aria-hidden="true">
        <span className="skeleton skeleton-line" />
        <span className="skeleton skeleton-line" />
        <span className="skeleton skeleton-line is-short" />
      </div>
      <div className="section-gap" aria-hidden="true" />
      <div className="comments" aria-hidden="true">
        <span className="skeleton skeleton-line is-tiny" />
        {[0, 1].map((i) => (
          <div key={i} className="comment">
            <span className="skeleton avatar" />
            <div className="comment-main">
              <span className="skeleton skeleton-line is-tiny" />
              <span className="skeleton skeleton-line" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FeedDetailModal() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { onCommentAdded, onCommentDeleted, onCommentEdited, closeTo } = useOutletContext<FeedOutletContext>();
  const location = useLocation();
  const canEdit = useAuth().user?.role === 'parent';
  // 내 댓글 ⋯ 메뉴(버튼 위에 뜸) → 수정(아래 입력칸에서) / 제거(확인 시트)
  const [menuFor, setMenuFor] = useState<{ comment: Comment; anchor: HTMLElement } | null>(null);
  const [editing, setEditing] = useState<Comment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  // 열었던 화면(메인 피드 또는 검색 달력)으로 돌아간다
  const close = () => navigate(closeTo);

  // 댓글 알림으로 열면(주소 끝 #comments) 댓글을 끝까지 불러와 최신 댓글 위치로 스크롤한다
  const focusComments = location.hash === '#comments';
  const commentsEnd = useRef<HTMLDivElement>(null);
  const scrollToComments = useRef(false);

  useEffect(() => {
    let alive = true;
    setFeed(null);
    setError('');
    Promise.all([api.feed(id), api.comments(id, 0, focusComments ? COMMENTS_MAX : PAGE)])
      .then(([f, c]) => {
        if (!alive) return;
        setFeed(f.feed);
        setComments(c.items);
        setTotal(c.total);
        scrollToComments.current = focusComments;
      })
      .catch((err) => alive && setError((err as Error).message));
    return () => {
      alive = false;
    };
  }, [id, focusComments]);

  useEffect(() => {
    if (!feed || !scrollToComments.current) return;
    scrollToComments.current = false;
    commentsEnd.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [feed, comments]);

  // 열려 있는 동안 배경 스크롤을 막고, Esc 로 닫는다
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && navigate(closeTo);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [navigate, closeTo]);

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

  function startEdit(c: Comment) {
    setMenuFor(null);
    setEditing(c);
    setDraft(c.body);
    // 시트가 닫힌 뒤 입력칸에 커서를 둔다
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft('');
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      // 수정 중이면 아래 입력칸 내용으로 그 댓글을 고친다
      if (editing) {
        if (body !== editing.body) {
          await api.editComment(id, editing.id, body);
          setComments((list) => list.map((c) => (c.id === editing.id ? { ...c, body, edited: true } : c)));
          onCommentEdited(id, editing.id, body);
        }
        cancelEdit();
        return;
      }

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
      onCommentAdded(id, {
        id: comment.id,
        author: comment.author,
        authorRelation: comment.authorRelation,
        body: comment.body,
        deleted: false,
      });
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  const closeSheet = useCallback(() => setDeleting(null), []);
  const closeMenu = useCallback(() => setMenuFor(null), []);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteComment(id, deleting.id);
      setComments((list) => list.map((c) => (c.id === deleting.id ? { ...c, body: '', deleted: true } : c)));
      onCommentDeleted(id, deleting.id);
      if (editing?.id === deleting.id) cancelEdit();
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
            {feed ? (
              <>
                <div className="modal-title-row">
                  <h2 className="display">{formatFullDate(feed.date)}</h2>
                  {/* 엄마·아빠: 바로 수정. 저장·취소하면 이 상세로 돌아온다 */}
                  {canEdit && (
                    <Link to={`/compose/${feed.date}`} state={{ returnTo: location.pathname }} className="edit-link">
                      수정하기
                    </Link>
                  )}
                </div>
                <span className="hint">{formatWrittenLine(feed.date, feed.createdAt, feed.updatedAt)}</span>
              </>
            ) : (
              !error && (
                <>
                  <span className="skeleton skeleton-title" aria-hidden="true" />
                  <span className="skeleton skeleton-line is-short" aria-hidden="true" />
                </>
              )
            )}
          </div>
          <button ref={closeRef} type="button" className="icon-btn modal-close" aria-label="닫기" onClick={close}>
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          {error && <p className="feed-status" role="alert">{error}</p>}
          {!feed && !error && <DetailSkeleton />}
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
                        {/* 가로 스크롤은 리스트용 사진, 누르면 라이트박스에서 원본 */}
                        <img
                          src={p.thumbUrl}
                          alt={i === 0 ? '대표 사진' : `사진 ${i + 1}`}
                          loading={i < 2 ? 'eager' : 'lazy'}
                          decoding="async"
                        />
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
                    <div key={c.id} className={`comment${editing?.id === c.id ? ' is-editing' : ''}`}>
                      <Avatar nickname={c.author} relation={c.authorRelation} />
                      <div className="comment-main">
                        <div className="comment-meta">
                          <PersonName nickname={c.author} relation={c.authorRelation} />
                          <span>
                            {formatDateTime(c.createdAt, feed.date)}
                            {c.edited && ' · 수정됨'}
                          </span>
                        </div>
                        <span className="comment-text">{c.body}</span>
                      </div>
                      {c.mine && (
                        <button
                          type="button"
                          className="icon-btn comment-more"
                          aria-label="내 댓글 메뉴"
                          aria-haspopup="menu"
                          aria-expanded={menuFor?.comment.id === c.id}
                          onClick={(e) => {
                            const anchor = e.currentTarget;
                            setMenuFor((m) => (m?.comment.id === c.id ? null : { comment: c, anchor }));
                          }}
                        >
                          <MoreIcon />
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
                <div ref={commentsEnd} aria-hidden="true" />
              </div>
            </>
          )}
        </div>

        {/* 댓글 수정 중: 입력칸 위에 안내 줄. 보내기를 누르면 저장 */}
        {editing && (
          <div className="comment-edit-bar" role="status">
            <PencilIcon size={14} strokeWidth={2.2} />
            <span>댓글 수정 중</span>
            <button type="button" className="comment-edit-cancel" onClick={cancelEdit}>
              취소
            </button>
          </div>
        )}
        <form className={`comment-form${editing ? ' is-editing' : ''}`} onSubmit={send}>
          <label htmlFor="detail-comment" className="sr-only">
            {editing ? '댓글 수정' : '댓글 입력'}
          </label>
          <input
            ref={inputRef}
            id="detail-comment"
            className="comment-input"
            type="text"
            placeholder={editing ? '고칠 내용을 입력하세요' : '따뜻한 한마디 남기기'}
            maxLength={500}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!feed}
          />
          <button
            type="submit"
            className="send-btn"
            aria-label={editing ? '댓글 수정 저장' : '댓글 등록'}
            disabled={!feed || !draft.trim() || sending}
          >
            {editing ? <CheckIcon size={20} strokeWidth={2.4} /> : <SendIcon />}
          </button>
        </form>
      </section>

      {feed && viewing !== null && (
        <Lightbox photos={feed.photos} startIndex={viewing} onClose={closeLightbox} />
      )}

      {menuFor && (
        <PopoverMenu
          anchor={menuFor.anchor}
          label="내 댓글 메뉴"
          onClose={closeMenu}
          items={[
            { label: '수정하기', icon: <PencilIcon size={18} />, onSelect: () => startEdit(menuFor.comment) },
            {
              label: '제거하기',
              icon: <TrashIcon size={18} />,
              danger: true,
              onSelect: () => {
                setMenuFor(null);
                setDeleting(menuFor.comment);
              },
            },
          ]}
        />
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
