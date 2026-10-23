import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { CloseIcon, PhotoIcon, PlusIcon } from '../components/Icons';
import PopoverMenu from '../components/PopoverMenu';
import { formatComposeDate } from '../lib/format';
import { preShrink } from '../lib/imageResize';
import { useLongPress } from '../lib/useLongPress';

const MAX_EXTRA = 5;

interface Slot {
  key: string;
  preview: string;
  imageId?: string;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  /** 이 화면에서 새로 올린 사진. 빼면 서버에서 바로 지운다 (저장된 피드의 기존 사진은 저장할 때 정리) */
  fresh?: boolean;
}

let seq = 0;
const nextKey = () => `slot-${++seq}`;

/** /compose/:date — 달력에서 고른 날짜의 피드 작성(없을 때) 또는 수정(있을 때) */
export default function ComposePage() {
  const navigate = useNavigate();
  const { date = '' } = useParams();
  // 피드 상세의 "수정하기"로 들어오면 저장·취소 후 그 상세로 돌아간다 (달력에서 왔으면 없음)
  const returnTo = (useLocation().state as { returnTo?: string } | null)?.returnTo;
  const [isToday, setIsToday] = useState(false);
  const [feedId, setFeedId] = useState<string | null>(null);
  const [cover, setCover] = useState<Slot | null>(null);
  const [extras, setExtras] = useState<Slot[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const coverInput = useRef<HTMLInputElement>(null);
  const extraInput = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);
  // 업로드가 끝나기 전에 뺀 사진. 업로드가 끝나는 즉시 지운다
  const discarded = useRef(new Set<string>());
  // 추가 사진을 길게 누르면 사진 위에 뜨는 메뉴 → "대표 사진으로 적용하기"
  const longPress = useLongPress();
  const [menuFor, setMenuFor] = useState<{ slot: Slot; anchor: HTMLElement } | null>(null);
  const closeMenu = useCallback(() => setMenuFor(null), []);

  useEffect(() => {
    api
      .feedByDate(date)
      .then(({ isToday, feed }) => {
        setIsToday(isToday);
        if (!feed) return;
        setFeedId(feed.id);
        setBody(feed.body);
        const [first, ...rest] = feed.photos.map<Slot>((p) => ({
          key: nextKey(),
          preview: p.thumbUrl,
          imageId: p.id,
          status: 'done',
        }));
        setCover(first ?? null);
        setExtras(rest);
      })
      .catch((err) => setLoadError((err as Error).message))
      .finally(() => setLoading(false));
    return () => objectUrls.current.forEach((u) => URL.revokeObjectURL(u));
  }, [date]);

  function makeSlot(file: File): Slot {
    const preview = URL.createObjectURL(file);
    objectUrls.current.push(preview);
    return { key: nextKey(), preview, status: 'uploading', fresh: true };
  }

  /** 화면에서 뺀 사진 정리. 새로 올린 사진만 서버에서 바로 지운다 (실패해도 서버가 24시간 뒤 정리) */
  function discard(slot: Slot) {
    if (!slot.fresh) return;
    discarded.current.add(slot.key);
    if (slot.imageId) api.deleteImage(slot.imageId).catch(() => undefined);
  }

  // 업로드 결과를 key 로 찾아 반영. 그 사이 사진을 뺐으면 올라간 사진을 바로 지운다
  async function upload(slot: Slot, file: File) {
    let patch: Partial<Slot>;
    try {
      const blob = await preShrink(file);
      const res = await api.uploadImage(blob, file.name);
      if (discarded.current.has(slot.key)) {
        api.deleteImage(res.id).catch(() => undefined);
        return;
      }
      // 미리보기를 휴대폰 원본(장당 수십 MB 메모리)에서 서버의 리스트용 사진으로 바꾼다
      patch = { imageId: res.id, status: 'done', preview: res.thumbUrl };
    } catch (err) {
      patch = { status: 'error', error: (err as Error).message };
    }
    // 올리는 사이 대표 사진과 자리를 바꿨을 수 있어 양쪽에서 key 로 찾는다
    setCover((c) => (c?.key === slot.key ? { ...c, ...patch } : c));
    setExtras((list) => list.map((s) => (s.key === slot.key ? { ...s, ...patch } : s)));
  }

  /** 추가 사진을 대표 사진으로: 두 사진의 자리를 맞바꾼다 (원래 대표 사진은 그 추가 사진 자리로) */
  function makeCover(slot: Slot) {
    setExtras((list) => {
      if (!cover) return list.filter((s) => s.key !== slot.key);
      return list.map((s) => (s.key === slot.key ? cover : s));
    });
    setCover(slot);
  }

  function onPickCover(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (cover) discard(cover);
    const slot = makeSlot(file);
    setCover(slot);
    upload(slot, file);
  }

  function onPickExtras(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_EXTRA - extras.length);
    e.target.value = '';
    const slots = files.map(makeSlot);
    setExtras((list) => [...list, ...slots]);
    slots.forEach((slot, i) => upload(slot, files[i]));
  }

  const all = [cover, ...extras].filter((s): s is Slot => s !== null);
  const uploading = all.some((s) => s.status === 'uploading');
  const failed = all.some((s) => s.status === 'error');
  const canSave = cover?.status === 'done' && !uploading && !failed && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const imageIds = all.map((s) => s.imageId!);
      if (feedId) await api.updateFeed(feedId, body, imageIds);
      else await api.createFeed(date, body, imageIds);
      // 상세에서 왔으면 한 단계 뒤(그 상세)로. 상세는 다시 불러와서 수정한 내용이 바로 보인다
      if (returnTo) navigate(-1);
      else navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  const isEdit = feedId !== null;
  const heading = `${isToday ? '오늘의 ' : ''}피드 ${isEdit ? '수정' : '작성'}`;

  if (loading) return <div className="center-loading">불러오는 중…</div>;

  // 잘못된 날짜(미래, 없는 날짜)로 들어온 경우
  if (loadError) {
    return (
      <main className="result">
        <h1 className="display">{loadError}</h1>
        <Link to="/compose" className="btn btn-primary">
          달력으로 돌아가기
        </Link>
      </main>
    );
  }

  return (
    <>
      <header className="compose-header">
        {/* 취소하면 이번에 올린 사진은 모두 지운다 */}
        <Link
          to={returnTo ?? '/compose'}
          onClick={(e) => {
            all.forEach(discard);
            // 상세에서 왔으면 뒤로 가기 기록이 겹치지 않게 한 단계 뒤로
            if (returnTo) {
              e.preventDefault();
              navigate(-1);
            }
          }}
        >
          취소
        </Link>
        <h1 className="display">{heading}</h1>
        <span style={{ width: 56 }} />
      </header>

      <main className="compose">
        <div className="compose-date">
          {isToday && <span className="badge-today">오늘</span>}
          <span>{formatComposeDate(date)}</span>
          <span className="hint">· 하루 한 번</span>
        </div>

        <div className="compose-section">
          <span className="compose-label">
            대표 사진 <span className="req">*</span>
          </span>
          {cover ? (
            <div className="cover-preview">
              <img src={cover.preview} alt="대표 사진" decoding="async" />
              <SlotState slot={cover} />
              <button type="button" className="chip-btn" onClick={() => coverInput.current?.click()}>
                사진 바꾸기
              </button>
            </div>
          ) : (
            <button type="button" className="cover-pick" onClick={() => coverInput.current?.click()}>
              <PhotoIcon size={36} strokeWidth={1.6} />
              대표 사진 고르기
            </button>
          )}
          <input ref={coverInput} type="file" accept="image/*" hidden onChange={onPickCover} />
        </div>

        <div className="compose-section">
          <div className="compose-label-row">
            <span className="compose-label">사진 더하기</span>
            <span className="hint">
              {extras.length} / {MAX_EXTRA}
            </span>
          </div>
          <div className="thumbs">
            {extras.map((s, i) => (
              <div
                key={s.key}
                className={`thumb${menuFor?.slot.key === s.key ? ' is-pressed' : ''}`}
                {...longPress((anchor) => setMenuFor({ slot: s, anchor }))}
              >
                <img src={s.preview} alt={`추가 사진 ${i + 1}`} decoding="async" />
                <SlotState slot={s} />
                <button
                  type="button"
                  className="thumb-remove"
                  aria-label="사진 빼기"
                  onClick={() => {
                    discard(s);
                    setExtras((list) => list.filter((x) => x.key !== s.key));
                  }}
                >
                  <CloseIcon size={12} strokeWidth={3} />
                </button>
              </div>
            ))}
            {Array.from({ length: MAX_EXTRA - extras.length }, (_, i) => (
              <button
                key={`empty-${i}`}
                type="button"
                className="thumb-add"
                aria-label="사진 추가"
                onClick={() => extraInput.current?.click()}
              >
                <PlusIcon size={20} strokeWidth={2} />
              </button>
            ))}
          </div>
          <input ref={extraInput} type="file" accept="image/*" multiple hidden onChange={onPickExtras} />
          {extras.length > 0 && <span className="hint">사진을 길게 누르면 대표 사진으로 바꿀 수 있어요.</span>}
        </div>

        {menuFor && (
          <PopoverMenu
            anchor={menuFor.anchor}
            label="사진 메뉴"
            onClose={closeMenu}
            items={[
              {
                label: '대표 사진으로 적용하기',
                icon: <PhotoIcon size={18} strokeWidth={2} />,
                onSelect: () => {
                  makeCover(menuFor.slot);
                  setMenuFor(null);
                },
              },
            ]}
          />
        )}

        <div className="compose-section">
          <label htmlFor="compose-text" className="compose-label">
            오늘 이야기
          </label>
          <textarea
            id="compose-text"
            className="textarea"
            placeholder="오늘 우리 가족에게 있었던 일을 적어주세요"
            maxLength={5000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        {failed && <p className="form-error">올리지 못한 사진이 있어요. 빼고 다시 골라 주세요.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}

        <button type="button" className="btn btn-primary" onClick={save} disabled={!canSave}>
          {saving ? '저장 중…' : uploading ? '사진 올리는 중…' : isEdit ? '수정 저장하기' : '피드 올리기'}
        </button>
      </main>
    </>
  );
}

function SlotState({ slot }: { slot: Slot }) {
  if (slot.status === 'uploading') return <span className="upload-state">올리는 중</span>;
  if (slot.status === 'error')
    return (
      <span className="upload-state is-error" title={slot.error}>
        실패
      </span>
    );
  return null;
}
