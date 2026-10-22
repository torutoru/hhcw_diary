import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { promptInstall, useInstallMode } from '../lib/pwa';
import { DownloadIcon, LogoutIcon, UserIcon, UsersIcon } from './Icons';
import { InstallGuideSheet } from './InstallGuide';
import { Avatar, PersonName } from './Person';

/** 메인 피드 우측 상단 메뉴: 내 정보, 가족 구성원 관리(가족관계 엄마·아빠만), 로그아웃 */
export default function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState(false);
  const installMode = useInstallMode();
  const root = useRef<HTMLDivElement>(null);

  // 바깥을 누르거나 Esc 로 닫는다
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function onLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  async function onInstall() {
    setOpen(false);
    if (installMode === 'prompt') await promptInstall();
    else setGuide(true);
  }

  if (!user) return null;

  return (
    <div className="profile" ref={root}>
      <button
        type="button"
        className={`icon-btn profile-btn${open ? ' is-open' : ''}`}
        aria-label="내 메뉴 열기"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <UserIcon />
      </button>
      {open && (
        <nav className="profile-menu" aria-label="내 메뉴">
          <div className="profile-me">
            <Avatar nickname={user.nickname} relation={user.relation} />
            <div className="profile-me-text">
              <PersonName nickname={user.nickname} relation={user.relation} />
              <span>{user.email}</span>
            </div>
          </div>
          <Link to="/me" className="menu-item">
            <UserIcon size={20} />
            내 정보
          </Link>
          {user.role === 'parent' && (
            <Link to="/members" className="menu-item">
              <UsersIcon />
              가족 구성원 관리
            </Link>
          )}
          {installMode !== 'installed' && (
            <button type="button" className="menu-item" onClick={onInstall}>
              <DownloadIcon />
              앱으로 설치
            </button>
          )}
          <button type="button" className="menu-item" onClick={onLogout}>
            <LogoutIcon />
            로그아웃
          </button>
        </nav>
      )}
      {guide && <InstallGuideSheet mode={installMode} onClose={() => setGuide(false)} />}
    </div>
  );
}
