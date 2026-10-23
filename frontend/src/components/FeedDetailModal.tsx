import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type UIEvent } from 'react';
import { Link, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Comment, FeedDetail } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { DELETED_COMMENT_TEXT } from '../lib/comments';
import { lockScroll, unlockScroll } from '../lib/scrollLock';
import ConfirmSheet from './ConfirmSheet';
import Lightbox from './Lightbox';
import NewBadge from './NewBadge';
import { Avatar, PersonName } from './Person';
import PopoverMenu from './PopoverMenu';
import { formatDateTime, formatFullDate, formatWrittenLine } from '../lib/format';
import type { FeedOutletContext } from '../pages/FeedPage';
import { CheckIcon, CloseIcon, MoreIcon, PencilIcon, SendIcon, TrashIcon } from './Icons';

// 피드 내용 아래에는 최근 댓글 3개만. 더 있으면 "이전 댓글 보기"로 댓글 영역을 펼친다
const RECENT = 3;
// 펼친 댓글 영역에서 위로 올릴 때 한 번에 불러오는 이전 댓글 수
const OLDER_PAGE = 20;
// 펼친 댓글 영역에서 맨 위까지 이만큼 남으면 이전 댓글을 미리 불러온다
const LOAD_OLDER_AT = 160;

/** 이전 댓글을 불러오는 동안 목록 맨 위에 보이는 뼈대 */
function CommentsSkeleton() {
  return (
    <>
      <span className="sr-only" role="status">
        이전 댓글을 불러오는 중
      </span>
      {[0, 1].map((i) => (
        <div key={i} className="comment" aria-hidden="true">
          <span className="skeleton avatar" />
          <div className="comment-main">
            <span className="skeleton skeleton-line is-tiny" />
            <span className="skeleton skeleton-line" />
          </div>
        </div>
      ))}
    </>
  );
}

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
  const { onCommentAdded, onCommentDeleted, onCommentEdited, onFeedRead, closeTo } =
    useOutletContext<FeedOutletContext>();
  // 이 피드를 이전에 본 시각. 그 뒤 달린 남의 댓글에 "N" (열어 둔 동안은 유지, 다음에 열면 사라짐)
  const [previousReadAt, setPreviousReadAt] = useState<string | null>(null);
  const location = useLocation();
  const canEdit = useAuth().user?.role === 'parent';
  // 내 댓글 ⋯ 메뉴(버튼 위에 뜸) → 수정(아래 입력칸에서) / 제거(확인 시트)
  const [menuFor, setMenuFor] = useState<{
    comment: Comment;
    anchor: HTMLElement;
  } | null>(null);
  const [editing, setEditing] = useState<Comment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState<Comment | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const closeLightbox = useCallback(() => setViewing(null), []);
  const [feed, setFeed] = useState<FeedDetail | null>(null);
  // 불러온 댓글(시간순: 오래된 것 → 최신). 처음엔 최근 RECENT 개, 펼친 뒤 위로 올릴수록 이전 댓글이 붙는다
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadingOlderRef = useRef(false);
  // 댓글 영역 펼침: 피드 내용은 위의 한 줄 요약으로 줄고, 댓글만 따로 스크롤된다
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // 열었던 화면(메인 피드 또는 검색 달력)으로 돌아간다
  const close = () => navigate(closeTo);

  // 댓글 알림으로 열면(주소 끝 #comments) 맨 아래(최신 댓글)로 스크롤한다
  const focusComments = location.hash === '#comments';
  const bodyRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = useRef(false);
  // 이전 댓글을 위에 붙이기 직전의 스크롤 높이·위치. 붙인 뒤 보던 댓글이 제자리에 있게 맞춘다
  const prependFrom = useRef<{ height: number; top: number } | null>(null);

  // 열면 읽음 처리 → 메인 피드 카드의 "N"도 지운다
  useEffect(() => {
    let alive = true;
    setPreviousReadAt(null);
    api
      .markRead(id)
      .then((res) => {
        if (!alive) return;
        setPreviousReadAt(res.previousReadAt);
        onFeedRead(id);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id, onFeedRead]);

  useEffect(() => {
    let alive = true;
    setFeed(null);
    setError('');
    setExpanded(false);
    Promise.all([api.feed(id), api.comments(id, RECENT)])
      .then(([f, c]) => {
        if (!alive) return;
        setFeed(f.feed);
        setComments(c.items);
        setTotal(c.total);
        setHasOlder(c.hasMore);
        scrollToBottom.current = focusComments;
      })
      .catch((err) => alive && setError((err as Error).message));
    return () => {
      alive = false;
    };
  }, [id, focusComments]);

  // 지금 보이는 스크롤 영역(평소 .modal-body, 펼치면 댓글 영역)을 직접 맨 아래로 지정한다.
  // scrollIntoView 는 떠 있는 창 안의 스크롤 영역에서 아이폰 등이 무시하거나 중간에 멈출 수 있어서 쓰지 않는다.
  // 그린 직후 한 번, 사진·글꼴이 늦게 들어와 높이가 바뀔 때를 대비해 조금 뒤에 두 번 더 맞춘다
  useEffect(() => {
    if (!feed || !scrollToBottom.current) return;
    scrollToBottom.current = false;
    const toBottom = () => {
      const el = expanded ? panelRef.current : bodyRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    };
    const frame = requestAnimationFrame(toBottom);
    const timers = [300, 900].map((ms) => window.setTimeout(toBottom, ms));
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [feed, comments, expanded]);

  // 이전 댓글이 위에 붙으면 늘어난 높이만큼 내려서, 보던 댓글이 그 자리에 그대로 있게 한다 (그리기 전에)
  useLayoutEffect(() => {
    const from = prependFrom.current;
    const panel = panelRef.current;
    if (!from || !panel) return;
    prependFrom.current = null;
    panel.scrollTop = from.top + (panel.scrollHeight - from.height);
  }, [comments]);

  // 열려 있는 동안 뒤 페이지(목록)를 그 자리에 고정한다. 닫으면 보던 위치 그대로 (아이폰 대응, lib/scrollLock)
  useEffect(() => {
    lockScroll();
    closeRef.current?.focus();
    return unlockScroll;
  }, []);

  // Esc 로 닫는다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && navigate(closeTo);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, closeTo]);

  // 지금 가진 가장 오래된 댓글보다 이전 댓글을 위에 붙인다
  async function loadOlder() {
    if (loadingOlderRef.current || !hasOlder || comments.length === 0) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const res = await api.comments(id, OLDER_PAGE, comments[0].id);
      const panel = panelRef.current;
      if (panel)
        prependFrom.current = {
          height: panel.scrollHeight,
          top: panel.scrollTop,
        };
      setComments((prev) => [...res.items, ...prev]);
      setHasOlder(res.hasMore);
      setTotal(res.total);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }

  // "이전 댓글 보기": 댓글 영역을 펼쳐 최신 댓글이 보이는 맨 아래에서 시작하고, 바로 이전 댓글을 불러온다
  function expand() {
    setExpanded(true);
    scrollToBottom.current = true;
    void loadOlder();
  }

  function onPanelScroll(e: UIEvent<HTMLDivElement>) {
    if (e.currentTarget.scrollTop < LOAD_OLDER_AT) void loadOlder();
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
      // 새 댓글은 맨 아래. 내가 쓴 댓글이 보이게 맨 아래로 이동
      setComments((list) => [...list, comment]);
      setTotal((t) => t + 1);
      setDraft('');
      scrollToBottom.current = true;
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

  // 펼치지 않았으면 최근 RECENT 개만 보이고, 나머지는 "이전 댓글 N개 보기"
  const visible = expanded ? comments : comments.slice(-RECENT);
  const hiddenCount = total - visible.length;

  const renderComment = (c: Comment, feedDate: string) =>
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
              {formatDateTime(c.createdAt, feedDate)}
              {c.edited && ' · 수정됨'}
            </span>
            {!c.mine && previousReadAt !== null && c.createdAt > previousReadAt && <NewBadge label="새 댓글" />}
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
    );

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

        {/* 펼친 댓글 영역: 피드 내용은 한 줄 요약(누르면 접힘), 댓글만 따로 스크롤. 위로 올리면 이전 댓글 */}
        {feed && expanded ? (
          <div className="comments-panel">
            <button
              type="button"
              className="comments-panel-feed"
              onClick={() => setExpanded(false)}
              aria-expanded={true}
            >
              {feed.photos[0] && <img src={feed.photos[0].thumbUrl} alt="" />}
              <span className="comments-panel-summary">{feed.body || `사진 ${feed.photos.length}장`}</span>
              <span className="comments-panel-back">피드 보기</span>
            </button>
            <div className="comments-panel-scroll" ref={panelRef} onScroll={onPanelScroll}>
              <div className="comments">
                <h3>
                  댓글 <span>{total}</span>
                </h3>
                {loadingOlder && <CommentsSkeleton />}
                {!loadingOlder && hasOlder && (
                  <button type="button" className="more-btn" onClick={() => void loadOlder()}>
                    이전 댓글 더 보기
                  </button>
                )}
                {comments.map((c) => renderComment(c, feed.date))}
              </div>
            </div>
          </div>
        ) : (
          <div className="modal-body" ref={bodyRef}>
            {error && (
              <p className="feed-status" role="alert">
                {error}
              </p>
            )}
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
                  {hiddenCount > 0 && (
                    <button type="button" className="more-btn" onClick={expand} aria-expanded={false}>
                      이전 댓글 {hiddenCount}개 보기
                    </button>
                  )}
                  {visible.map((c) => renderComment(c, feed.date))}
                </div>
              </>
            )}
          </div>
        )}

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

      {feed && viewing !== null && <Lightbox photos={feed.photos} startIndex={viewing} onClose={closeLightbox} />}

      {menuFor && (
        <PopoverMenu
          anchor={menuFor.anchor}
          label="내 댓글 메뉴"
          onClose={closeMenu}
          items={[
            {
              label: '수정하기',
              icon: <PencilIcon size={18} />,
              onSelect: () => startEdit(menuFor.comment),
            },
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
