import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchContentRef,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';
import type { Photo } from '../api/types';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './Icons';

interface Props {
  photos: Photo[];
  startIndex: number;
  onClose: () => void;
}

const MAX_SCALE = 4;
// 두 번 탭: 약 2.5배 확대 / 확대 중이면 원래대로
const DOUBLE_TAP_STEP = 0.9;
// 확대 중 가장자리에서 더 끌어 넘기기: 손가락 이동 거리 기준
const EDGE_SWIPE_PX = 60;
const EDGE_EPSILON = 2;

const clientX = (e: TouchEvent | MouseEvent) =>
  'changedTouches' in e ? (e.changedTouches[0]?.clientX ?? 0) : e.clientX;

/**
 * 피드 상세의 사진을 전체 화면으로 크게 보기.
 * - 확대 안 함: 가로 스와이프(scroll-snap)로 이전·다음 사진
 * - 확대 중(핀치·두 번 탭·휠): 끌어서 사진 안 이동, 사진 넘기기는 멈춤
 * - 확대 중 가장자리에 닿은 상태에서 같은 방향으로 한 번 더 끌면 이전·다음 사진
 */
export default function Lightbox({ photos, startIndex, onClose }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const zoomRefs = useRef<(ReactZoomPanPinchContentRef | null)[]>([]);
  const panStart = useRef<{ x: number; atLeftEdge: boolean; atRightEdge: boolean } | null>(null);
  const [index, setIndex] = useState(startIndex);
  const [zoomed, setZoomed] = useState(false);

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(photos.length - 1, i));
    if (next === index) return;
    // 확대를 풀고 넘긴다 (다른 사진은 항상 원래 크기에서 시작)
    zoomRefs.current[index]?.resetTransform(0);
    setZoomed(false);
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

  // 사진이 바뀌면 지금 사진을 뺀 모든 사진의 확대를 초기화한다.
  // 스와이프·가장자리 끌기·버튼·방향키 어떤 방법으로 넘겨도 새 사진은 항상 원래 크기에서 시작
  useEffect(() => {
    zoomRefs.current.forEach((ref, i) => {
      if (i !== index) ref?.resetTransform(0);
    });
    setZoomed(false);
  }, [index]);

  // 아이폰 사파리의 페이지 전체 확대를 막는다 (사진 확대는 라이브러리가 처리)
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', block);
    return () => document.removeEventListener('gesturestart', block);
  }, []);

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) {
      zoomRefs.current[index]?.resetTransform(0);
      setZoomed(false);
      setIndex(i);
    }
  };

  // 가장자리에서 더 끌기: 끌기를 "시작할 때" 이미 그 방향 가장자리였고, 손가락을 충분히 움직였으면 넘긴다.
  // (끌다가 도중에 가장자리에 닿은 경우는 넘기지 않음. 손을 뗄 때 위치는 튕김 효과로 살짝 밀려 있어서 시작 시점으로 판단)
  const onPanningStart = (ref: ReactZoomPanPinchRef, e: TouchEvent | MouseEvent) => {
    const bounds = ref.instance.bounds;
    const x = ref.state.positionX;
    panStart.current = {
      x: clientX(e),
      // 사진의 오른쪽 끝이 보이는 상태 = 위치가 최솟값
      atRightEdge: !!bounds && x <= bounds.minPositionX + EDGE_EPSILON,
      atLeftEdge: !!bounds && x >= bounds.maxPositionX - EDGE_EPSILON,
    };
  };
  const onPanningStop = (ref: ReactZoomPanPinchRef, e: TouchEvent | MouseEvent) => {
    const start = panStart.current;
    panStart.current = null;
    if (!start || ref.state.scale <= 1.01) return;
    const dx = clientX(e) - start.x;
    if (dx <= -EDGE_SWIPE_PX && start.atRightEdge) go(index + 1);
    else if (dx >= EDGE_SWIPE_PX && start.atLeftEdge) go(index - 1);
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

      {/* 확대 중에는 가로 스크롤(사진 넘기기)을 멈춰 손가락 움직임이 확대한 사진 이동에 쓰이게 한다 */}
      <div className={`lightbox-track${zoomed ? ' is-zoomed' : ''}`} ref={track} onScroll={onScroll}>
        {photos.map((p, i) => (
          <div key={p.id} className="lightbox-slide">
            <TransformWrapper
              ref={(r) => {
                zoomRefs.current[i] = r;
              }}
              minScale={1}
              maxScale={MAX_SCALE}
              limitToBounds
              centerZoomedOut
              doubleClick={{ mode: 'toggle', step: DOUBLE_TAP_STEP }}
              wheel={{ step: 0.15 }}
              // 원래 크기에서는 끌기를 라이브러리가 가져가지 않게 해서 스와이프 넘기기가 동작하도록
              panning={{ disabled: !(zoomed && i === index), velocityDisabled: true }}
              onTransformed={(_ref, state) => {
                if (i === index) setZoomed(state.scale > 1.01);
              }}
              onPanningStart={onPanningStart}
              onPanningStop={onPanningStop}
            >
              <TransformComponent wrapperClass="lightbox-zoom" contentClass="lightbox-zoom-content">
                <img src={p.url} alt={i === 0 ? '대표 사진' : `사진 ${i + 1}`} decoding="async" draggable={false} />
              </TransformComponent>
            </TransformWrapper>
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
