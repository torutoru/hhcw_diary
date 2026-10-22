import { useState } from 'react';
import { APP_NAME } from '../lib/app';
import { disablePush, enablePush, usePushStatus, type PushStatus } from '../lib/notifications';
import { BellIcon, CloseIcon } from './Icons';

const STATUS_TEXT: Record<PushStatus, string> = {
  on: '이 기기에서 새 피드·댓글 알림을 받고 있어요.',
  off: '알림을 켜면 새 피드와, 내가 댓글 단 피드의 새 댓글을 알려드려요.',
  denied: `알림이 꺼져 있어요. 휴대폰 설정 → 알림에서 ${APP_NAME}(또는 브라우저) 알림을 허용해 주세요.`,
  'needs-install': `아이폰은 홈 화면에 설치한 ${APP_NAME} 앱에서만 알림을 받을 수 있어요. 설치 후 앱에서 켜 주세요.`,
  unsupported: '이 브라우저에서는 알림을 받을 수 없어요.',
  unavailable: '알림 기능이 아직 준비되지 않았어요.',
};

/** 내 정보 화면의 알림 설정 */
export function NotificationSettings() {
  const { status, setStatus } = usePushStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!status) return null;

  async function toggle() {
    setBusy(true);
    setError('');
    try {
      if (status === 'on') {
        await disablePush();
        setStatus('off');
      } else {
        setStatus(await enablePush());
      }
    } catch (err) {
      setError((err as Error).message || '알림 설정을 바꾸지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <span className="field-label">알림</span>
      <div className="notify-box">
        <p>{STATUS_TEXT[status]}</p>
        {(status === 'on' || status === 'off') && (
          <button
            type="button"
            className={`btn ${status === 'on' ? 'btn-outline' : 'btn-primary'} notify-btn`}
            onClick={toggle}
            disabled={busy}
          >
            <BellIcon size={18} />
            {busy ? '설정 중…' : status === 'on' ? '이 기기 알림 끄기' : '알림 켜기'}
          </button>
        )}
      </div>
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}

const DISMISS_KEY = 'hhcw.notifyCardDismissed';

/** 메인 피드 맨 위: 알림을 아직 안 켠 기기에 한 번 안내. 닫으면 다시 안 보임 (내 정보에서 계속 가능) */
export function NotificationCard() {
  const { status, setStatus } = usePushStatus();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(false);

  if (hidden || status !== 'off') return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // 저장이 막혀도 이번 화면에서는 닫힌다
    }
    setHidden(true);
  }

  async function onEnable() {
    setBusy(true);
    try {
      setStatus(await enablePush());
    } catch {
      setStatus('off');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="install-card" aria-label="알림 켜기">
      <div className="install-card-text">
        <b>새 피드 알림을 받아 보세요</b>
        <span>새 피드와 내가 댓글 단 피드의 새 댓글을 알려드려요.</span>
      </div>
      <button type="button" className="install-card-btn" onClick={onEnable} disabled={busy}>
        <BellIcon size={18} />
        {busy ? '…' : '켜기'}
      </button>
      <button type="button" className="install-card-close" aria-label="알림 안내 닫기" onClick={dismiss}>
        <CloseIcon size={16} />
      </button>
    </section>
  );
}
