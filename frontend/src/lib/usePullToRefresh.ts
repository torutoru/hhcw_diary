import { useEffect, useRef, useState } from 'react';

/** 이만큼(px) 당긴 뒤 놓으면 새로고침 */
export const PULL_THRESHOLD = 72;
/** 화면이 따라 내려오는 최대 거리(px) */
const PULL_MAX = 120;
/** 손가락 이동 대비 화면 이동 비율 (고무줄 같은 저항감) */
const RESISTANCE = 0.5;
/** 새로고침이 너무 빨리 끝나도 덮개를 잠깐은 보여준다 (가족 문구를 읽을 수 있게 2초, 사용자 요청) */
const MIN_SPIN_MS = 2000;

/**
 * 당겨서 새로고침: 페이지 맨 위에서 아래로 당겼다 놓으면 onRefresh 를 부른다.
 * - pull: 지금 당긴 거리(px). 화면 이동·아이콘 회전에 쓴다
 * - dragging: 손가락으로 당기는 중 (이때는 화면이 손가락을 바로 따라오고, 놓으면 부드럽게 돌아감)
 * - refreshing: 새로고침 중
 * 터치에서만 동작하고, enabled 가 false 면(상세 모달이 떠 있을 때 등) 쉰다
 */
export function usePullToRefresh(onRefresh: () => Promise<void>, enabled: boolean) {
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;

    const set = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1 || window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      // 위로 밀거나 페이지가 이미 스크롤됐으면 평소 스크롤
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current) set(0);
        setDragging(false);
        return;
      }
      // 당기는 동안은 브라우저 기본 동작(페이지 전체 새로고침·튕김)을 막고 직접 그린다
      e.preventDefault();
      setDragging(true);
      set(Math.min(PULL_MAX, dy * RESISTANCE));
    };

    const onEnd = async () => {
      if (startY.current === null) return;
      startY.current = null;
      setDragging(false);
      if (pullRef.current < PULL_THRESHOLD) {
        set(0);
        return;
      }
      // 놓으면 목록은 바로 제자리로 올리고, 새로고침 중 표시는 화면 전체를 덮는 회색 화면이 맡는다 (FeedPage)
      refreshingRef.current = true;
      setRefreshing(true);
      set(0);
      const started = Date.now();
      try {
        await onRefreshRef.current();
      } finally {
        const wait = MIN_SPIN_MS - (Date.now() - started);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        refreshingRef.current = false;
        setRefreshing(false);
      }
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    // preventDefault 를 쓰려면 passive: false 여야 한다
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      startY.current = null;
    };
  }, [enabled]);

  return { pull, dragging, refreshing };
}
