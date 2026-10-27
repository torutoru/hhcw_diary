import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react';
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
// 두 번 탭(더블클릭): 원래 크기면 탭한 곳을 중심으로 2.5배, 확대 중이면(배율과 상관없이) 원래 크기로
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 40;
// 한 번의 "탭": 이 시간 안에 이 거리 이하로만 움직이고 뗀 터치
const TAP_MAX_MS = 250;
const TAP_MAX_MOVE_PX = 10;
const ZOOM_ANIMATION_MS = 220;
// 확대 중 가장자리에서 더 끌어 넘기기: 손가락 이동 거리 기준
const EDGE_SWIPE_PX = 60;
const EDGE_EPSILON = 2;

const clientX = (e: TouchEvent | MouseEvent) =>
  'changedTouches' in e ? (e.changedTouches[0]?.clientX ?? 0) : e.clientX;

/**
 * 확대를 원래 크기로 되돌린다.
 * resetTransform(0)은 값만 바로 바꾸고 진행 중인 애니메이션(손을 뗀 뒤 위치 맞춤 등)을 멈추지 않아서,
 * 그 애니메이션이 다음 프레임에 예전 확대 값을 다시 적용한다(사용자 제보: 돌아온 사진이 확대된 채로 보임).
 * 1ms 로 부르면 라이브러리가 기존 애니메이션을 먼저 멈추고 되돌린다.
 */
const resetZoom = (ref: ReactZoomPanPinchContentRef | null | undefined) => ref?.resetTransform(1);

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
    resetZoom(zoomRefs.current[index]);
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

  // 사진이 바뀌면 (새로 보게 된 사진을 포함해) 모든 사진의 확대를 초기화한다.
  // 스와이프·가장자리 끌기·버튼·방향키 어떤 방법으로 넘겨도, 다시 돌아와도 항상 원래 크기에서 시작
  // (넘기는 도중 시작된 위치 맞춤 애니메이션이 있으면 resetZoom 이 멈추고 되돌린다)
  useEffect(() => {
    zoomRefs.current.forEach(resetZoom);
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
      resetZoom(zoomRefs.current[index]);
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

  // 두 번 탭은 직접 감지한다. 라이브러리의 두 번 탭은 브라우저 dblclick 이벤트에 기대는데 휴대폰(특히 아이폰)은
  // 이를 거의 보내지 않고, 원래 크기에서는 사진 넘기기 때문에 끌기를 꺼 둬서 터치 감지도 동작하지 않았다.
  // 또 라이브러리 toggle 은 확대 중일 때 한 단계만 줄여서 "원래대로"가 되지 않았다
  const toggleZoom = (i: number, x: number, y: number) => {
    const ref = zoomRefs.current[i];
    const wrapper = ref?.instance.wrapperComponent;
    if (!ref || !wrapper) return;
    if (ref.instance.transformState.scale > 1.01) {
      ref.resetTransform(ZOOM_ANIMATION_MS);
      return;
    }
    // 탭한 지점이 확대 뒤에도 손가락 아래에 있도록. 사진 영역은 확대 영역을 꽉 채우므로 그 크기로 가장자리를 맞춘다
    const rect = wrapper.getBoundingClientRect();
    const s = DOUBLE_TAP_SCALE;
    const clamp = (v: number, size: number) => Math.min(0, Math.max(size * (1 - s), v));
    ref.setTransform(
      clamp((x - rect.left) * (1 - s), rect.width),
      clamp((y - rect.top) * (1 - s), rect.height),
      s,
      ZOOM_ANIMATION_MS,
    );
  };

  const touch = useRef<{ x: number; y: number; at: number } | null>(null);
  const lastTap = useRef<{ x: number; y: number; at: number } | null>(null);
  // 터치로 토글한 직후 브라우저가 dblclick 을 또 보내면 두 번 토글되지 않게
  const touchToggledAt = useRef(0);

  const onSlideTouchStart = (e: ReactTouchEvent) => {
    const t = e.touches[0];
    touch.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
    if (e.touches.length > 1) lastTap.current = null; // 핀치는 탭이 아니다
  };
  const onSlideTouchEnd = (i: number) => (e: ReactTouchEvent) => {
    const start = touch.current;
    touch.current = null;
    const t = e.changedTouches[0];
    if (!start || !t || e.touches.length > 0) return;
    const now = Date.now();
    const isTap = now - start.at < TAP_MAX_MS && Math.hypot(t.clientX - start.x, t.clientY - start.y) < TAP_MAX_MOVE_PX;
    if (!isTap) {
      lastTap.current = null;
      return;
    }
    const prev = lastTap.current;
    if (prev && now - prev.at < DOUBLE_TAP_MS && Math.hypot(t.clientX - prev.x, t.clientY - prev.y) < DOUBLE_TAP_SLOP_PX) {
      lastTap.current = null;
      touchToggledAt.current = now;
      e.preventDefault();
      toggleZoom(i, t.clientX, t.clientY);
    } else {
      lastTap.current = { x: t.clientX, y: t.clientY, at: now };
    }
  };
  const onSlideDoubleClick = (i: number) => (e: ReactMouseEvent) => {
    if (Date.now() - touchToggledAt.current < 800) return;
    toggleZoom(i, e.clientX, e.clientY);
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
          <div
            key={p.id}
            className="lightbox-slide"
            onTouchStart={onSlideTouchStart}
            onTouchEnd={onSlideTouchEnd(i)}
            onDoubleClick={onSlideDoubleClick(i)}
          >
            <TransformWrapper
              ref={(r) => {
                zoomRefs.current[i] = r;
              }}
              minScale={1}
              maxScale={MAX_SCALE}
              limitToBounds
              centerZoomedOut
              // 두 번 탭·더블클릭은 직접 처리 (toggleZoom)
              doubleClick={{ disabled: true }}
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
