import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Member } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import ConfirmSheet from '../components/ConfirmSheet';
import { BackIcon, LockIcon } from '../components/Icons';
import { avatarColor } from '../lib/avatar';

const TOAST_MS = 4000;

export default function MembersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'parent';
  const [me, setMe] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(isAdmin);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number>();

  useEffect(() => {
    if (!isAdmin) return;
    api
      .members()
      .then((res) => {
        setMe(res.me);
        setMembers(res.members);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const closeSheet = useCallback(() => setPending(null), []);

  function showToast(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), TOAST_MS);
  }

  async function confirmRemove() {
    if (!pending) return;
    setRemoving(true);
    try {
      await api.removeMember(pending.id);
      setMembers((list) => list.filter((m) => m.id !== pending.id));
      showToast(`${pending.name} 님을 가족에서 제거했어요`);
      setPending(null);
    } catch (err) {
      showToast((err as Error).message);
      setPending(null);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="members-page">
      <header className="sub-header">
        <Link to="/" className="icon-btn" aria-label="피드로 돌아가기">
          <BackIcon />
        </Link>
        <h1 className="display">가족 구성원 관리</h1>
      </header>

      {!isAdmin ? (
        <main className="result no-access">
          <div className="result-icon is-locked">
            <LockIcon />
          </div>
          <h2 className="display">관리자만 볼 수 있어요</h2>
          <p>가족 구성원 관리는 관리자 권한이 필요해요.</p>
          <Link to="/" className="btn btn-primary">
            피드로 돌아가기
          </Link>
        </main>
      ) : (
        <main className="members">
          {loading && <p className="feed-status">불러오는 중…</p>}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          {me && (
            <section className="members-section">
              <h2>나</h2>
              <div className="member-me">
                <div className="avatar avatar-lg" style={{ background: avatarColor(me.name) }} aria-hidden="true">
                  {me.name.slice(0, 1)}
                </div>
                <div className="member-text">
                  <div className="member-name">
                    <b>{me.name}</b>
                    <span className="badge-admin">관리자</span>
                  </div>
                  <span className="member-email">{me.email}</span>
                </div>
              </div>
            </section>
          )}

          {me && (
            <section className="members-section">
              <h2>가족 구성원 {members.length}명</h2>
              <ul className="member-list">
                {members.map((m) => (
                  <li key={m.id} className="member-row">
                    <div className="avatar" style={{ background: avatarColor(m.name) }} aria-hidden="true">
                      {m.name.slice(0, 1)}
                    </div>
                    <div className="member-text">
                      <b>{m.name}</b>
                      <span className="member-email">{m.email}</span>
                    </div>
                    <button
                      type="button"
                      className="remove-btn"
                      aria-label={`${m.name} 제거`}
                      onClick={() => setPending(m)}
                    >
                      제거
                    </button>
                  </li>
                ))}
                {members.length === 0 && <li className="member-empty">아직 다른 가족 구성원이 없어요.</li>}
              </ul>
              <p className="hint members-note">제거하면 해당 계정은 탈퇴 처리되어 더 이상 로그인할 수 없어요.</p>
            </section>
          )}
        </main>
      )}

      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast('')}>
            닫기
          </button>
        </div>
      )}

      {pending && (
        <ConfirmSheet
          title={`${pending.name} 님을 제거할까요?`}
          confirmLabel="제거하기"
          busyLabel="제거 중…"
          busy={removing}
          onConfirm={confirmRemove}
          onCancel={closeSheet}
        >
          {pending.email} 계정을 탈퇴 처리해요.
          <br />
          탈퇴하면 더 이상 로그인할 수 없고, 되돌릴 수 없어요.
        </ConfirmSheet>
      )}
    </div>
  );
}
