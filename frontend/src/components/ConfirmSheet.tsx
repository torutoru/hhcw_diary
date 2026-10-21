import { useEffect, type ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 아래에서 올라오는 위험 작업 확인 시트 (구성원 제거, 댓글 삭제) */
export default function ConfirmSheet({ title, children, confirmLabel, busyLabel, busy, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy) return;
      // 상세 모달 위에 떠 있을 때 모달까지 닫히지 않게 한다
      e.stopImmediatePropagation();
      onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [busy, onCancel]);

  return (
    <div className="sheet-root">
      <button type="button" className="modal-backdrop" aria-label="취소" onClick={() => !busy && onCancel()} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="confirm-sheet-title">
        <h2 id="confirm-sheet-title" className="display">
          {title}
        </h2>
        <p>{children}</p>
        <div className="sheet-actions">
          <button type="button" className="sheet-cancel" onClick={onCancel} disabled={busy}>
            취소
          </button>
          <button type="button" className="sheet-danger" onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
