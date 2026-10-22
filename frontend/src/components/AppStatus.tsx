import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { clearBadgeAndNotifications } from '../lib/notifications';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * 서비스 워커 등록 + 새 버전 안내 + 오프라인 안내.
 * 홈 화면 앱은 며칠씩 켜 둔 채로 쓰기 때문에, 앱으로 돌아올 때와 1시간마다 새 버전을 확인한다.
 */
export default function AppStatus() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => registration.update().catch(() => undefined);
      setInterval(check, UPDATE_CHECK_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  // 알림을 눌렀을 때 앱이 이미 켜져 있으면 서비스 워커(src/sw.ts)가 이동할 주소를 보낸다 → 새로고침 없이 이동
  const navigate = useNavigate();
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; url?: string } | null;
      if (data?.type === 'OPEN_URL' && typeof data.url === 'string' && data.url.startsWith('/')) navigate(data.url);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);

  // 앱을 열거나 다시 돌아오면 아이콘 배지(새 소식 표시)와 남은 알림을 지운다
  useEffect(() => {
    const clear = () => {
      if (document.visibilityState === 'visible') clearBadgeAndNotifications();
    };
    clear();
    document.addEventListener('visibilitychange', clear);
    return () => document.removeEventListener('visibilitychange', clear);
  }, []);

  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <>
      {!online && (
        <div className="offline-banner" role="status">
          인터넷 연결이 끊겼어요. 연결되면 다시 불러올게요.
        </div>
      )}
      {needRefresh && (
        <div className="toast" role="status">
          <span>새 버전이 있어요</span>
          <span className="toast-actions">
            <button type="button" onClick={() => setNeedRefresh(false)}>
              나중에
            </button>
            <button type="button" onClick={() => updateServiceWorker(true)}>
              새로고침
            </button>
          </span>
        </div>
      )}
    </>
  );
}
