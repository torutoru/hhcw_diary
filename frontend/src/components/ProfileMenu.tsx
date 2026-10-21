import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { avatarColor } from '../lib/avatar';
import { LogoutIcon, UserIcon, UsersIcon } from './Icons';

/** 메인 피드 우측 상단 메뉴: 내 정보, 가족 구성원 관리(엄마·아빠만), 로그아웃 */
export default function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
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
            <div className="avatar" style={{ background: avatarColor(user.name) }} aria-hidden="true">
              {user.name.slice(0, 1)}
            </div>
            <div className="profile-me-text">
              <b>{user.name}</b>
              <span>{user.email}</span>
            </div>
          </div>
          {user.role === 'parent' && (
            <Link to="/members" className="menu-item">
              <UsersIcon />
              가족 구성원 관리
            </Link>
          )}
          <button type="button" className="menu-item" onClick={onLogout}>
            <LogoutIcon />
            로그아웃
          </button>
        </nav>
      )}
    </div>
  );
}
