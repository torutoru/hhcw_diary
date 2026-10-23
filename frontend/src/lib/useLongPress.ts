import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';

const PRESS_MS = 500;
// 누른 채 이만큼 움직이면 스크롤로 보고 취소한다
const MOVE_TOLERANCE = 10;

/**
 * 길게 누르기(0.5초). 아이폰 사파리는 길게 눌러도 contextmenu 이벤트가 없어서 타이머로 직접 잰다.
 * 안드로이드·PC(오른쪽 클릭)는 contextmenu 로도 바로 연다. 휴대폰 기본 메뉴(이미지 저장 등)는 막는다.
 * 사용: <div {...longPress(element => ...)} />
 */
export function useLongPress() {
  const timer = useRef<number>();
  const start = useRef<{ x: number; y: number } | null>(null);

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    start.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  return useCallback(
    (onLongPress: (el: HTMLElement) => void) => ({
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const el = e.currentTarget;
        start.current = { x: e.clientX, y: e.clientY };
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          start.current = null;
          navigator.vibrate?.(10);
          onLongPress(el);
        }, PRESS_MS);
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        const s = start.current;
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > MOVE_TOLERANCE) cancel();
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onContextMenu: (e: MouseEvent<HTMLElement>) => {
        e.preventDefault();
        cancel();
        onLongPress(e.currentTarget);
      },
    }),
    [cancel],
  );
}
