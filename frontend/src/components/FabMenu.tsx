import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PencilIcon, PlusIcon, SearchIcon } from './Icons';

/**
 * 메인 피드 오른쪽 아래 플로팅 버튼
 * - 일반 사용자: 돋보기 → 피드 검색하기(/search)
 * - 관리자(엄마·아빠): ＋ → 누르면 ×로 돌면서 "피드 작성하기"(/compose), "피드 검색하기"(/search) 메뉴가 위로 펼쳐짐
 */
export default function FabMenu({ isParent }: { isParent: boolean }) {
  const [open, setOpen] = useState(false);

  // 펼친 메뉴는 Esc 로 접는다
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!isParent) {
    return (
      <Link to="/search" className="fab" aria-label="피드 검색하기" title="피드 검색하기">
        <SearchIcon size={26} strokeWidth={2.2} />
      </Link>
    );
  }

  return (
    <>
      {/* 펼쳤을 때 뒤를 살짝 어둡게. 누르면 접힌다 */}
      {open && <button type="button" className="fab-backdrop" aria-label="메뉴 닫기" onClick={() => setOpen(false)} />}

      <div className={`fab-menu${open ? ' is-open' : ''}`}>
        <div className="fab-actions" id="fab-actions" aria-hidden={!open}>
          <Link to="/compose" className="fab-action" tabIndex={open ? 0 : -1}>
            <span className="fab-action-label">피드 작성하기</span>
            <span className="fab-action-icon" aria-hidden="true">
              <PencilIcon size={20} strokeWidth={2.2} />
            </span>
          </Link>
          <Link to="/search" className="fab-action" tabIndex={open ? 0 : -1}>
            <span className="fab-action-label">피드 검색하기</span>
            <span className="fab-action-icon" aria-hidden="true">
              <SearchIcon size={20} strokeWidth={2.2} />
            </span>
          </Link>
        </div>

        <button
          type="button"
          className="fab fab-toggle"
          aria-label={open ? '메뉴 닫기' : '피드 메뉴 열기'}
          aria-expanded={open}
          aria-controls="fab-actions"
          onClick={() => setOpen((v) => !v)}
        >
          <PlusIcon size={30} strokeWidth={2.4} />
        </button>
      </div>
    </>
  );
}
