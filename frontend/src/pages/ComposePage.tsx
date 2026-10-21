import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { CloseIcon, PhotoIcon, PlusIcon } from '../components/Icons';
import { formatComposeDate } from '../lib/format';
import { preShrink } from '../lib/imageResize';

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
          preview: p.url,
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
  async function upload(slot: Slot, file: File, isCover: boolean) {
    let patch: Partial<Slot>;
    try {
      const blob = await preShrink(file);
      const res = await api.uploadImage(blob, file.name);
      if (discarded.current.has(slot.key)) {
        api.deleteImage(res.id).catch(() => undefined);
        return;
      }
      patch = { imageId: res.id, status: 'done' };
    } catch (err) {
      patch = { status: 'error', error: (err as Error).message };
    }
    if (isCover) setCover((c) => (c?.key === slot.key ? { ...c, ...patch } : c));
    else setExtras((list) => list.map((s) => (s.key === slot.key ? { ...s, ...patch } : s)));
  }

  function onPickCover(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (cover) discard(cover);
    const slot = makeSlot(file);
    setCover(slot);
    upload(slot, file, true);
  }

  function onPickExtras(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_EXTRA - extras.length);
    e.target.value = '';
    const slots = files.map(makeSlot);
    setExtras((list) => [...list, ...slots]);
    slots.forEach((slot, i) => upload(slot, files[i], false));
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
      navigate('/', { replace: true });
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
        <Link to="/compose" onClick={() => all.forEach(discard)}>
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
              <img src={cover.preview} alt="대표 사진" />
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
              <div key={s.key} className="thumb">
                <img src={s.preview} alt={`추가 사진 ${i + 1}`} />
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
        </div>

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
