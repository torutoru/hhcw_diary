import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Photo } from '../api/types';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './Icons';

interface Props {
  photos: Photo[];
  startIndex: number;
  onClose: () => void;
}

/** 피드 상세의 사진을 전체 화면으로 크게 보기. 가로 스와이프(scroll-snap)로 넘긴다 */
export default function Lightbox({ photos, startIndex, onClose }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [index, setIndex] = useState(startIndex);

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(photos.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
  };

  // 열릴 때 누른 사진 위치로 바로 이동
  useLayoutEffect(() => {
    const el = track.current;
    if (el) el.scrollLeft = startIndex * el.clientWidth;
    closeBtn.current?.focus();
  }, [startIndex]);

  // Esc 는 라이트박스만 닫고 아래 상세 모달은 그대로 둔다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(index - 1);
      else if (e.key === 'ArrowRight') go(index + 1);
      else return;
      e.stopImmediatePropagation();
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const onScroll = () => {
    const el = track.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="사진 크게 보기">
      <div className="lightbox-top">
        <span className="lightbox-count" aria-live="polite">
          {index + 1} / {photos.length}
        </span>
        <button ref={closeBtn} type="button" className="lightbox-btn" aria-label="크게 보기 닫기" onClick={onClose}>
          <CloseIcon size={22} />
        </button>
      </div>

      <div className="lightbox-track" ref={track} onScroll={onScroll}>
        {photos.map((p, i) => (
          <div key={p.id} className="lightbox-slide">
            <img src={p.url} alt={i === 0 ? '대표 사진' : `사진 ${i + 1}`} decoding="async" />
          </div>
        ))}
      </div>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            className="lightbox-btn lightbox-nav is-prev"
            aria-label="이전 사진"
            onClick={() => go(index - 1)}
            disabled={index === 0}
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            className="lightbox-btn lightbox-nav is-next"
            aria-label="다음 사진"
            onClick={() => go(index + 1)}
            disabled={index === photos.length - 1}
          >
            <ChevronRightIcon />
          </button>
        </>
      )}
    </div>
  );
}
