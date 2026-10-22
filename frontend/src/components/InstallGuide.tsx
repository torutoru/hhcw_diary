import { useEffect, useState } from 'react';
import { APP_NAME, withObject } from '../lib/app';
import {
  dismissInstallCard,
  isInstallCardDismissed,
  promptInstall,
  useInstallMode,
  type InstallMode,
} from '../lib/pwa';
import { CloseIcon, DownloadIcon, ShareIcon } from './Icons';

/** 기기별 홈 화면 설치 방법 안내 시트 */
export function InstallGuideSheet({ mode, onClose }: { mode: InstallMode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-root">
      <button type="button" className="modal-backdrop" aria-label="닫기" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <h2 id="install-title" className="display">
          홈 화면에 {APP_NAME} 추가하기
        </h2>
        {mode === 'inapp' && (
          <ol className="install-steps">
            <li>지금은 카카오톡 같은 앱 안의 브라우저라서 설치할 수 없어요.</li>
            <li>
              화면의 <b>⋯</b> 또는 <b>⋮</b> 메뉴에서 <b>다른 브라우저로 열기</b>를 눌러 주세요.
            </li>
            <li>아이폰은 사파리, 안드로이드는 크롬에서 열고 다시 설치해 주세요.</li>
          </ol>
        )}
        {mode === 'ios' && (
          <ol className="install-steps">
            <li>
              화면 아래(또는 주소창 옆)의 공유 버튼 <ShareIcon size={18} /> 을 눌러요.
            </li>
            <li>
              목록을 내려서 <b>홈 화면에 추가</b>를 눌러요.
            </li>
            <li>
              오른쪽 위 <b>추가</b>를 누르면 홈 화면에 {APP_NAME} 아이콘이 생겨요.
            </li>
            <li className="install-note">처음 열면 한 번 다시 로그인해 주세요. "로그인 상태 기억하기"를 켜 두면 계속 유지돼요.</li>
          </ol>
        )}
        {mode === 'desktop' && (
          <ol className="install-steps">
            <li>
              크롬·엣지 주소창 오른쪽의 <b>설치 아이콘</b>을 누르거나,
            </li>
            <li>
              브라우저 메뉴(<b>⋮</b> 또는 <b>⋯</b>)에서 <b>앱 설치</b> / <b>이 사이트를 앱으로 설치</b>를 눌러요.
            </li>
            <li className="install-note">휴대폰에서는 사파리(아이폰)나 크롬(안드로이드)으로 이 사이트를 열면 홈 화면에 설치할 수 있어요.</li>
          </ol>
        )}
        {mode === 'android-menu' && (
          <ol className="install-steps">
            <li>크롬 오른쪽 위의 <b>⋮</b> 메뉴를 눌러요.</li>
            <li>
              <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 눌러요.
            </li>
            <li>홈 화면에 생긴 {APP_NAME} 아이콘으로 열면 앱처럼 쓸 수 있어요.</li>
          </ol>
        )}
        <div className="sheet-actions">
          <button type="button" className="sheet-cancel" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

/** 로그인 화면의 설치 안내 카드. 닫으면 이 기기에서는 다시 안 보인다 (로그인 후 프로필 메뉴에서는 계속 가능) */
export function InstallCard() {
  const mode = useInstallMode();
  const [hidden, setHidden] = useState(isInstallCardDismissed);
  const [guide, setGuide] = useState(false);

  if (hidden || mode === 'installed') return null;

  async function onInstall() {
    if (mode === 'prompt') await promptInstall();
    else setGuide(true);
  }

  return (
    <>
      <section className="install-card" aria-label="앱으로 설치">
        <div className="install-card-text">
          <b>홈 화면에 {withObject(APP_NAME)} 추가해 보세요</b>
          <span>앱처럼 바로 열 수 있어요.</span>
        </div>
        <button type="button" className="install-card-btn" onClick={onInstall}>
          <DownloadIcon size={18} />
          {mode === 'prompt' ? '설치' : '방법 보기'}
        </button>
        <button
          type="button"
          className="install-card-close"
          aria-label="설치 안내 닫기"
          onClick={() => {
            dismissInstallCard();
            setHidden(true);
          }}
        >
          <CloseIcon size={16} />
        </button>
      </section>
      {guide && <InstallGuideSheet mode={mode} onClose={() => setGuide(false)} />}
    </>
  );
}
