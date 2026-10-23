import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export interface PopoverItem {
  label: string;
  icon?: ReactNode;
  /** 지우기처럼 되돌리기 어려운 동작은 빨간색 */
  danger?: boolean;
  onSelect: () => void;
}

interface Props {
  /** 메뉴를 연 버튼. 이 버튼 바로 위(공간이 없으면 아래)에 붙는다 */
  anchor: HTMLElement;
  items: PopoverItem[];
  onClose: () => void;
  label: string;
}

const GAP = 6;
const EDGE = 12;

/**
 * ⋯ 버튼 위에 떠 있는 작은 메뉴. 스크롤 영역 안에서도 잘리지 않게 화면 좌표(position: fixed)로 띄운다.
 * 바깥 누르기·Esc·스크롤·화면 크기 변경 시 닫힌다
 */
export default function PopoverMenu({ anchor, items, onClose, label }: Props) {
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  // 버튼 위치에 맞춰 놓는다: 기본은 버튼 위, 위에 공간이 없으면 버튼 아래. 오른쪽 끝을 버튼에 맞춘다
  useLayoutEffect(() => {
    const a = anchor.getBoundingClientRect();
    const height = menu.current?.offsetHeight ?? 0;
    const width = menu.current?.offsetWidth ?? 0;
    const above = a.top - GAP - height;
    const top = above >= EDGE ? above : a.bottom + GAP;
    // 왼쪽에 있는 버튼(작성 화면의 첫 사진 등)이면 메뉴가 화면 왼쪽 밖으로 나가지 않게 당긴다
    const right = Math.max(EDGE, Math.min(window.innerWidth - a.right, window.innerWidth - width - EDGE));
    setPos({ top, right });
    menu.current?.querySelector('button')?.focus();
  }, [anchor]);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !anchor.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // 상세 모달 위에서는 메뉴만 닫히고 모달은 그대로
      e.stopImmediatePropagation();
      onClose();
      anchor.focus();
    };
    // 목록을 스크롤하면 버튼이 움직이므로 닫는다 (메뉴 안 스크롤은 없음)
    const onScroll = () => onClose();
    document.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [anchor, onClose]);

  return (
    <div
      ref={menu}
      className="popover-menu"
      role="menu"
      aria-label={label}
      // 첫 그리기 때는 크기만 재고 보이지 않게, 위치가 정해지면 표시
      style={pos ? { top: pos.top, right: pos.right } : { visibility: 'hidden', top: 0, right: 0 }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={`menu-item${item.danger ? ' is-danger' : ''}`}
          onClick={item.onSelect}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
